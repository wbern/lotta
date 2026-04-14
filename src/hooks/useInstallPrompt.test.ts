// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// Must reset module state between tests since deferredPrompt is module-scoped
let useInstallPrompt: typeof import('./useInstallPrompt').useInstallPrompt

function createPromptEvent(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = new Event('beforeinstallprompt', { cancelable: true })
  Object.assign(event, {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome }),
  })
  return event as Event & {
    prompt: ReturnType<typeof vi.fn>
    userChoice: Promise<{ outcome: string }>
  }
}

describe('useInstallPrompt', () => {
  afterEach(() => {
    vi.resetModules()
  })

  it('starts with canInstall false when no event has fired', async () => {
    const mod = await import('./useInstallPrompt')
    useInstallPrompt = mod.useInstallPrompt

    const { result } = renderHook(() => useInstallPrompt())
    expect(result.current.canInstall).toBe(false)
  })

  it('captures beforeinstallprompt event fired after mount', async () => {
    const mod = await import('./useInstallPrompt')
    useInstallPrompt = mod.useInstallPrompt

    const { result } = renderHook(() => useInstallPrompt())
    expect(result.current.canInstall).toBe(false)

    const event = createPromptEvent()
    act(() => {
      window.dispatchEvent(event)
    })

    expect(result.current.canInstall).toBe(true)
  })

  it('calls prompt() and clears state on accepted install', async () => {
    const mod = await import('./useInstallPrompt')
    useInstallPrompt = mod.useInstallPrompt

    const event = createPromptEvent('accepted')
    const { result } = renderHook(() => useInstallPrompt())

    act(() => {
      window.dispatchEvent(event)
    })
    expect(result.current.canInstall).toBe(true)

    await act(async () => {
      await result.current.install()
    })

    expect(event.prompt).toHaveBeenCalledOnce()
    expect(result.current.canInstall).toBe(false)
  })

  it('clears state on dismissed install (prompt is single-use)', async () => {
    const mod = await import('./useInstallPrompt')
    useInstallPrompt = mod.useInstallPrompt

    const event = createPromptEvent('dismissed')
    const { result } = renderHook(() => useInstallPrompt())

    act(() => {
      window.dispatchEvent(event)
    })
    expect(result.current.canInstall).toBe(true)

    await act(async () => {
      await result.current.install()
    })

    expect(event.prompt).toHaveBeenCalledOnce()
    expect(result.current.canInstall).toBe(false)
  })

  it('install() is a no-op when no event is captured', async () => {
    const mod = await import('./useInstallPrompt')
    useInstallPrompt = mod.useInstallPrompt

    const { result } = renderHook(() => useInstallPrompt())

    // Should not throw
    await act(async () => {
      await result.current.install()
    })

    expect(result.current.canInstall).toBe(false)
  })

  it('captures event fired between module load and hook mount', async () => {
    // Import the module (registers the module-scope listener)
    const mod = await import('./useInstallPrompt')
    useInstallPrompt = mod.useInstallPrompt

    // Fire the event BEFORE any hook mounts — the module-scope listener catches it
    const event = createPromptEvent()
    window.dispatchEvent(event)

    // Hook should initialize with canInstall true from deferred prompt
    const { result } = renderHook(() => useInstallPrompt())
    expect(result.current.canInstall).toBe(true)
  })
})
