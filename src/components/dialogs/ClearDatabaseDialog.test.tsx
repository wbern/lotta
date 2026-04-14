// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ClearDatabaseDialog } from './ClearDatabaseDialog'

afterEach(cleanup)

describe('ClearDatabaseDialog', () => {
  it('renders title, warning message, input, and disabled confirm button when open', () => {
    render(<ClearDatabaseDialog open onClose={vi.fn()} onConfirm={vi.fn()} />)

    expect(screen.getByTestId('dialog-title').textContent).toBe('Rensa databas')
    expect(screen.getByText(/raderar alla turneringar/)).not.toBeNull()
    expect(screen.getByTestId('clear-db-input')).not.toBeNull()

    const confirmBtn = screen.getByTestId('clear-db-confirm') as HTMLButtonElement
    expect(confirmBtn.disabled).toBe(true)
  })

  it('enables confirm button only when input equals "Ja"', () => {
    render(<ClearDatabaseDialog open onClose={vi.fn()} onConfirm={vi.fn()} />)

    const input = screen.getByTestId('clear-db-input')
    const confirmBtn = screen.getByTestId('clear-db-confirm') as HTMLButtonElement

    fireEvent.change(input, { target: { value: 'Nej' } })
    expect(confirmBtn.disabled).toBe(true)

    fireEvent.change(input, { target: { value: 'ja' } })
    expect(confirmBtn.disabled).toBe(true)

    fireEvent.change(input, { target: { value: 'Ja' } })
    expect(confirmBtn.disabled).toBe(false)
  })

  it('calls onConfirm when confirm button is clicked after typing "Ja"', () => {
    const onConfirm = vi.fn()
    render(<ClearDatabaseDialog open onClose={vi.fn()} onConfirm={onConfirm} />)

    fireEvent.change(screen.getByTestId('clear-db-input'), { target: { value: 'Ja' } })
    fireEvent.click(screen.getByTestId('clear-db-confirm'))

    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('resets input when dialog is reopened', () => {
    const { rerender } = render(<ClearDatabaseDialog open onClose={vi.fn()} onConfirm={vi.fn()} />)

    fireEvent.change(screen.getByTestId('clear-db-input'), { target: { value: 'Ja' } })

    // Close
    rerender(<ClearDatabaseDialog open={false} onClose={vi.fn()} onConfirm={vi.fn()} />)

    // Reopen
    rerender(<ClearDatabaseDialog open onClose={vi.fn()} onConfirm={vi.fn()} />)

    const input = screen.getByTestId('clear-db-input') as HTMLInputElement
    expect(input.value).toBe('')

    const confirmBtn = screen.getByTestId('clear-db-confirm') as HTMLButtonElement
    expect(confirmBtn.disabled).toBe(true)
  })

  it('calls onClose when Avbryt button is clicked', () => {
    const onClose = vi.fn()
    render(<ClearDatabaseDialog open onClose={onClose} onConfirm={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Avbryt' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
