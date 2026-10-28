import { describe, expect, it, vi } from 'vitest'
import { emitDataChanged, subscribeDataChanged } from './data-changed-bus'

describe('data-changed bus', () => {
  it('given a subscriber, when data changes, then it is notified', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeDataChanged(listener)

    emitDataChanged()

    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('given an unsubscribed listener, when data changes, then it is not notified', () => {
    const listener = vi.fn()
    subscribeDataChanged(listener)()

    emitDataChanged()

    expect(listener).not.toHaveBeenCalled()
  })

  it('given a listener that throws, when data changes, then the other listeners still run', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const failing = subscribeDataChanged(() => {
      throw new Error('boom')
    })
    const listener = vi.fn()
    const unsubscribe = subscribeDataChanged(listener)

    expect(() => emitDataChanged()).not.toThrow()

    expect(listener).toHaveBeenCalledTimes(1)
    failing()
    unsubscribe()
    consoleError.mockRestore()
  })
})
