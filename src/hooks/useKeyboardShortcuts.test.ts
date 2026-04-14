// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'

function fireKeydown(opts: KeyboardEventInit) {
  document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...opts }))
}

describe('useKeyboardShortcuts', () => {
  afterEach(() => {
    cleanup()
  })

  it('calls onUndo on Ctrl+Z', () => {
    const onUndo = vi.fn()
    const onRedo = vi.fn()
    renderHook(() => useKeyboardShortcuts({ onUndo, onRedo }))

    fireKeydown({ key: 'z', ctrlKey: true })

    expect(onUndo).toHaveBeenCalledOnce()
    expect(onRedo).not.toHaveBeenCalled()
  })

  it('calls onRedo on Ctrl+Y', () => {
    const onUndo = vi.fn()
    const onRedo = vi.fn()
    renderHook(() => useKeyboardShortcuts({ onUndo, onRedo }))

    fireKeydown({ key: 'y', ctrlKey: true })

    expect(onRedo).toHaveBeenCalledOnce()
    expect(onUndo).not.toHaveBeenCalled()
  })

  it('calls onRedo on Ctrl+Shift+Z', () => {
    const onUndo = vi.fn()
    const onRedo = vi.fn()
    renderHook(() => useKeyboardShortcuts({ onUndo, onRedo }))

    fireKeydown({ key: 'z', ctrlKey: true, shiftKey: true })

    expect(onRedo).toHaveBeenCalledOnce()
    expect(onUndo).not.toHaveBeenCalled()
  })

  it('calls onUndo on Meta+Z (macOS)', () => {
    const onUndo = vi.fn()
    const onRedo = vi.fn()
    renderHook(() => useKeyboardShortcuts({ onUndo, onRedo }))

    fireKeydown({ key: 'z', metaKey: true })

    expect(onUndo).toHaveBeenCalledOnce()
  })

  it('skips shortcuts when focus is on an INPUT element', () => {
    const onUndo = vi.fn()
    const onRedo = vi.fn()
    renderHook(() => useKeyboardShortcuts({ onUndo, onRedo }))

    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }))

    expect(onUndo).not.toHaveBeenCalled()
    document.body.removeChild(input)
  })

  it('skips shortcuts when focus is on a TEXTAREA element', () => {
    const onUndo = vi.fn()
    const onRedo = vi.fn()
    renderHook(() => useKeyboardShortcuts({ onUndo, onRedo }))

    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    textarea.focus()

    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }))

    expect(onUndo).not.toHaveBeenCalled()
    document.body.removeChild(textarea)
  })

  it('skips shortcuts when focus is on a contentEditable element', () => {
    const onUndo = vi.fn()
    const onRedo = vi.fn()
    renderHook(() => useKeyboardShortcuts({ onUndo, onRedo }))

    const div = document.createElement('div')
    div.contentEditable = 'true'
    // jsdom may not implement isContentEditable correctly, so ensure it
    Object.defineProperty(div, 'isContentEditable', { get: () => true })
    document.body.appendChild(div)
    div.focus()

    div.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }))

    expect(onUndo).not.toHaveBeenCalled()
    document.body.removeChild(div)
  })

  it('removes listener on unmount', () => {
    const onUndo = vi.fn()
    const onRedo = vi.fn()
    const { unmount } = renderHook(() => useKeyboardShortcuts({ onUndo, onRedo }))

    unmount()

    fireKeydown({ key: 'z', ctrlKey: true })

    expect(onUndo).not.toHaveBeenCalled()
  })

  it('ignores plain Z without modifier', () => {
    const onUndo = vi.fn()
    const onRedo = vi.fn()
    renderHook(() => useKeyboardShortcuts({ onUndo, onRedo }))

    fireKeydown({ key: 'z' })

    expect(onUndo).not.toHaveBeenCalled()
    expect(onRedo).not.toHaveBeenCalled()
  })
})
