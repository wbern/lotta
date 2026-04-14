// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useOnlineStatus } from './useOnlineStatus'

describe('useOnlineStatus', () => {
  it('returns true when browser is online', () => {
    const { result } = renderHook(() => useOnlineStatus())
    // jsdom defaults navigator.onLine to true
    expect(result.current).toBe(true)
  })

  it('updates to false on offline event', () => {
    const { result } = renderHook(() => useOnlineStatus())

    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true })
      window.dispatchEvent(new Event('offline'))
    })

    expect(result.current).toBe(false)
  })

  it('updates back to true on online event', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true })

    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(false)

    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
      window.dispatchEvent(new Event('online'))
    })

    expect(result.current).toBe(true)
  })

  it('cleans up event listeners on unmount', () => {
    const { unmount } = renderHook(() => useOnlineStatus())

    // Should not throw after unmount
    unmount()

    Object.defineProperty(navigator, 'onLine', { value: false, writable: true })
    window.dispatchEvent(new Event('offline'))
  })
})
