import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DatabaseService } from '../db/database-service.ts'
import { deleteDatabase } from '../db/persistence.ts'
import type { ResultType } from '../types/api.ts'
import { setLocalProviderFactory } from './active-provider.ts'
import { getLocalProvider } from './local-data-provider.ts'
import { setResult } from './results.ts'
import { pairNextRound } from './rounds.ts'
import { setDatabaseService } from './service-provider.ts'
import { getClubStandingsLocal, getStandingsLocal } from './standings.ts'

describe('chess4 reported standings stability across class size changes', () => {
  let service: DatabaseService

  beforeEach(async () => {
    service = await DatabaseService.create()
    setDatabaseService(service)
    setLocalProviderFactory(() => getLocalProvider())
  })

  afterEach(async () => {
    service.close()
    await deleteDatabase()
  })

  it('round-N play results stay stable when chess4Members is edited; only the chess4 formula recomputes', async () => {
    // Schackfyran: editing class sizes between rounds is normal — the chess4
    // multiplier (40/max(10,members)) is allowed to re-apply with new sizes,
    // so the *displayed* club score may change. What must NOT change is the
    // underlying play results: per-player game scores and raw club totals
    // for any already-played round. Those are facts about what happened on
    // the boards and must not be rewritten by a roster edit.
    const t = service.tournaments.create({
      name: 'Schack4an',
      group: 'A',
      pairingSystem: 'Monrad',
      initialPairing: 'Rating',
      nrOfRounds: 3,
      barredPairing: false,
      compensateWeakPlayerPP: false,
      pointsPerGame: 4,
      chess4: true,
      ratingChoice: 'ELO',
      showELO: false,
      showGroup: false,
    })

    const club4A = service.clubs.create({ name: '4A', chess4Members: 10 })
    const club4B = service.clubs.create({ name: '4B', chess4Members: 10 })

    service.tournamentPlayers.add(t.id, {
      firstName: 'Anna',
      lastName: 'Andersson',
      clubIndex: club4A.id,
      ratingI: 1000,
    })
    service.tournamentPlayers.add(t.id, {
      firstName: 'Bo',
      lastName: 'Björk',
      clubIndex: club4A.id,
      ratingI: 1000,
    })
    service.tournamentPlayers.add(t.id, {
      firstName: 'Cilla',
      lastName: 'Carlsson',
      clubIndex: club4B.id,
      ratingI: 1000,
    })
    service.tournamentPlayers.add(t.id, {
      firstName: 'Dan',
      lastName: 'Dahl',
      clubIndex: club4B.id,
      ratingI: 1000,
    })

    const round1 = await pairNextRound(t.id)
    for (const g of round1.games) {
      if (!g.whitePlayer || !g.blackPlayer) continue
      await setResult(t.id, 1, g.boardNr, { resultType: 'WHITE_WIN' })
    }

    const playerStandingsBefore = await getStandingsLocal(t.id, 1)
    const clubStandingsBefore = await getClubStandingsLocal(t.id, 1)

    // Between rounds the registered roster changes — students join 4A,
    // one leaves 4B.
    service.clubs.update(club4A.id, { chess4Members: 25 })
    service.clubs.update(club4B.id, { chess4Members: 8 })

    const round2 = await pairNextRound(t.id)
    for (const g of round2.games) {
      if (!g.whitePlayer || !g.blackPlayer) continue
      await setResult(t.id, 2, g.boardNr, { resultType: 'WHITE_WIN' })
    }

    const playerStandingsAfter = await getStandingsLocal(t.id, 1)
    const clubStandingsAfter = await getClubStandingsLocal(t.id, 1)

    // Per-player scores from round 1 games — frozen.
    expect(playerStandingsAfter).toEqual(playerStandingsBefore)
    // Raw per-club point totals (sum of player scores) — frozen.
    expect(clubStandingsAfter).toEqual(clubStandingsBefore)
  })

  it('historical per-round standings stay byte-equal across class-size edits, late adds, and mid-tournament withdrawals', async () => {
    // Stronger guard: simulate a realistic Schackfyran arc over 3 rounds,
    // perturbing the roster between every round (class size edits, a late
    // add, a withdrawal). Snapshots taken right after each round is reported
    // must remain identical when re-queried after later rounds — i.e. no
    // backwards-corrupting writes leak into earlier rounds' standings.
    const t = service.tournaments.create({
      name: 'Schack4an',
      group: 'A',
      pairingSystem: 'Monrad',
      initialPairing: 'Rating',
      nrOfRounds: 3,
      barredPairing: false,
      compensateWeakPlayerPP: false,
      pointsPerGame: 4,
      chess4: true,
      ratingChoice: 'ELO',
      showELO: false,
      showGroup: false,
    })

    const club4A = service.clubs.create({ name: '4A', chess4Members: 12 })
    const club4B = service.clubs.create({ name: '4B', chess4Members: 12 })
    const club4C = service.clubs.create({ name: '4C', chess4Members: 12 })

    const seed = (firstName: string, lastName: string, clubId: number, rating: number) =>
      service.tournamentPlayers.add(t.id, {
        firstName,
        lastName,
        clubIndex: clubId,
        ratingI: rating,
      })

    seed('Anna', 'Andersson', club4A.id, 1200)
    seed('Bo', 'Björk', club4A.id, 1100)
    seed('Cilla', 'Carlsson', club4B.id, 1150)
    seed('Dan', 'Dahl', club4B.id, 1050)
    seed('Eva', 'Eriksson', club4C.id, 1180)
    seed('Filip', 'Fält', club4C.id, 1080)

    const playRound = async (round: number, results: ResultType[]) => {
      const r = await pairNextRound(t.id)
      const playable = r.games.filter((g) => g.whitePlayer && g.blackPlayer)
      for (let i = 0; i < playable.length; i++) {
        await setResult(t.id, round, playable[i].boardNr, { resultType: results[i] ?? 'WHITE_WIN' })
      }
    }

    await playRound(1, ['WHITE_WIN', 'DRAW', 'BLACK_WIN'])
    const player1 = await getStandingsLocal(t.id, 1)
    const club1 = await getClubStandingsLocal(t.id, 1)

    // Between R1 and R2: registered class sizes change; a late student joins 4C.
    service.clubs.update(club4A.id, { chess4Members: 18 })
    service.clubs.update(club4B.id, { chess4Members: 9 })
    service.clubs.update(club4C.id, { chess4Members: 25 })
    seed('Greta', 'Gren', club4C.id, 1000)

    await playRound(2, ['WHITE_WIN', 'BLACK_WIN', 'DRAW', 'WHITE_WIN'])
    const player2 = await getStandingsLocal(t.id, 2)
    const club2 = await getClubStandingsLocal(t.id, 2)

    // Between R2 and R3: another class-size shuffle; one player withdraws
    // for round 3 onward (must not retroactively zero out their prior games).
    service.clubs.update(club4A.id, { chess4Members: 22 })
    service.clubs.update(club4B.id, { chess4Members: 14 })
    const players = service.tournamentPlayers.list(t.id)
    const withdrawn = players.find((p) => p.lastName === 'Björk')!
    service.tournamentPlayers.update(withdrawn.id, { withdrawnFromRound: 3 })

    await playRound(3, ['WHITE_WIN', 'BLACK_WIN', 'DRAW', 'WHITE_WIN'])

    const player1After = await getStandingsLocal(t.id, 1)
    const club1After = await getClubStandingsLocal(t.id, 1)
    const player2After = await getStandingsLocal(t.id, 2)
    const club2After = await getClubStandingsLocal(t.id, 2)

    // Late-add players surface as 0-score phantom rows in historical
    // standings — port-faithful to legacy Lotta (`DtoMapper.toStandings`
    // iterates all current players; `Player.getScore(round)` returns 0 for
    // those without qualifying games). Narrow the equality check to the
    // roster that existed at snapshot time so we still catch the corruption
    // we actually care about: scores for already-registered players must
    // not drift when later rounds add/withdraw students or edit class sizes.
    const namesAt = (rows: { name: string }[]) => new Set(rows.map((r) => r.name))
    const namesAtR1 = namesAt(player1)
    const namesAtR2 = namesAt(player2)
    expect(player1After.filter((r) => namesAtR1.has(r.name))).toEqual(player1)
    expect(player2After.filter((r) => namesAtR2.has(r.name))).toEqual(player2)
    // Club standings sum per-player scores; phantom 0-score rows don't
    // alter any club total, so the full structure must remain equal.
    expect(club1After).toEqual(club1)
    expect(club2After).toEqual(club2)
  })
})
