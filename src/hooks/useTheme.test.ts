// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTheme } from './useTheme'

describe('useTheme', () => {
  let matchMediaListeners: Map<string, ((e: MediaQueryListEvent) => void)[]>

  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.style.colorScheme = ''
    matchMediaListeners = new Map()

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn((query: string) => ({
        matches: false,
        media: query,
        addEventListener: (event: string, fn: (e: MediaQueryListEvent) => void) => {
          const key = `${query}:${event}`
          if (!matchMediaListeners.has(key)) matchMediaListeners.set(key, [])
          matchMediaListeners.get(key)!.push(fn)
        },
        removeEventListener: (event: string, fn: (e: MediaQueryListEvent) => void) => {
          const key = `${query}:${event}`
          const listeners = matchMediaListeners.get(key)
          if (listeners) {
            const idx = listeners.indexOf(fn)
            if (idx !== -1) listeners.splice(idx, 1)
          }
        },
      })),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('defaults to system when no localStorage value', () => {
    const { result } = renderHook(() => useTheme())

    expect(result.current.theme).toBe('system')
  })

  it('reads initial theme from localStorage', () => {
    localStorage.setItem('theme', 'dark')

    const { result } = renderHook(() => useTheme())

    expect(result.current.theme).toBe('dark')
  })

  it('sets data-theme attribute when switching to dark', () => {
    const { result } = renderHook(() => useTheme())

    act(() => {
      result.current.setTheme('dark')
    })

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
  })

  it('sets data-theme attribute when switching to light', () => {
    const { result } = renderHook(() => useTheme())

    act(() => {
      result.current.setTheme('light')
    })

    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(document.documentElement.style.colorScheme).toBe('light')
  })

  it('removes data-theme when switching to system', () => {
    document.documentElement.setAttribute('data-theme', 'dark')

    const { result } = renderHook(() => useTheme())

    act(() => {
      result.current.setTheme('system')
    })

    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
    expect(document.documentElement.style.colorScheme).toBe('')
  })

  it('persists choice to localStorage', () => {
    const { result } = renderHook(() => useTheme())

    act(() => {
      result.current.setTheme('dark')
    })

    expect(localStorage.getItem('theme')).toBe('dark')

    act(() => {
      result.current.setTheme('system')
    })

    expect(localStorage.getItem('theme')).toBe('system')
  })
})
