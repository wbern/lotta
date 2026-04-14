// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GameDto } from '../../types/api'
import { EditScoreDialog } from './EditScoreDialog'

const game: GameDto = {
  boardNr: 1,
  roundNr: 1,
  whitePlayer: { id: 1, name: 'Anna Svensson', club: null, rating: 1500, lotNr: 1 },
  blackPlayer: { id: 2, name: 'Erik Johansson', club: null, rating: 1400, lotNr: 2 },
  resultType: 'NO_RESULT',
  whiteScore: 0,
  blackScore: 0,
  resultDisplay: '',
}

afterEach(cleanup)

describe('EditScoreDialog validation', () => {
  it('shows inline error when scores exceed max points', () => {
    const onSave = vi.fn()

    render(<EditScoreDialog open game={game} pointsPerGame={1} onSave={onSave} onClose={vi.fn()} />)

    const inputs = screen.getAllByRole('textbox')
    fireEvent.change(inputs[0], { target: { value: '1' } })
    fireEvent.change(inputs[1], { target: { value: '1' } })

    fireEvent.click(screen.getByText('Spara'))

    expect(screen.getByTestId('score-error')).toBeTruthy()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('clears error when scores are corrected and saved', () => {
    const onSave = vi.fn()

    render(<EditScoreDialog open game={game} pointsPerGame={1} onSave={onSave} onClose={vi.fn()} />)

    const inputs = screen.getAllByRole('textbox')

    // Trigger error first
    fireEvent.change(inputs[0], { target: { value: '1' } })
    fireEvent.change(inputs[1], { target: { value: '1' } })
    fireEvent.click(screen.getByText('Spara'))
    expect(screen.getByTestId('score-error')).toBeTruthy()

    // Fix scores
    fireEvent.change(inputs[1], { target: { value: '0' } })
    fireEvent.click(screen.getByText('Spara'))

    expect(screen.queryByTestId('score-error')).toBeNull()
    expect(onSave).toHaveBeenCalledWith(1, 0)
  })
})
