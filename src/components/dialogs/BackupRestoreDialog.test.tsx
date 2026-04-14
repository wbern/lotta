// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BackupRestoreDialog } from './BackupRestoreDialog'

afterEach(cleanup)

describe('BackupRestoreDialog', () => {
  it('renders password input and submit button', () => {
    render(<BackupRestoreDialog open onClose={vi.fn()} onSubmit={vi.fn()} />)

    expect(screen.getByTestId('restore-password')).not.toBeNull()
    expect(screen.getByTestId('restore-submit')).not.toBeNull()
  })

  it('focuses password input when opened', () => {
    render(<BackupRestoreDialog open onClose={vi.fn()} onSubmit={vi.fn()} />)

    expect(document.activeElement).toBe(screen.getByTestId('restore-password'))
  })

  it('disables submit when password is empty', () => {
    render(<BackupRestoreDialog open onClose={vi.fn()} onSubmit={vi.fn()} />)

    const button = screen.getByTestId('restore-submit') as HTMLButtonElement
    expect(button.disabled).toBe(true)
  })

  it('calls onSubmit with password when submitted', () => {
    const onSubmit = vi.fn()
    render(<BackupRestoreDialog open onClose={vi.fn()} onSubmit={onSubmit} />)

    fireEvent.change(screen.getByTestId('restore-password'), {
      target: { value: 'my-pass' },
    })
    fireEvent.click(screen.getByTestId('restore-submit'))

    expect(onSubmit).toHaveBeenCalledWith('my-pass')
  })

  it('shows error message when provided', () => {
    render(<BackupRestoreDialog open onClose={vi.fn()} onSubmit={vi.fn()} error="Fel lösenord" />)

    expect(screen.getByTestId('restore-error').textContent).toBe('Fel lösenord')
  })

  it('submits on Enter key', () => {
    const onSubmit = vi.fn()
    render(<BackupRestoreDialog open onClose={vi.fn()} onSubmit={onSubmit} />)

    fireEvent.change(screen.getByTestId('restore-password'), {
      target: { value: 'pw' },
    })
    fireEvent.submit(screen.getByTestId('restore-password'))

    expect(onSubmit).toHaveBeenCalledWith('pw')
  })

  it('associates label with password input', () => {
    render(<BackupRestoreDialog open onClose={vi.fn()} onSubmit={vi.fn()} />)

    expect(screen.getByLabelText('Lösenord')).toBe(screen.getByTestId('restore-password'))
  })
})
