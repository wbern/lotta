// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockPlayer } from '../../test/mock-player'
import { PlayerPoolDialog } from './PlayerPoolDialog'

const mockMutate = vi.fn()
const mockMutation = { mutate: mockMutate, mutateAsync: vi.fn() }

const testPlayer = mockPlayer({ id: 1, firstName: 'Anna', lastName: 'Svensson', ratingI: 1500 })
const testPlayer2 = mockPlayer({ id: 2, firstName: 'Karl', lastName: 'Nilsson', ratingI: 1700 })

const mockBatchDeleteMutate = vi.fn()
const mockBatchDeleteMutation = { mutate: mockBatchDeleteMutate, mutateAsync: vi.fn() }

vi.mock('../../hooks/usePlayers', () => ({
  usePoolPlayers: () => ({ data: [testPlayer, testPlayer2] }),
  useAddPoolPlayer: () => mockMutation,
  useUpdatePoolPlayer: () => mockMutation,
  useDeletePoolPlayers: () => mockBatchDeleteMutation,
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
  render(<PlayerPoolDialog open onClose={vi.fn()} />)
}

describe('PlayerPoolDialog default sort', () => {
  it('sorts pool players by first name, not last name', () => {
    renderDialog()
    const rows = screen.getAllByTestId('data-table')[0].querySelectorAll('tbody tr')
    expect(rows[0].textContent).toContain('Svensson, Anna')
    expect(rows[1].textContent).toContain('Nilsson, Karl')
  })
})

describe('PlayerPoolDialog reset button', () => {
  it('shows "Återställ" button label instead of "Ny spelare"', () => {
    renderDialog()
    fireEvent.click(screen.getByText('Skapa eller editera spelare'))

    expect(screen.getByText('Återställ')).toBeTruthy()
    expect(screen.queryByText('Ny spelare')).toBeNull()
  })
})

describe('PlayerPoolDialog update validation', () => {
  it('shows error when updating player with empty names', () => {
    renderDialog()

    // Select the existing player in the pool table
    fireEvent.click(screen.getByText('Svensson, Anna'))

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

describe('PlayerPoolDialog add validation', () => {
  it('shows error when adding player without any name', () => {
    renderDialog()
    fireEvent.click(screen.getByText('Skapa eller editera spelare'))

    const addButtons = screen.getAllByText('Lägg till')
    const playerAddButton = addButtons.find((b) => b.classList.contains('btn-primary'))!
    fireEvent.click(playerAddButton)

    expect(screen.getByTestId('name-error')).toBeTruthy()
    expect(mockMutate).not.toHaveBeenCalled()
  })
})

describe('PlayerPoolDialog multi-select', () => {
  it('plain click selects only that pool player', () => {
    renderDialog()

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

  it('calls batch delete with all selected pool players', () => {
    renderDialog()

    fireEvent.click(screen.getByText('Svensson, Anna'))
    fireEvent.click(screen.getByText('Nilsson, Karl'), { shiftKey: true })
    fireEvent.click(screen.getByTestId('delete-from-pool'))

    expect(mockBatchDeleteMutate).toHaveBeenCalledTimes(1)
    const [ids] = mockBatchDeleteMutate.mock.calls[0]
    expect(ids.sort()).toEqual([1, 2])
  })

  it('disables delete button when no players selected', () => {
    renderDialog()

    const deleteButton = screen.getByTestId('delete-from-pool') as HTMLButtonElement
    expect(deleteButton.disabled).toBe(true)
  })
})
