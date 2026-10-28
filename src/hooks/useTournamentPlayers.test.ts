// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setLocalProviderFactory } from '../api/active-provider'
import { getLocalProvider } from '../api/local-data-provider'
import { getDatabaseService, setDatabaseService } from '../api/service-provider'
import { DatabaseService } from '../db/database-service'
import { deleteDatabase } from '../db/persistence'
import { UndoManager } from '../db/undo-manager'
import { deleteUndoDatabase } from '../db/undo-persistence'
import { setUndoManager } from '../db/undo-provider'
import { installDataChangedInvalidation } from '../lib/query-invalidation'
import { useUpdateTournamentPlayer } from './useTournamentPlayers'

let tid: number
let playerId: number

beforeEach(async () => {
  await deleteDatabase()
  await deleteUndoDatabase()
  setDatabaseService(await DatabaseService.create())
  const manager = await UndoManager.create()
  setUndoManager(manager)
  await manager.captureInitialState()
  setLocalProviderFactory(() => getLocalProvider())
  const db = getDatabaseService()
  tid = db.tournaments.create({
    name: 'Utgår',
    group: 'A',
    pairingSystem: 'Monrad',
    initialPairing: 'Rating',
    nrOfRounds: 7,
    barredPairing: false,
    compensateWeakPlayerPP: false,
    pointsPerGame: 1,
    chess4: false,
    ratingChoice: 'ELO',
    showELO: true,
    showGroup: false,
  }).id
  playerId = db.tournamentPlayers.add(tid, { firstName: 'Anna', lastName: 'Ek' }).id
})

afterEach(async () => {
  getDatabaseService().close()
  await deleteDatabase()
  await deleteUndoDatabase()
})

describe('useUpdateTournamentPlayer', () => {
  // Standings, pairings and club standings render player names (and the
  // "(utgått rN)" suffix), so editing a player must refresh them too — not only
  // the player list. Before the fix they stayed stale until the next pairing.
  // Since ADR-0007 the write itself announces the change; the hook names no keys.
  it('given cached standings and pairings, when a player is updated, then they are marked stale', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { uninstall } = installDataChangedInvalidation(qc)
    qc.setQueryData(['tournaments', tid, 'standings', 4], [])
    qc.setQueryData(['tournaments', tid, 'rounds', 4], {})
    qc.setQueryData(['tournaments', tid, 'club-standings', 4], [])
    qc.setQueryData(['tournaments', tid, 'players'], [])
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      createElement(QueryClientProvider, { client: qc }, children)
    const { result } = renderHook(() => useUpdateTournamentPlayer(tid), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({ playerId, dto: { withdrawnFromRound: 5 } })
    })

    expect(qc.getQueryState(['tournaments', tid, 'standings', 4])?.isInvalidated).toBe(true)
    expect(qc.getQueryState(['tournaments', tid, 'rounds', 4])?.isInvalidated).toBe(true)
    expect(qc.getQueryState(['tournaments', tid, 'club-standings', 4])?.isInvalidated).toBe(true)
    expect(qc.getQueryState(['tournaments', tid, 'players'])?.isInvalidated).toBe(true)
    uninstall()
  })
})
