// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { createElement } from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../api/tournament-players', () => ({
  listTournamentPlayers: vi.fn(),
  addTournamentPlayer: vi.fn(),
  addTournamentPlayers: vi.fn(),
  updateTournamentPlayer: vi.fn().mockResolvedValue({}),
  removeTournamentPlayers: vi.fn(),
}))

import { useUpdateTournamentPlayer } from './useTournamentPlayers'

describe('useUpdateTournamentPlayer', () => {
  // Standings, pairings and club standings render player names (and the
  // "(utgått rN)" suffix), so editing a player must refresh them too — not only
  // the player list. Before the fix they stayed stale until the next pairing.
  it('given cached standings and pairings, when a player is updated, then they are marked stale', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    qc.setQueryData(['tournaments', 1, 'standings', 4], [])
    qc.setQueryData(['tournaments', 1, 'rounds', 4], {})
    qc.setQueryData(['tournaments', 1, 'club-standings', 4], [])
    qc.setQueryData(['tournaments', 2, 'standings', 4], [])
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      createElement(QueryClientProvider, { client: qc }, children)
    const { result } = renderHook(() => useUpdateTournamentPlayer(1), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({ playerId: 7, dto: { withdrawnFromRound: 5 } })
    })

    expect(qc.getQueryState(['tournaments', 1, 'standings', 4])?.isInvalidated).toBe(true)
    expect(qc.getQueryState(['tournaments', 1, 'rounds', 4])?.isInvalidated).toBe(true)
    expect(qc.getQueryState(['tournaments', 1, 'club-standings', 4])?.isInvalidated).toBe(true)
    // Another tournament's data is untouched.
    expect(qc.getQueryState(['tournaments', 2, 'standings', 4])?.isInvalidated).toBe(false)
  })
})
