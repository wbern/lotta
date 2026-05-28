import { readBackupBytes } from './backup'
import { startCountdown } from './countdown'
import { gatherDiagnostics } from './diagnostics'
import { mountRecovery } from './mount-recovery'
import { clearCaches, nukeAndReload, unregisterSWs } from './nuke'
import { isIosStandalone } from './standalone'

declare const __GIT_TAG__: string
declare const __COMMIT_HASH__: string

function todayStamp(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

async function downloadBackup(): Promise<void> {
  const bytes = await readBackupBytes()
  if (!bytes) {
    window.alert(
      'Ingen sparad databas hittades. Säkerhetskopia är inte tillgänglig från den här enheten.',
    )
    return
  }
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer
  const blob = new Blob([buffer], { type: 'application/x-sqlite3' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `lotta-backup-${todayStamp()}.sqlite`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

function diagnosticsDeps() {
  return {
    version: typeof __GIT_TAG__ === 'string' ? __GIT_TAG__ : 'unknown',
    commit: typeof __COMMIT_HASH__ === 'string' ? __COMMIT_HASH__ : 'unknown',
    userAgent: navigator.userAgent,
    now: () => new Date(),
    swContainer: navigator.serviceWorker ?? null,
    cacheStorage: typeof caches !== 'undefined' ? caches : null,
    storageManager: navigator.storage ?? null,
  }
}

async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch {
      // fall through to legacy path
    }
  }
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } finally {
    document.body.removeChild(textarea)
  }
  if (!ok) throw new Error('copy failed')
}

async function copyDiagnostics(): Promise<void> {
  const diag = await gatherDiagnostics(diagnosticsDeps())
  await copyToClipboard(JSON.stringify(diag, null, 2))
}

function swDeps() {
  return { swContainer: navigator.serviceWorker ?? null }
}

function cacheDeps() {
  return { cacheStorage: typeof caches !== 'undefined' ? caches : null }
}

export function bootRecovery(root: HTMLElement): void {
  mountRecovery(root, {
    countdownFrom: 10,
    startCountdown,
    clearCaches: async () => {
      await clearCaches(cacheDeps())
      window.location.reload()
    },
    unregisterSWs: async () => {
      await unregisterSWs(swDeps())
      window.location.reload()
    },
    nukeAndReload: () =>
      nukeAndReload({
        ...swDeps(),
        ...cacheDeps(),
        reload: () => window.location.reload(),
      }),
    leavePage: () => {
      window.location.href = '/'
    },
    downloadBackup,
    getDiagnostics: () => gatherDiagnostics(diagnosticsDeps()),
    copyDiagnostics,
    isIosStandalone: () =>
      isIosStandalone({
        userAgent: navigator.userAgent,
        matchMedia: typeof window.matchMedia === 'function' ? (q) => window.matchMedia(q) : null,
        navigatorStandalone: (navigator as { standalone?: boolean }).standalone,
      }),
  })
}

const rootEl = document.getElementById('root')
if (rootEl) bootRecovery(rootEl)
