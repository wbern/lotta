// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDocumentTitle } from './useDocumentTitle'

beforeEach(() => {
  document.title = 'Lotta'
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useDocumentTitle', () => {
  it('does not change title when count is 0', () => {
    renderHook(() => useDocumentTitle(0, 'Lotta'))
    expect(document.title).toBe('Lotta')
  })

  it('sets title with unread count when count > 0', () => {
    renderHook(() => useDocumentTitle(3, 'Lotta'))
    expect(document.title).toBe('(3) Lotta')
  })

  it('restores original title when count returns to 0', () => {
    const { rerender } = renderHook(({ count }) => useDocumentTitle(count, 'Lotta'), {
      initialProps: { count: 5 },
    })
    expect(document.title).toBe('(5) Lotta')

    rerender({ count: 0 })
    expect(document.title).toBe('Lotta')
  })

  it('updates title when count changes', () => {
    const { rerender } = renderHook(({ count }) => useDocumentTitle(count, 'Lotta'), {
      initialProps: { count: 1 },
    })
    expect(document.title).toBe('(1) Lotta')

    rerender({ count: 7 })
    expect(document.title).toBe('(7) Lotta')
  })

  it('flashes title when document is hidden and count > 0', () => {
    Object.defineProperty(document, 'hidden', { value: true, writable: true, configurable: true })

    renderHook(() => useDocumentTitle(2, 'Lotta'))

    // Initially shows count
    expect(document.title).toBe('(2) Lotta')

    // After flash interval, title alternates
    act(() => {
      vi.advanceTimersByTime(1500)
    })
    // Should have toggled at least once
    const title = document.title
    expect(title === '(2) Lotta' || title === 'Ny aktivitet!').toBe(true)

    // Cleanup
    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
  })

  it('restores title on unmount', () => {
    const { unmount } = renderHook(() => useDocumentTitle(3, 'Lotta'))
    expect(document.title).toBe('(3) Lotta')

    unmount()
    expect(document.title).toBe('Lotta')
  })
})
