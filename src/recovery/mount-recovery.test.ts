// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { mountRecovery } from './mount-recovery'

function buildDeps(overrides: Partial<Parameters<typeof mountRecovery>[1]> = {}) {
  return {
    countdownFrom: 10,
    startCountdown: vi.fn(() => () => {}),
    nukeAndReload: vi.fn().mockResolvedValue(undefined),
    leavePage: vi.fn(),
    ...overrides,
  }
}

describe('mountRecovery', () => {
  it('renders the initial countdown seconds in the root element', () => {
    const root = document.createElement('div')

    mountRecovery(root, buildDeps({ countdownFrom: 10 }))

    const countdownEl = root.querySelector('[data-testid="recovery-countdown"]')
    expect(countdownEl?.textContent).toContain('10')
  })

  it('renders an "updating in N seconds" heading', () => {
    const root = document.createElement('div')

    mountRecovery(root, buildDeps({ countdownFrom: 10 }))

    expect(root.textContent).toContain('Uppdaterar')
    expect(root.textContent).toContain('10')
  })

  it('leave-page button calls deps.leavePage', () => {
    const root = document.createElement('div')
    const leavePage = vi.fn()

    mountRecovery(root, buildDeps({ leavePage }))

    const leaveBtn = root.querySelector<HTMLButtonElement>('[data-testid="recovery-leave"]')
    leaveBtn?.click()
    expect(leavePage).toHaveBeenCalledTimes(1)
  })

  it('cancel button stops the countdown timer', () => {
    const root = document.createElement('div')
    const cancelTimer = vi.fn()
    const startCountdown = vi.fn(() => cancelTimer)

    mountRecovery(root, buildDeps({ startCountdown }))

    const cancelBtn = root.querySelector<HTMLButtonElement>('[data-testid="recovery-cancel"]')
    cancelBtn?.click()
    expect(cancelTimer).toHaveBeenCalledTimes(1)
  })

  it('calls nukeAndReload when the countdown completes', () => {
    const root = document.createElement('div')
    const captured: { onComplete: (() => void) | null } = { onComplete: null }
    const startCountdown = vi.fn((opts) => {
      captured.onComplete = opts.onComplete
      return () => {}
    })
    const nukeAndReload = vi.fn().mockResolvedValue(undefined)

    mountRecovery(root, buildDeps({ startCountdown, nukeAndReload }))

    captured.onComplete?.()
    expect(nukeAndReload).toHaveBeenCalledTimes(1)
  })

  it('updates the countdown display as the timer ticks', () => {
    const root = document.createElement('div')
    const captured: { onTick: ((remaining: number) => void) | null } = { onTick: null }
    const startCountdown = vi.fn((opts) => {
      captured.onTick = opts.onTick
      return () => {}
    })

    mountRecovery(root, buildDeps({ countdownFrom: 10, startCountdown }))

    captured.onTick?.(7)
    const countdownEl = root.querySelector('[data-testid="recovery-countdown"]')
    expect(countdownEl?.textContent).toContain('7')
  })
})
