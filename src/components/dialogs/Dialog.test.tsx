// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Dialog } from './Dialog'
import { isAnyModalOpen } from './modal-registry'

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

describe('Dialog modal registry', () => {
  it('given a dialog is open, when queried, then isAnyModalOpen is true; and after it closes, then false', () => {
    const { rerender } = render(
      <Dialog title="Test" open onClose={() => {}}>
        <p>Content</p>
      </Dialog>,
    )
    expect(isAnyModalOpen()).toBe(true)

    rerender(
      <Dialog title="Test" open={false} onClose={() => {}}>
        <p>Content</p>
      </Dialog>,
    )
    expect(isAnyModalOpen()).toBe(false)
  })

  it('given a closed dialog is mounted, when queried, then isAnyModalOpen is false', () => {
    render(
      <Dialog title="Test" open={false} onClose={() => {}}>
        <p>Content</p>
      </Dialog>,
    )
    expect(isAnyModalOpen()).toBe(false)
  })

  it('given an open dialog, when it unmounts, then isAnyModalOpen is false', () => {
    const { unmount } = render(
      <Dialog title="Test" open onClose={() => {}}>
        <p>Content</p>
      </Dialog>,
    )
    unmount()
    expect(isAnyModalOpen()).toBe(false)
  })
})
