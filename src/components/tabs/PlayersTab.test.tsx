// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockPlayer } from '../../test/mock-player'
import type { PlayerDto } from '../../types/api'
import { PlayersTab } from './PlayersTab'

let mockPlayers: PlayerDto[] = []

vi.mock('../../hooks/useTournamentPlayers', () => ({
  useTournamentPlayers: () => ({ data: mockPlayers, isLoading: false }),
}))

beforeEach(() => {
  mockPlayers = []
})

afterEach(() => {
  cleanup()
})

describe('PlayersTab withdrawn players', () => {
  it('shows (utgått rN) marker next to withdrawn player name', () => {
    mockPlayers = [
      mockPlayer({
        id: 300,
        firstName: 'Erik',
        lastName: 'Johansson',
        club: 'SK Alfa',
        ratingN: 1500,
      }),
      mockPlayer({
        id: 301,
        firstName: 'Siv',
        lastName: 'Åberg',
        club: 'SK Gamma',
        ratingN: 1400,
        withdrawnFromRound: 2,
      }),
    ]
    render(<PlayersTab tournamentId={1} />)

    expect(screen.getByText('Siv Åberg (utgått r2)')).toBeTruthy()
  })
})

describe('PlayersTab default sort', () => {
  it('sorts by first name, not last name', () => {
    mockPlayers = [
      mockPlayer({ id: 1, firstName: 'Björn', lastName: 'Andersson' }),
      mockPlayer({ id: 2, firstName: 'Adam', lastName: 'Öberg' }),
    ]
    render(<PlayersTab tournamentId={1} />)

    const rows = within(screen.getByTestId('data-table')).getAllByRole('row')
    const bodyRows = rows.slice(1)
    expect(bodyRows[0].textContent).toContain('Adam Öberg')
    expect(bodyRows[1].textContent).toContain('Björn Andersson')
  })
})

describe('PlayersTab rating column', () => {
  // The column must show the rating the tournament actually uses (same as
  // Lottning and Ställning), not the national rating no form can fill in.
  const players = () => [
    mockPlayer({
      id: 1,
      firstName: 'Dan',
      lastName: 'Dahl',
      ratingI: 2105,
      ratingB: 2080,
      ratingN: 0,
    }),
    mockPlayer({ id: 2, firstName: 'Bo', lastName: 'Berg', ratingI: 1900, ratingB: 0, ratingN: 0 }),
    mockPlayer({
      id: 3,
      firstName: 'Cia',
      lastName: 'Carlsson',
      ratingI: 1700,
      ratingB: 1990,
      ratingN: 0,
    }),
  ]
  const ratingCells = () =>
    within(screen.getByTestId('data-table'))
      .getAllByRole('row')
      .slice(1)
      .map((row) => {
        const cells = within(row).getAllByRole('cell')
        return [cells[1].textContent, cells[cells.length - 1].textContent]
      })

  it('given rating choice "Blixt-ELO annars ELO", then each player shows blitz rating, falling back to ELO', () => {
    mockPlayers = players()
    render(<PlayersTab tournamentId={1} showELO ratingChoice="BLITZ_THEN_ELO" />)

    expect(ratingCells()).toEqual([
      ['Bo Berg', '1900'],
      ['Cia Carlsson', '1990'],
      ['Dan Dahl', '2080'],
    ])
  })

  it('given rating choice ELO, then each player shows their ELO rating', () => {
    mockPlayers = players()
    render(<PlayersTab tournamentId={1} showELO ratingChoice="ELO" />)

    expect(ratingCells()).toEqual([
      ['Bo Berg', '1900'],
      ['Cia Carlsson', '1700'],
      ['Dan Dahl', '2105'],
    ])
  })

  it('given rating choice "Blixt-ELO annars ELO", when sorting by Rating, then the order follows the shown ratings', async () => {
    mockPlayers = players()
    render(<PlayersTab tournamentId={1} showELO ratingChoice="BLITZ_THEN_ELO" />)

    fireEvent.click(screen.getByText('Rating'))

    expect(ratingCells().map(([, r]) => r)).toEqual(['1900', '1990', '2080'])
  })
})
