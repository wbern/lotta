/**
 * WRITE MATRIX (ADR-0007): every write API, run against a real in-memory
 * database, must leave every DB-derived query marked stale — without the writer
 * naming a single query key. Network-backed queries (meta.source 'network')
 * must be left alone so typing in a dialog never refetches versions.json.
 *
 * Each row would have caught one of the shipped "stale view after a write" bugs:
 * a writer invalidated the keys it thought of and missed a reader (club rename →
 * Ställning/Alfabetisk, Namnvisning → Lottning, Ta bort bord → status bar, …).
 */
import { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setLocalProviderFactory } from '../api/active-provider'
import { downloadBackup, restoreBackup } from '../api/backup'
import { addClub, deleteClub, renameClub } from '../api/clubs'
import { getLocalProvider } from '../api/local-data-provider'
import { importDerbyJson } from '../api/migration'
import {
  addPoolPlayer,
  deletePoolPlayer,
  deletePoolPlayers,
  updatePoolPlayer,
} from '../api/players'
import { addGame, deleteGame, deleteGames, setResult, updateGame } from '../api/results'
import { pairNextRound, unpairLastRound } from '../api/rounds'
import { seedFakePlayers } from '../api/seed-players'
import { getDatabaseService, setDatabaseService } from '../api/service-provider'
import { updateSettings } from '../api/settings'
import {
  addTournamentPlayer,
  addTournamentPlayers,
  removeTournamentPlayer,
  removeTournamentPlayers,
  updateTournamentPlayer,
} from '../api/tournament-players'
import {
  createTournament,
  deleteTournament,
  importPlayers,
  updateTournament,
} from '../api/tournaments'
import { redo, restoreToPoint, undo } from '../api/undo'
import { DatabaseService } from '../db/database-service'
import { deleteDatabase } from '../db/persistence'
import { UndoManager } from '../db/undo-manager'
import { deleteUndoDatabase } from '../db/undo-persistence'
import { getUndoManager, setUndoManager } from '../db/undo-provider'
import type { CreateTournamentRequest } from '../types/api'
import { emitDataChanged } from './data-changed-bus'
import { installDataChangedInvalidation } from './query-invalidation'

const TOURNAMENT: CreateTournamentRequest = {
  name: 'Matristurneringen',
  group: 'A',
  pairingSystem: 'Monrad',
  initialPairing: 'Rating',
  nrOfRounds: 5,
  barredPairing: false,
  compensateWeakPlayerPP: false,
  pointsPerGame: 1,
  chess4: false,
  ratingChoice: 'ELO',
  showELO: true,
  showGroup: false,
}

interface Fixture {
  tid: number
  clubId: number
  emptyClubId: number
  poolPlayerIds: number[]
  tournamentPlayerIds: number[]
  /** A player in a second, not yet paired tournament (removal is allowed there). */
  benchPlayerId: number
  benchTid: number
}

let fx: Fixture
let qc: QueryClient
let uninstall: () => void

/** One entry per real query key the app uses (see src/hooks). */
function dbQueryKeys(tid: number): readonly unknown[][] {
  return [
    ['tournaments'],
    ['tournaments', tid],
    ['tournaments', tid, 'rounds'],
    ['tournaments', tid, 'rounds', 1],
    ['tournaments', tid, 'standings', undefined],
    ['tournaments', tid, 'standings', 1],
    ['tournaments', tid, 'club-standings', 1],
    ['tournaments', tid, 'chess4-standings', 1],
    ['tournaments', tid, 'players'],
    ['tournaments', tid, 'alphabetical-print', 1],
    ['players'],
    ['clubs'],
    ['settings'],
  ]
}

async function seedQueries(client: QueryClient, tid: number): Promise<void> {
  for (const key of dbQueryKeys(tid)) client.setQueryData(key, { seeded: true })
  await client.prefetchQuery({
    queryKey: ['versions'],
    queryFn: () => [],
    meta: { source: 'network' },
  })
}

function staleness(client: QueryClient, tid: number): Record<string, boolean | undefined> {
  const out: Record<string, boolean | undefined> = {}
  for (const key of [...dbQueryKeys(tid), ['versions']]) {
    out[JSON.stringify(key)] = client.getQueryState(key)?.isInvalidated
  }
  return out
}

/** Lets save() resolve and the microtask-coalesced invalidation run. */
async function settle(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0))
}

async function buildFixture(): Promise<Fixture> {
  const db = getDatabaseService()
  const club = db.clubs.create({ name: 'SK Matris' })
  const emptyClub = db.clubs.create({ name: 'Tom Klubb' })
  const t = db.tournaments.create(TOURNAMENT)
  const names = ['Anna', 'Bertil', 'Cecilia', 'David', 'Eva']
  const poolPlayerIds: number[] = []
  const tournamentPlayerIds: number[] = []
  for (const [i, firstName] of names.entries()) {
    const dto = { firstName, lastName: 'Matrisson', ratingI: 2000 - i * 100, clubIndex: club.id }
    poolPlayerIds.push(db.availablePlayers.create(dto).id)
    if (i < 4) tournamentPlayerIds.push(db.tournamentPlayers.add(t.id, dto).id)
  }
  await db.save()
  await pairNextRound(t.id)
  const bench = db.tournaments.create({ ...TOURNAMENT, name: 'Bänkturneringen' })
  const benchPlayerId = db.tournamentPlayers.add(bench.id, {
    firstName: 'Filip',
    lastName: 'Bänk',
    clubIndex: club.id,
  }).id
  await db.save()
  await getUndoManager().pushState('Fixture', '')
  return {
    tid: t.id,
    clubId: club.id,
    emptyClubId: emptyClub.id,
    poolPlayerIds,
    tournamentPlayerIds,
    benchPlayerId,
    benchTid: bench.id,
  }
}

beforeEach(async () => {
  await deleteDatabase()
  await deleteUndoDatabase()
  const service = await DatabaseService.create()
  setDatabaseService(service)
  const manager = await UndoManager.create()
  setUndoManager(manager)
  await manager.captureInitialState()
  setLocalProviderFactory(() => getLocalProvider())
  fx = await buildFixture()
  await settle()

  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await seedQueries(qc, fx.tid)
  uninstall = installDataChangedInvalidation(qc)
})

afterEach(async () => {
  uninstall()
  qc.clear()
  getDatabaseService().close()
  await deleteDatabase()
  await deleteUndoDatabase()
})

const tsv = (body: string) =>
  new File([`Efternamn\tFörnamn\tKlubb\n${body}`], 'spelare.tsv', {
    type: 'text/tab-separated-values',
  })

const WRITES: [string, () => Promise<unknown>][] = [
  ['addClub', () => addClub({ name: 'Ny Klubb' })],
  ['renameClub', () => renameClub(fx.clubId, { name: 'SK Omdöpt' })],
  [
    'updateClub chess4 members',
    () => renameClub(fx.clubId, { name: 'SK Matris', chess4Members: 12 }),
  ],
  ['deleteClub', () => deleteClub(fx.emptyClubId)],
  ['updateSettings playerPresentation', () => updateSettings({ playerPresentation: 'LAST_FIRST' })],
  ['setResult', () => setResult(fx.tid, 1, 1, { resultType: 'WHITE_WIN' })],
  [
    'setResult with expectedPrior (command path)',
    () => setResult(fx.tid, 1, 1, { resultType: 'DRAW', expectedPrior: 'NO_RESULT' }),
  ],
  ['deleteGame', () => deleteGame(fx.tid, 1, 1)],
  ['deleteGames', () => deleteGames(fx.tid, 1, [1, 2])],
  [
    'addGame',
    async () => {
      await deleteGame(fx.tid, 1, 2)
      await settle()
      await seedQueries(qc, fx.tid)
      const round = getDatabaseService().games.getRound(fx.tid, 1)!
      const paired = new Set(
        round.games.flatMap((g) => [g.whitePlayer?.id, g.blackPlayer?.id]).filter(Boolean),
      )
      const free = fx.tournamentPlayerIds.filter((id) => !paired.has(id))
      return addGame(fx.tid, 1, free[0], free[1])
    },
  ],
  [
    'updateGame (swap colours)',
    () => {
      const g = getDatabaseService().games.getRound(fx.tid, 1)!.games[0]
      return updateGame(fx.tid, 1, g.boardNr, g.blackPlayer!.id, g.whitePlayer!.id)
    },
  ],
  [
    'addTournamentPlayer',
    () => addTournamentPlayer(fx.tid, { firstName: 'Ny', lastName: 'Spelare' }),
  ],
  [
    'addTournamentPlayers',
    () => addTournamentPlayers(fx.tid, [{ firstName: 'Två', lastName: 'Spelare' }]),
  ],
  [
    'updateTournamentPlayer',
    () => updateTournamentPlayer(fx.tid, fx.tournamentPlayerIds[0], { firstName: 'Annika' }),
  ],
  ['removeTournamentPlayer', () => removeTournamentPlayer(fx.benchTid, fx.benchPlayerId)],
  ['removeTournamentPlayers', () => removeTournamentPlayers(fx.benchTid, [fx.benchPlayerId])],
  ['addPoolPlayer', () => addPoolPlayer({ firstName: 'Pool', lastName: 'Spelare' })],
  ['updatePoolPlayer', () => updatePoolPlayer(fx.poolPlayerIds[0], { firstName: 'Ändrad' })],
  ['deletePoolPlayer', () => deletePoolPlayer(fx.poolPlayerIds[4])],
  ['deletePoolPlayers', () => deletePoolPlayers([fx.poolPlayerIds[3], fx.poolPlayerIds[4]])],
  ['importPlayers', () => importPlayers(tsv('Importsson\tIda\tSK Import\n'))],
  ['seedFakePlayers', () => seedFakePlayers(3, { clubCount: 1 })],
  [
    'pairNextRound',
    async () => {
      for (const g of getDatabaseService().games.getRound(fx.tid, 1)!.games) {
        await setResult(fx.tid, 1, g.boardNr, { resultType: 'DRAW' })
      }
      await settle()
      await seedQueries(qc, fx.tid)
      return pairNextRound(fx.tid)
    },
  ],
  ['unpairLastRound', () => unpairLastRound(fx.tid)],
  ['createTournament', () => createTournament({ ...TOURNAMENT, name: 'Andra turneringen' })],
  ['updateTournament', () => updateTournament(fx.tid, { ...TOURNAMENT, name: 'Omdöpt turnering' })],
  ['deleteTournament', () => deleteTournament(fx.tid)],
  [
    'restoreBackup',
    async () => {
      const blob = await downloadBackup()
      return restoreBackup(new File([await blob.arrayBuffer()], 'backup.sqlite'))
    },
  ],
  ['undo', async () => expect(await undo()).toBe(true)],
  [
    'redo',
    async () => {
      await undo()
      await settle()
      await seedQueries(qc, fx.tid)
      expect(await redo()).toBe(true)
    },
  ],
  [
    'restoreToPoint',
    async () => {
      const [first] = getUndoManager().getTimeline()
      expect(await restoreToPoint(first.snapshotIndex)).toBe(true)
    },
  ],
  [
    'importDerbyJson',
    () =>
      importDerbyJson({
        clubs: [{ index: 1, club: 'SK Derby', chess4members: 0 }],
        availablePlayers: [],
        tournaments: [],
        tournamentPlayers: [],
        tournamentGames: [],
        tournamentRoundDates: [],
        tournamentTiebreaks: [],
        settings: [],
        stringSettings: [],
      }),
  ],
]

describe('write matrix: every write refreshes every DB-derived view', () => {
  it.each(WRITES)('%s marks every DB query stale and leaves versions alone', async (_n, write) => {
    await write()
    await settle()

    const expected: Record<string, boolean> = {}
    for (const key of dbQueryKeys(fx.tid)) expected[JSON.stringify(key)] = true
    expected[JSON.stringify(['versions'])] = false
    expect(staleness(qc, fx.tid)).toEqual(expected)
  })
})

describe('installDataChangedInvalidation', () => {
  it('given two data-changed signals in one tick, then queries are invalidated once', async () => {
    const spy = vi.spyOn(qc, 'invalidateQueries')

    emitDataChanged()
    emitDataChanged()
    await settle()

    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('given signals in separate ticks, then each one invalidates', async () => {
    const spy = vi.spyOn(qc, 'invalidateQueries')

    emitDataChanged()
    await settle()
    emitDataChanged()
    await settle()

    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('given the installer was removed, when data changes, then nothing is invalidated', async () => {
    uninstall()
    const spy = vi.spyOn(qc, 'invalidateQueries')

    emitDataChanged()
    await settle()

    expect(spy).not.toHaveBeenCalled()
    uninstall = () => {}
  })

  it('given an active DB query, when data changes, then it refetches in the background without a loading state', async () => {
    let calls = 0
    const observerKey = ['tournaments', fx.tid, 'rounds']
    qc.removeQueries({ queryKey: observerKey })
    const { QueryObserver } = await import('@tanstack/react-query')
    const observer = new QueryObserver(qc, {
      queryKey: observerKey,
      queryFn: async () => ++calls,
    })
    const states: { isLoading: boolean; data: unknown }[] = []
    const unsubscribe = observer.subscribe((r) =>
      states.push({ isLoading: r.isLoading, data: r.data }),
    )
    await vi.waitFor(() => expect(calls).toBe(1))

    emitDataChanged()
    await vi.waitFor(() => expect(calls).toBe(2))

    const afterFirstData = states.slice(states.findIndex((s) => s.data === 1))
    expect(afterFirstData.every((s) => !s.isLoading)).toBe(true)
    expect(states.at(-1)?.data).toBe(2)
    unsubscribe()
  })
})

// Import creates clubs as well as players; the long-mounted player dialogs must
// see them without a reload (the new-player form once offered no clubs). Before
// ADR-0007 AppLayout's import handler had to remember to invalidate ['clubs'].
describe('a long-mounted club list', () => {
  it('given an import that creates a club, then the mounted club list shows it', async () => {
    const { QueryObserver } = await import('@tanstack/react-query')
    const { listClubs } = await import('../api/clubs')
    qc.removeQueries({ queryKey: ['clubs'] })
    const clubs = new QueryObserver(qc, { queryKey: ['clubs'], queryFn: listClubs })
    const unsubscribe = clubs.subscribe(() => {})
    await vi.waitFor(() => expect(clubs.getCurrentResult().data).toBeDefined())

    await importPlayers(tsv('Importsson\tIda\tSK Import\n'))

    await vi.waitFor(() =>
      expect(clubs.getCurrentResult().data?.map((c) => c.name)).toContain('SK Import'),
    )
    unsubscribe()
  })
})
