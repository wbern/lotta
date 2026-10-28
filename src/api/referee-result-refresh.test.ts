/**
 * I1 (ADR-0007): a result reported by a P2P referee (LivePage → result-submit
 * message → LiveTab → handleResultSubmission → setResult) is written on the host
 * outside any React Query mutation and outside the RPC server's onMutation hook.
 * Before the persistence layer announced writes, nothing refreshed the host's
 * own Lottning/Ställning: the arbiter saw the referee's result only after an
 * unrelated write or a reload.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DatabaseService } from '../db/database-service'
import { deleteDatabase } from '../db/persistence'
import { UndoManager } from '../db/undo-manager'
import { deleteUndoDatabase } from '../db/undo-persistence'
import { setUndoManager } from '../db/undo-provider'
import { queryClient } from '../query-client'
import { setLocalProviderFactory } from './active-provider'
import { getLocalProvider } from './local-data-provider'
import { handleResultSubmission } from './p2p-broadcast'
import { pairNextRound } from './rounds'
import { getDatabaseService, setDatabaseService } from './service-provider'

const mockSendResultAck = vi.fn()
vi.mock('../services/p2p-provider', () => ({
  getP2PService: () => ({
    // Not 'connected': skip the page-update broadcasts, which are not under test.
    connectionState: 'disconnected',
    role: 'organizer',
    isPeerVerifiedReferee: () => true,
    sendResultAck: mockSendResultAck,
  }),
}))

let tid: number

beforeEach(async () => {
  await deleteDatabase()
  await deleteUndoDatabase()
  setDatabaseService(await DatabaseService.create())
  const manager = await UndoManager.create()
  setUndoManager(manager)
  await manager.captureInitialState()
  setLocalProviderFactory(() => getLocalProvider())

  const db = getDatabaseService()
  const t = db.tournaments.create({
    name: 'Domarturneringen',
    group: 'A',
    pairingSystem: 'Monrad',
    initialPairing: 'Rating',
    nrOfRounds: 3,
    barredPairing: false,
    compensateWeakPlayerPP: false,
    pointsPerGame: 1,
    chess4: false,
    ratingChoice: 'ELO',
    showELO: true,
    showGroup: false,
  })
  tid = t.id
  for (const [i, firstName] of ['Anna', 'Bo'].entries()) {
    db.tournamentPlayers.add(tid, { firstName, lastName: 'Domare', ratingI: 1800 - i })
  }
  await pairNextRound(tid)
  await new Promise((r) => setTimeout(r, 0))
  queryClient.clear()
})

afterEach(async () => {
  queryClient.clear()
  getDatabaseService().close()
  await deleteDatabase()
  await deleteUndoDatabase()
})

describe('host view after a P2P referee reports a result', () => {
  it("given the host's pairings and standings are cached, when a referee's result is applied, then both are refreshed", async () => {
    queryClient.setQueryData(['tournaments', tid, 'rounds', 1], { stale: false })
    queryClient.setQueryData(['tournaments', tid, 'standings', 1], { stale: false })

    await handleResultSubmission(
      {
        tournamentId: tid,
        roundNr: 1,
        boardNr: 1,
        resultType: 'WHITE_WIN',
        refereeName: 'Domaren',
        timestamp: Date.now(),
      },
      'referee-peer',
    )
    await new Promise((r) => setTimeout(r, 0))

    expect(mockSendResultAck).toHaveBeenCalledWith(
      expect.objectContaining({ accepted: true }),
      'referee-peer',
    )
    expect(queryClient.getQueryState(['tournaments', tid, 'rounds', 1])?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(['tournaments', tid, 'standings', 1])?.isInvalidated).toBe(
      true,
    )
  })
})
