import { startCountdown } from './countdown'
import { mountRecovery } from './mount-recovery'
import { nukeAndReload } from './nuke'

export function bootRecovery(root: HTMLElement): void {
  mountRecovery(root, {
    countdownFrom: 10,
    startCountdown,
    nukeAndReload: () =>
      nukeAndReload({
        swContainer: navigator.serviceWorker ?? null,
        cacheStorage: typeof caches !== 'undefined' ? caches : null,
        reload: () => window.location.reload(),
      }),
    leavePage: () => {
      window.location.href = '/'
    },
  })
}

const rootEl = document.getElementById('root')
if (rootEl) bootRecovery(rootEl)
