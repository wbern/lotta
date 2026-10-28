// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'

afterEach(cleanup)

describe('ConfirmDialog typed confirmation', () => {
  it('disables OK until the user types the required confirmation text', () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog
        open
        title="Radera turnering"
        message="Detta är destruktivt."
        confirmText="Skol-DM 2026 A"
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    )

    const confirmBtn = screen.getByRole('button', { name: 'OK' }) as HTMLButtonElement
    expect(confirmBtn.disabled).toBe(true)

    const input = screen.getByTestId('confirm-text-input')
    fireEvent.change(input, { target: { value: 'Skol-DM 2026 A' } })

    expect(confirmBtn.disabled).toBe(false)
    fireEvent.click(confirmBtn)
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('keeps OK disabled when typed text is a near-miss', () => {
    render(
      <ConfirmDialog
        open
        title="Radera turnering"
        message="Detta är destruktivt."
        confirmText="Skol-DM 2026 A"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    )

    const confirmBtn = screen.getByRole('button', { name: 'OK' }) as HTMLButtonElement
    const input = screen.getByTestId('confirm-text-input')
    fireEvent.change(input, { target: { value: 'Skol-DM 2026' } })
    expect(confirmBtn.disabled).toBe(true)
  })

  it('tolerates leading/trailing whitespace in the typed value', () => {
    render(
      <ConfirmDialog
        open
        title="Radera turnering"
        message="Detta är destruktivt."
        confirmText="Skol-DM 2026 A"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    )

    const confirmBtn = screen.getByRole('button', { name: 'OK' }) as HTMLButtonElement
    const input = screen.getByTestId('confirm-text-input')
    fireEvent.change(input, { target: { value: '  Skol-DM 2026 A  ' } })
    expect(confirmBtn.disabled).toBe(false)
  })
})

describe('ConfirmDialog button labels', () => {
  it('given no labels, when rendered, then the buttons read OK and Cancel', () => {
    render(<ConfirmDialog open title="T" message="M" onConfirm={() => {}} onCancel={() => {}} />)

    expect(screen.getByRole('button', { name: 'OK' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDefined()
  })

  it('given custom labels, when the user clicks them, then each label triggers its own handler', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <ConfirmDialog
        open
        title="Återställ databas"
        message="M"
        confirmLabel="Välj fil…"
        cancelLabel="Avbryt"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )

    expect(screen.queryByRole('button', { name: 'OK' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Avbryt' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Välj fil…' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})
