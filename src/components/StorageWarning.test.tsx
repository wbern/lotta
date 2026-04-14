// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetClientStore, setShareMode } from '../stores/client-p2p-store'
import { StorageWarning } from './StorageWarning'

describe('StorageWarning', () => {
  const originalLocation = window.location

  beforeEach(() => {
    resetClientStore()
    localStorage.clear()
    Object.defineProperty(navigator, 'storage', {
      value: { persist: () => Promise.resolve(false) },
      configurable: true,
    })
    Object.defineProperty(window, 'matchMedia', {
      value: () => ({ matches: false }),
      configurable: true,
    })
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, pathname: '/' },
      configurable: true,
    })
  })

  afterEach(cleanup)

  it('does not show when shareMode is set', async () => {
    setShareMode('view')
    await act(async () => {
      render(<StorageWarning />)
    })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('does not show on /live/ routes', async () => {
    Object.defineProperty(window, 'location', {
      value: { ...window.location, pathname: '/live/ABC123' },
      configurable: true,
    })
    await act(async () => {
      render(<StorageWarning />)
    })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('hides warning when shareMode is set after mount', async () => {
    await act(async () => {
      render(<StorageWarning />)
    })
    // Warning should be visible initially (persistence not granted)
    expect(screen.getByRole('alert')).toBeTruthy()

    // P2P connection establishes — shareMode set late
    act(() => {
      setShareMode('full')
    })
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
