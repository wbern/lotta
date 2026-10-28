// @vitest-environment jsdom
/**
 * The print view of Alfabetisk lottning used to be built by a direct DB read in
 * a useMemo keyed only on (tournament, round): a renamed player kept printing
 * under the old name until the tab was remounted. It must be a query that the
 * data-changed signal refreshes like every other view (ADR-0007).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setLocalProviderFactory } from '../../api/active-provider'
import { getLocalProvider } from '../../api/local-data-provider'
import { pairNextRound } from '../../api/rounds'
import { getDatabaseService, setDatabaseService } from '../../api/service-provider'
import { updateTournamentPlayer } from '../../api/tournament-players'
import { DatabaseService } from '../../db/database-service'
import { deleteDatabase } from '../../db/persistence'
import { UndoManager } from '../../db/undo-manager'
import { deleteUndoDatabase } from '../../db/undo-persistence'
import { setUndoManager } from '../../db/undo-provider'
import { installDataChangedInvalidation } from '../../lib/query-invalidation'
import type { RoundDto } from '../../types/api'
import { AlphabeticalPairingTab } from './AlphabeticalPairingTab'

let qc: QueryClient
let uninstall: () => void
let tid: number
let annaId: number
let rounds: RoundDto[]

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
    name: 'Utskriften',
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
  }).id
  annaId = db.tournamentPlayers.add(tid, { firstName: 'Anna', lastName: 'Ek', ratingI: 1900 }).id
  db.tournamentPlayers.add(tid, { firstName: 'Bo', lastName: 'Ask', ratingI: 1800 })
  await pairNextRound(tid)
  rounds = db.games.listRounds(tid)

  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  uninstall = installDataChangedInvalidation(qc).uninstall
})

afterEach(async () => {
  cleanup()
  uninstall()
  qc.clear()
  getDatabaseService().close()
  await deleteDatabase()
  await deleteUndoDatabase()
})

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={qc}>{children}</QueryClientProvider>
)

describe('AlphabeticalPairingTab print view', () => {
  it('given the tab is open, when a player is renamed, then the print view shows the new name', async () => {
    const { container } = render(
      <AlphabeticalPairingTab tournamentId={tid} rounds={rounds} activeRound={1} />,
      { wrapper },
    )
    const print = () => container.querySelector('.print-only')?.textContent ?? ''
    await waitFor(() => expect(print()).toContain('Anna Ek'))

    await updateTournamentPlayer(tid, annaId, { firstName: 'Annika' })

    await waitFor(() => expect(print()).toContain('Annika Ek'))
    expect(print()).not.toContain('Anna Ek')
  })
})
