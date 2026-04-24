import { beforeEach, describe, expect, it } from 'vitest'
import { getLiveContext, setLiveContext } from './live-context'

describe('live-context', () => {
  beforeEach(() => {
    setLiveContext(null)
  })

  it('round-trips sharedTournamentIds and includeFutureTournaments', () => {
    setLiveContext({
      tournamentId: 7,
      round: 3,
      sharedTournamentIds: [7, 9],
      includeFutureTournaments: true,
    })
    expect(getLiveContext()).toEqual({
      tournamentId: 7,
      round: 3,
      sharedTournamentIds: [7, 9],
      includeFutureTournaments: true,
    })
  })
})
