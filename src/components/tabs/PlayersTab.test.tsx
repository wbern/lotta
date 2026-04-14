// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockPlayer } from '../../test/mock-player'
import { PlayersTab } from './PlayersTab'

const activePlayer = mockPlayer({
  id: 300,
  firstName: 'Erik',
  lastName: 'Johansson',
  club: 'SK Alfa',
  ratingN: 1500,
})
const withdrawnPlayer = mockPlayer({
  id: 301,
  firstName: 'Siv',
  lastName: 'Åberg',
  club: 'SK Gamma',
  ratingN: 1400,
  withdrawnFromRound: 2,
})

vi.mock('../../hooks/useTournamentPlayers', () => ({
  useTournamentPlayers: () => ({ data: [activePlayer, withdrawnPlayer], isLoading: false }),
}))

afterEach(() => {
  cleanup()
})

describe('PlayersTab withdrawn players', () => {
  it('shows (utgått rN) marker next to withdrawn player name', () => {
    render(<PlayersTab tournamentId={1} />)

    expect(screen.getByText('Siv Åberg (utgått r2)')).toBeTruthy()
  })
})
