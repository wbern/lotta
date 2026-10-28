// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

describe('EditScoreDialog score parsing', () => {
  async function enterScores(white: string, black: string, pointsPerGame = 1) {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(
      <EditScoreDialog
        open
        game={game}
        pointsPerGame={pointsPerGame}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    )
    const [whiteInput, blackInput] = screen.getAllByRole('textbox')
    // Type into white first so both fields are never empty at the same time.
    await user.clear(whiteInput)
    await user.type(whiteInput, white)
    await user.clear(blackInput)
    if (black !== '') await user.type(blackInput, black)
    await user.click(screen.getByRole('button', { name: 'Spara' }))
    return onSave
  }

  it('given a non-numeric score, when Spara is clicked, then an error is shown and nothing is saved', async () => {
    const onSave = await enterScores('abc', '0')

    expect(screen.getByTestId('score-error').textContent).toBe(
      'Ange poängen som tal, t.ex. 1, 0,5 eller 0.',
    )
    expect(onSave).not.toHaveBeenCalled()
  })

  it('given an empty score, when Spara is clicked, then an error is shown and nothing is saved', async () => {
    const onSave = await enterScores('1', '')

    expect(screen.getByTestId('score-error').textContent).toBe(
      'Ange poängen som tal, t.ex. 1, 0,5 eller 0.',
    )
    expect(onSave).not.toHaveBeenCalled()
  })

  it('given scores with a decimal comma, when Spara is clicked, then they are saved as halves', async () => {
    const onSave = await enterScores('0,5', '0,5')

    expect(screen.queryByTestId('score-error')).toBeNull()
    expect(onSave).toHaveBeenCalledWith(0.5, 0.5)
  })

  it('given scores with a decimal point, when Spara is clicked, then they are saved as halves', async () => {
    const onSave = await enterScores('0.5', '0.5')

    expect(onSave).toHaveBeenCalledWith(0.5, 0.5)
  })

  it('given a negative score, when Spara is clicked, then an error is shown and nothing is saved', async () => {
    const onSave = await enterScores('-1', '1')

    expect(screen.getByTestId('score-error').textContent).toBe('Poäng kan inte vara negativa.')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('given a trailing-garbage score like 1x, when Spara is clicked, then an error is shown and nothing is saved', async () => {
    const onSave = await enterScores('1x', '0')

    expect(screen.getByTestId('score-error')).toBeTruthy()
    expect(onSave).not.toHaveBeenCalled()
  })
})
