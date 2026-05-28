import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startCountdown } from './countdown'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('startCountdown', () => {
  it('calls onComplete after `from` seconds have elapsed', () => {
    const onComplete = vi.fn()
    startCountdown({ from: 3, onTick: () => {}, onComplete })

    vi.advanceTimersByTime(2999)
    expect(onComplete).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('does not call onComplete after the returned cancel function runs', () => {
    const onComplete = vi.fn()
    const cancel = startCountdown({ from: 3, onTick: () => {}, onComplete })

    vi.advanceTimersByTime(1500)
    cancel()
    vi.advanceTimersByTime(10_000)

    expect(onComplete).not.toHaveBeenCalled()
  })

  it('emits onTick with the remaining seconds on each second', () => {
    const onTick = vi.fn()
    startCountdown({ from: 3, onTick, onComplete: () => {} })

    vi.advanceTimersByTime(1000)
    vi.advanceTimersByTime(1000)
    vi.advanceTimersByTime(1000)

    expect(onTick.mock.calls.map((c) => c[0])).toEqual([2, 1, 0])
  })
})
