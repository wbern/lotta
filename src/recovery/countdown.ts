interface CountdownOptions {
  from: number
  onTick: (remaining: number) => void
  onComplete: () => void
}

export function startCountdown(opts: CountdownOptions): () => void {
  let remaining = opts.from
  const id = setInterval(() => {
    remaining -= 1
    opts.onTick(remaining)
    if (remaining <= 0) {
      clearInterval(id)
      opts.onComplete()
    }
  }, 1000)
  return () => clearInterval(id)
}
