// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockPlayer } from '../../test/mock-player'
import { TournamentPlayersDialog } from './TournamentPlayersDialog'

const poolPlayer = mockPlayer({
  id: 100,
  firstName: 'Anna',
  lastName: 'Svensson',
  club: 'SK Alfa',
  clubIndex: 1,
  ratingI: 1500,
})
const poolPlayer2 = mockPlayer({
  id: 101,
  firstName: 'Karl',
  lastName: 'Nilsson',
  club: 'SK Beta',
  clubIndex: 2,
  ratingI: 1700,
})
const tournamentPlayer = mockPlayer({
  id: 200,
  firstName: 'Erik',
  lastName: 'Johansson',
  club: 'SK Alfa',
  clubIndex: 1,
  ratingI: 1500,
})
const tournamentPlayer2 = mockPlayer({
  id: 201,
  firstName: 'Lisa',
  lastName: 'Persson',
  club: 'SK Alfa',
  clubIndex: 1,
  ratingI: 1600,
})
const withdrawnPlayer = mockPlayer({
  id: 202,
  firstName: 'Siv',
  lastName: 'Åberg',
  club: 'SK Gamma',
  clubIndex: 3,
  ratingI: 1400,
  withdrawnFromRound: 2,
})

const mockMutate = vi.fn()
const mockMutation = { mutate: mockMutate, mutateAsync: vi.fn() }
const mockBatchMutate = vi.fn()
const mockBatchMutation = { mutate: mockBatchMutate, mutateAsync: vi.fn() }

const mockBatchRemoveMutate = vi.fn()
const mockBatchRemoveMutation = { mutate: mockBatchRemoveMutate, mutateAsync: vi.fn() }

vi.mock('../../hooks/useTournamentPlayers', () => ({
  useTournamentPlayers: () => ({ data: [tournamentPlayer, tournamentPlayer2, withdrawnPlayer] }),
  useAddTournamentPlayer: () => mockMutation,
  useAddTournamentPlayers: () => mockBatchMutation,
  useUpdateTournamentPlayer: () => mockMutation,
  useRemoveTournamentPlayers: () => mockBatchRemoveMutation,
}))

vi.mock('../../hooks/usePlayers', () => ({
  usePoolPlayers: () => ({ data: [poolPlayer, poolPlayer2] }),
}))

vi.mock('../../hooks/useClubs', () => ({
  useClubs: () => ({ data: [] }),
  useAddClub: () => mockMutation,
  useRenameClub: () => mockMutation,
  useDeleteClub: () => mockMutation,
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function renderDialog() {
  render(<TournamentPlayersDialog open tournamentId={1} tournamentName="Test" onClose={vi.fn()} />)
}

describe('TournamentPlayersDialog default sort', () => {
  it('sorts pool players by first name, not last name', () => {
    renderDialog()
    fireEvent.click(screen.getByText('Spelarpool'))

    const rows = screen.getByTestId('data-table').querySelectorAll('tbody tr')
    expect(rows[0].textContent).toContain('Svensson, Anna')
    expect(rows[1].textContent).toContain('Nilsson, Karl')
  })
})

describe('TournamentPlayersDialog reset button', () => {
  it('shows "Återställ" button label instead of "Ny spelare"', () => {
    renderDialog()
    fireEvent.click(screen.getByText('Skapa eller editera spelare'))

    expect(screen.getByText('Återställ')).toBeTruthy()
    expect(screen.queryByText('Ny spelare')).toBeNull()
  })
})

describe('TournamentPlayersDialog update validation', () => {
  it('shows error when updating player with empty names', () => {
    renderDialog()

    // Select the tournament player
    fireEvent.click(screen.getByText('Johansson, Erik'))

    // Switch to edit tab
    fireEvent.click(screen.getByText('Skapa eller editera spelare'))

    // Clear both name fields
    fireEvent.change(screen.getByTestId('first-name-input'), { target: { value: '' } })
    fireEvent.change(screen.getByTestId('last-name-input'), { target: { value: '' } })

    // Click update button
    fireEvent.click(screen.getByTestId('update-player'))

    expect(screen.getByTestId('name-error')).toBeTruthy()
    expect(mockMutate).not.toHaveBeenCalled()
  })
})

describe('TournamentPlayersDialog pool tab', () => {
  it('shows add-to-tournament button with descriptive label', () => {
    renderDialog()
    fireEvent.click(screen.getByText('Spelarpool'))

    const addButton = screen.getByTestId('add-from-pool')
    expect(addButton.textContent).toBe('Lägg till i turneringen')
  })

  it('disables add-from-pool button when no pool player is selected', () => {
    renderDialog()
    fireEvent.click(screen.getByText('Spelarpool'))

    const addButton = screen.getByTestId('add-from-pool') as HTMLButtonElement
    expect(addButton.disabled).toBe(true)
  })
})

describe('TournamentPlayersDialog pool multi-select', () => {
  it('plain click selects only that pool player', () => {
    renderDialog()
    fireEvent.click(screen.getByText('Spelarpool'))

    const rowA = screen.getByText('Svensson, Anna').closest('tr')!
    const rowB = screen.getByText('Nilsson, Karl').closest('tr')!

    fireEvent.click(rowA)
    expect(rowA.className).toContain('selected')
    expect(rowB.className).not.toContain('selected')

    // Plain click on B replaces selection
    fireEvent.click(rowB)
    expect(rowA.className).not.toContain('selected')
    expect(rowB.className).toContain('selected')
  })

  it('calls batch mutate with all selected pool players', () => {
    renderDialog()
    fireEvent.click(screen.getByText('Spelarpool'))

    fireEvent.click(screen.getByText('Svensson, Anna'))
    fireEvent.click(screen.getByText('Nilsson, Karl'), { shiftKey: true })
    fireEvent.click(screen.getByTestId('add-from-pool'))

    expect(mockBatchMutate).toHaveBeenCalledTimes(1)
    const [players] = mockBatchMutate.mock.calls[0]
    expect(players).toHaveLength(2)
    expect(players.map((p: { lastName: string }) => p.lastName).sort()).toEqual([
      'Nilsson',
      'Svensson',
    ])
  })
})

describe('TournamentPlayersDialog withdrawn players', () => {
  it('shows (utgått rN) marker next to withdrawn player in tournament tab', () => {
    renderDialog()

    expect(screen.getByText('Åberg, Siv (utgått r2)')).toBeTruthy()
  })
})

describe('TournamentPlayersDialog tournament multi-select', () => {
  it('plain click selects only that tournament player', () => {
    renderDialog()

    const rowA = screen.getByText('Johansson, Erik').closest('tr')!
    const rowB = screen.getByText('Persson, Lisa').closest('tr')!

    fireEvent.click(rowA)
    expect(rowA.className).toContain('selected')

    // Plain click on B replaces selection
    fireEvent.click(rowB)
    expect(rowA.className).not.toContain('selected')
    expect(rowB.className).toContain('selected')
  })

  it('calls batch remove with all selected tournament players', () => {
    renderDialog()

    fireEvent.click(screen.getByText('Johansson, Erik'))
    fireEvent.click(screen.getByText('Persson, Lisa'), { shiftKey: true })
    fireEvent.click(screen.getByTestId('remove-player'))

    expect(mockBatchRemoveMutate).toHaveBeenCalledTimes(1)
    const [ids] = mockBatchRemoveMutate.mock.calls[0]
    expect(ids.sort()).toEqual([200, 201])
  })
})
