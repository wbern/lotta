import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { playSound, resetSoundState } from './notification-sounds'

function createMockAudioContext() {
  const freqCalls: number[] = []
  return {
    instance: {
      createOscillator: vi.fn(() => ({
        type: 'sine',
        frequency: {
          setValueAtTime: vi.fn((freq: number) => freqCalls.push(freq)),
        },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      })),
      createGain: vi.fn(() => ({
        gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
      })),
      destination: {},
      currentTime: 0,
    },
    freqCalls,
  }
}

let ctorCallCount: number
let lastMock: ReturnType<typeof createMockAudioContext>

beforeEach(() => {
  ctorCallCount = 0
  lastMock = createMockAudioContext()
  vi.stubGlobal('AudioContext', function MockAudioContext(this: Record<string, unknown>) {
    ctorCallCount++
    lastMock = createMockAudioContext()
    Object.assign(this, lastMock.instance)
  })
  vi.useFakeTimers()
  resetSoundState()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('playSound', () => {
  it('creates an AudioContext and plays a tone', () => {
    playSound('chat')
    expect(ctorCallCount).toBe(1)
  })

  it('uses different frequencies for chat vs result vs round', () => {
    const freqs: Record<string, number[]> = {}

    for (const type of ['chat', 'result', 'round'] as const) {
      resetSoundState()
      playSound(type)
      freqs[type] = [...lastMock.freqCalls]
      vi.advanceTimersByTime(400)
    }

    // Each type should produce at least one frequency
    expect(freqs.chat.length).toBeGreaterThan(0)
    expect(freqs.result.length).toBeGreaterThan(0)
    expect(freqs.round.length).toBeGreaterThan(0)

    // They should differ
    expect(freqs.chat).not.toEqual(freqs.result)
    expect(freqs.result).not.toEqual(freqs.round)
  })

  it('is debounced — rapid calls within 300ms are ignored', () => {
    playSound('chat')
    playSound('chat')
    playSound('chat')

    // Only one oscillator set created despite 3 calls
    expect(lastMock.instance.createOscillator).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(400)
    playSound('chat')
    // After debounce window, a second oscillator set is created
    expect(lastMock.instance.createOscillator).toHaveBeenCalledTimes(2)
  })

  it('debounces per sound type independently', () => {
    playSound('chat')
    playSound('result')

    // Both sounds play — different types are independent
    // chat = 1 oscillator, result = 2 oscillators
    expect(lastMock.instance.createOscillator).toHaveBeenCalledTimes(3)
  })

  it('reuses a single AudioContext across calls', () => {
    playSound('chat')
    vi.advanceTimersByTime(400)
    playSound('chat')
    expect(ctorCallCount).toBe(1)
  })

  it('does not throw if AudioContext is unavailable', () => {
    vi.stubGlobal('AudioContext', undefined)
    expect(() => playSound('chat')).not.toThrow()
  })
})
