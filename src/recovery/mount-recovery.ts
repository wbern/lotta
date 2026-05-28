import type { startCountdown } from './countdown'

interface MountRecoveryDeps {
  countdownFrom: number
  startCountdown: typeof startCountdown
  nukeAndReload: () => Promise<void>
  leavePage: () => void
}

export function mountRecovery(root: HTMLElement, deps: MountRecoveryDeps): void {
  const heading = document.createElement('h1')
  heading.textContent = 'Uppdaterar appen'
  root.appendChild(heading)

  const countdownEl = document.createElement('div')
  countdownEl.setAttribute('data-testid', 'recovery-countdown')
  countdownEl.textContent = String(deps.countdownFrom)
  root.appendChild(countdownEl)

  const cancel = deps.startCountdown({
    from: deps.countdownFrom,
    onTick: (remaining) => {
      countdownEl.textContent = String(remaining)
    },
    onComplete: () => {
      void deps.nukeAndReload()
    },
  })

  const cancelBtn = document.createElement('button')
  cancelBtn.setAttribute('data-testid', 'recovery-cancel')
  cancelBtn.type = 'button'
  cancelBtn.textContent = 'Avbryt'
  cancelBtn.addEventListener('click', () => cancel())
  root.appendChild(cancelBtn)

  const leaveBtn = document.createElement('button')
  leaveBtn.setAttribute('data-testid', 'recovery-leave')
  leaveBtn.type = 'button'
  leaveBtn.textContent = 'Lämna sidan'
  leaveBtn.addEventListener('click', () => deps.leavePage())
  root.appendChild(leaveBtn)
}
