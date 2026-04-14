// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Dialog } from './Dialog'

afterEach(cleanup)

describe('Dialog overlay close behavior', () => {
  it('calls onClose when clicking overlay and isDirty is false', () => {
    const onClose = vi.fn()
    render(
      <Dialog title="Test" open onClose={onClose}>
        <p>Content</p>
      </Dialog>,
    )

    fireEvent.click(screen.getByTestId('dialog-overlay'))
    expect(onClose).toHaveBeenCalled()
  })

  it('does not call onClose when clicking overlay and isDirty is true', () => {
    const onClose = vi.fn()
    render(
      <Dialog title="Test" open onClose={onClose} isDirty>
        <p>Content</p>
      </Dialog>,
    )

    fireEvent.click(screen.getByTestId('dialog-overlay'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes on Escape when isDirty is false', () => {
    const onClose = vi.fn()
    render(
      <Dialog title="Test" open onClose={onClose}>
        <p>Content</p>
      </Dialog>,
    )

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('does not close on Escape when isDirty is true', () => {
    const onClose = vi.fn()
    render(
      <Dialog title="Test" open onClose={onClose} isDirty>
        <p>Content</p>
      </Dialog>,
    )

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })
})
