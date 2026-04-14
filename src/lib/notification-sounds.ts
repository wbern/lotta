type SoundType = 'chat' | 'result' | 'round'

const DEBOUNCE_MS = 300

const lastPlayed = new Map<SoundType, number>()
let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new AudioContext()
  }
  return audioCtx
}

/** Reset debounce state — used in tests only. */
export function resetSoundState(): void {
  lastPlayed.clear()
  audioCtx = null
}

type ToneStep = { freq: number; duration: number }

const TONES: Record<SoundType, ToneStep[]> = {
  chat: [{ freq: 800, duration: 0.08 }],
  result: [
    { freq: 600, duration: 0.1 },
    { freq: 900, duration: 0.15 },
  ],
  round: [
    { freq: 500, duration: 0.12 },
    { freq: 700, duration: 0.12 },
    { freq: 1000, duration: 0.2 },
  ],
}

export function playSound(type: SoundType): void {
  const ctx = getAudioContext()
  if (!ctx) return

  const now = Date.now()
  const last = lastPlayed.get(type) ?? 0
  if (now - last < DEBOUNCE_MS) return
  lastPlayed.set(type, now)

  // Resume if suspended (browsers suspend until user gesture)
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {})
  }

  let offset = 0

  for (const step of TONES[type]) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(step.freq, ctx.currentTime + offset)
    gain.gain.setValueAtTime(0.15, ctx.currentTime + offset)
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + offset + step.duration)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime + offset)
    osc.stop(ctx.currentTime + offset + step.duration)
    offset += step.duration
  }
}
