// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { mountRecovery } from './mount-recovery'

function fakeDiagnostics() {
  return {
    version: 'v1.2.3',
    commit: 'abc1234',
    userAgent: 'Mozilla/5.0',
    timestamp: '2026-05-28T10:00:00.000Z',
    swCount: 1,
    swScopes: ['https://lotta.app/'],
    caches: [{ name: 'workbox-precache', entryCount: 12 }],
    storage: { quota: 1000, usage: 200 },
  }
}

function buildDeps(overrides: Partial<Parameters<typeof mountRecovery>[1]> = {}) {
  return {
    countdownFrom: 10,
    startCountdown: vi.fn(() => () => {}),
    clearCaches: vi.fn().mockResolvedValue(undefined),
    unregisterSWs: vi.fn().mockResolvedValue(undefined),
    nukeAndReload: vi.fn().mockResolvedValue(undefined),
    leavePage: vi.fn(),
    downloadBackup: vi.fn().mockResolvedValue(undefined),
    getDiagnostics: vi.fn().mockResolvedValue(fakeDiagnostics()),
    copyDiagnostics: vi.fn().mockResolvedValue(undefined),
    isIosStandalone: () => false,
    ...overrides,
  }
}

describe('mountRecovery', () => {
  it('does not auto-start the countdown on mount', () => {
    const root = document.createElement('div')
    const startCountdown = vi.fn(() => () => {})

    mountRecovery(root, buildDeps({ startCountdown }))

    expect(startCountdown).not.toHaveBeenCalled()
    const panel = root.querySelector<HTMLElement>('[data-testid="recovery-countdown-panel"]')
    expect(panel?.hidden).toBe(true)
  })

  it('copy-diagnostics button calls deps.copyDiagnostics', () => {
    const root = document.createElement('div')
    const copyDiagnostics = vi.fn().mockResolvedValue(undefined)

    mountRecovery(root, buildDeps({ copyDiagnostics }))

    const btn = root.querySelector<HTMLButtonElement>('[data-testid="recovery-copy-diag"]')
    btn?.click()
    expect(copyDiagnostics).toHaveBeenCalledTimes(1)
  })

  it('renders the diagnostic panel with version, commit, and cache info', async () => {
    const root = document.createElement('div')

    mountRecovery(root, buildDeps())

    await vi.waitFor(() => {
      const panel = root.querySelector('[data-testid="recovery-diagnostics"]')
      expect(panel?.textContent).toContain('v1.2.3')
      expect(panel?.textContent).toContain('abc1234')
      expect(panel?.textContent).toContain('workbox-precache')
    })
  })

  it('backup button calls deps.downloadBackup', () => {
    const root = document.createElement('div')
    const downloadBackup = vi.fn().mockResolvedValue(undefined)

    mountRecovery(root, buildDeps({ downloadBackup }))

    const btn = root.querySelector<HTMLButtonElement>('[data-testid="recovery-backup"]')
    btn?.click()
    expect(downloadBackup).toHaveBeenCalledTimes(1)
  })

  it('leave-page button calls deps.leavePage', () => {
    const root = document.createElement('div')
    const leavePage = vi.fn()

    mountRecovery(root, buildDeps({ leavePage }))

    const leaveBtn = root.querySelector<HTMLButtonElement>('[data-testid="recovery-leave"]')
    leaveBtn?.click()
    expect(leavePage).toHaveBeenCalledTimes(1)
  })

  it('clear-caches action button starts a countdown that runs clearCaches on completion', () => {
    const root = document.createElement('div')
    const captured: { onComplete: (() => void) | null } = { onComplete: null }
    const startCountdown = vi.fn((opts) => {
      captured.onComplete = opts.onComplete
      return () => {}
    })
    const clearCaches = vi.fn().mockResolvedValue(undefined)

    mountRecovery(root, buildDeps({ startCountdown, clearCaches }))

    const btn = root.querySelector<HTMLButtonElement>(
      '[data-testid="recovery-action-clear-caches"]',
    )
    btn?.click()

    expect(startCountdown).toHaveBeenCalledTimes(1)
    const panel = root.querySelector<HTMLElement>('[data-testid="recovery-countdown-panel"]')
    expect(panel?.hidden).toBe(false)

    captured.onComplete?.()
    expect(clearCaches).toHaveBeenCalledTimes(1)
  })

  it('unregister-sw action button starts a countdown that runs unregisterSWs on completion', () => {
    const root = document.createElement('div')
    const captured: { onComplete: (() => void) | null } = { onComplete: null }
    const startCountdown = vi.fn((opts) => {
      captured.onComplete = opts.onComplete
      return () => {}
    })
    const unregisterSWs = vi.fn().mockResolvedValue(undefined)

    mountRecovery(root, buildDeps({ startCountdown, unregisterSWs }))

    const btn = root.querySelector<HTMLButtonElement>(
      '[data-testid="recovery-action-unregister-sw"]',
    )
    btn?.click()
    captured.onComplete?.()

    expect(unregisterSWs).toHaveBeenCalledTimes(1)
  })

  it('full-nuke action button starts a countdown that runs nukeAndReload on completion', () => {
    const root = document.createElement('div')
    const captured: { onComplete: (() => void) | null } = { onComplete: null }
    const startCountdown = vi.fn((opts) => {
      captured.onComplete = opts.onComplete
      return () => {}
    })
    const nukeAndReload = vi.fn().mockResolvedValue(undefined)

    mountRecovery(root, buildDeps({ startCountdown, nukeAndReload }))

    const btn = root.querySelector<HTMLButtonElement>('[data-testid="recovery-action-nuke"]')
    btn?.click()
    captured.onComplete?.()

    expect(nukeAndReload).toHaveBeenCalledTimes(1)
  })

  it('surfaces an error message when an action throws on completion', async () => {
    const root = document.createElement('div')
    const captured: { onComplete: (() => void) | null } = { onComplete: null }
    const startCountdown = vi.fn((opts) => {
      captured.onComplete = opts.onComplete
      return () => {}
    })
    const clearCaches = vi.fn().mockRejectedValue(new Error('SecurityError'))

    mountRecovery(root, buildDeps({ startCountdown, clearCaches }))

    root.querySelector<HTMLButtonElement>('[data-testid="recovery-action-clear-caches"]')?.click()
    captured.onComplete?.()

    await vi.waitFor(() => {
      const err = root.querySelector<HTMLElement>('[data-testid="recovery-action-error"]')
      expect(err?.hidden).toBe(false)
      expect(err?.textContent).toContain('SecurityError')
    })

    const countdownEl = root.querySelector<HTMLElement>('[data-testid="recovery-countdown"]')
    expect(countdownEl?.hidden).toBe(true)

    const cancelBtn = root.querySelector<HTMLButtonElement>('[data-testid="recovery-cancel"]')
    expect(cancelBtn?.textContent).toBe('Tillbaka')

    const retryBtn = root.querySelector<HTMLButtonElement>('[data-testid="recovery-retry"]')
    expect(retryBtn?.hidden).toBe(false)
  })

  it('retry button after error reruns the same action via a fresh countdown', async () => {
    const root = document.createElement('div')
    const captured: { onComplete: (() => void) | null } = { onComplete: null }
    const startCountdown = vi.fn((opts) => {
      captured.onComplete = opts.onComplete
      return () => {}
    })
    const clearCaches = vi
      .fn()
      .mockRejectedValueOnce(new Error('SecurityError'))
      .mockResolvedValue(undefined)

    mountRecovery(root, buildDeps({ startCountdown, clearCaches }))

    root.querySelector<HTMLButtonElement>('[data-testid="recovery-action-clear-caches"]')?.click()
    captured.onComplete?.()

    await vi.waitFor(() => {
      const retry = root.querySelector<HTMLButtonElement>('[data-testid="recovery-retry"]')
      expect(retry?.hidden).toBe(false)
    })

    root.querySelector<HTMLButtonElement>('[data-testid="recovery-retry"]')?.click()
    expect(startCountdown).toHaveBeenCalledTimes(2)

    const countdownEl = root.querySelector<HTMLElement>('[data-testid="recovery-countdown"]')
    expect(countdownEl?.hidden).toBe(false)
    const err = root.querySelector<HTMLElement>('[data-testid="recovery-action-error"]')
    expect(err?.hidden).toBe(true)
  })

  it('cancel label is Avbryt during active countdown', () => {
    const root = document.createElement('div')
    const startCountdown = vi.fn(() => () => {})

    mountRecovery(root, buildDeps({ startCountdown }))
    root.querySelector<HTMLButtonElement>('[data-testid="recovery-action-clear-caches"]')?.click()

    const cancelBtn = root.querySelector<HTMLButtonElement>('[data-testid="recovery-cancel"]')
    expect(cancelBtn?.textContent).toBe('Avbryt')
    const retryBtn = root.querySelector<HTMLButtonElement>('[data-testid="recovery-retry"]')
    expect(retryBtn?.hidden).toBe(true)
  })

  it('cancel button stops the active countdown and hides the panel', () => {
    const root = document.createElement('div')
    const cancelTimer = vi.fn()
    const startCountdown = vi.fn(() => cancelTimer)

    mountRecovery(root, buildDeps({ startCountdown }))

    const triggerBtn = root.querySelector<HTMLButtonElement>('[data-testid="recovery-action-nuke"]')
    triggerBtn?.click()

    const cancelBtn = root.querySelector<HTMLButtonElement>('[data-testid="recovery-cancel"]')
    cancelBtn?.click()
    expect(cancelTimer).toHaveBeenCalledTimes(1)
    const panel = root.querySelector<HTMLElement>('[data-testid="recovery-countdown-panel"]')
    expect(panel?.hidden).toBe(true)
  })

  it('shows iOS standalone guidance when isIosStandalone returns true', () => {
    const root = document.createElement('div')

    mountRecovery(root, buildDeps({ isIosStandalone: () => true }))

    const note = root.querySelector('[data-testid="recovery-ios-standalone-note"]')
    expect(note?.textContent).toContain('hemskärmsapp')
  })

  it('omits iOS guidance when isIosStandalone returns false', () => {
    const root = document.createElement('div')

    mountRecovery(root, buildDeps({ isIosStandalone: () => false }))

    const note = root.querySelector('[data-testid="recovery-ios-standalone-note"]')
    expect(note).toBeNull()
  })

  it('updates the countdown display as the timer ticks', () => {
    const root = document.createElement('div')
    const captured: { onTick: ((remaining: number) => void) | null } = { onTick: null }
    const startCountdown = vi.fn((opts) => {
      captured.onTick = opts.onTick
      return () => {}
    })

    mountRecovery(root, buildDeps({ countdownFrom: 10, startCountdown }))

    const btn = root.querySelector<HTMLButtonElement>('[data-testid="recovery-action-nuke"]')
    btn?.click()
    captured.onTick?.(7)

    const countdownEl = root.querySelector('[data-testid="recovery-countdown"]')
    expect(countdownEl?.textContent).toContain('7')
  })
})
