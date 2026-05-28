import type { startCountdown } from './countdown'
import type { Diagnostics } from './diagnostics'

interface MountRecoveryDeps {
  countdownFrom: number
  startCountdown: typeof startCountdown
  clearCaches: () => Promise<void>
  unregisterSWs: () => Promise<void>
  nukeAndReload: () => Promise<void>
  leavePage: () => void
  downloadBackup: () => Promise<void>
  getDiagnostics: () => Promise<Diagnostics>
  copyDiagnostics: () => Promise<void>
  isIosStandalone?: () => boolean
}

interface RecoveryAction {
  id: string
  label: string
  description: string
  run: () => Promise<void>
}

function formatBytes(n: number | undefined): string {
  if (typeof n !== 'number') return '–'
  const mb = n / 1024 / 1024
  if (mb >= 1) return `${mb.toFixed(1)} MB`
  const kb = n / 1024
  return `${kb.toFixed(1)} KB`
}

function renderDiagnostics(panel: HTMLElement, d: Diagnostics): void {
  const swList = d.swScopes.length
    ? d.swScopes.map((s) => `<li>${s}</li>`).join('')
    : '<li>(inga)</li>'
  const cacheList = d.caches.length
    ? d.caches.map((c) => `<li>${c.name} (${c.entryCount})</li>`).join('')
    : '<li>(inga)</li>'
  const storageLine = d.storage
    ? `${formatBytes(d.storage.usage)} av ${formatBytes(d.storage.quota)}`
    : '–'
  panel.innerHTML = `
    <dl class="recovery-diag">
      <dt>Version</dt><dd>${d.version} (${d.commit})</dd>
      <dt>Service workers (${d.swCount})</dt><dd><ul>${swList}</ul></dd>
      <dt>Cachelagring</dt><dd><ul>${cacheList}</ul></dd>
      <dt>Lagring</dt><dd>${storageLine}</dd>
    </dl>
  `
}

export function mountRecovery(root: HTMLElement, deps: MountRecoveryDeps): void {
  const heading = document.createElement('h1')
  heading.textContent = 'Säkert läge'
  root.appendChild(heading)

  const diagPanel = document.createElement('section')
  diagPanel.setAttribute('data-testid', 'recovery-diagnostics')
  diagPanel.textContent = 'Hämtar diagnostik…'
  root.appendChild(diagPanel)

  const copyDiagBtn = document.createElement('button')
  copyDiagBtn.setAttribute('data-testid', 'recovery-copy-diag')
  copyDiagBtn.type = 'button'
  copyDiagBtn.textContent = 'Kopiera diagnostik'
  copyDiagBtn.addEventListener('click', () => {
    const original = copyDiagBtn.textContent
    void deps.copyDiagnostics().then(
      () => {
        copyDiagBtn.textContent = 'Kopierat ✓'
        setTimeout(() => {
          copyDiagBtn.textContent = original
        }, 1500)
      },
      () => {
        copyDiagBtn.textContent = 'Kunde inte kopiera'
        setTimeout(() => {
          copyDiagBtn.textContent = original
        }, 1500)
      },
    )
  })
  root.appendChild(copyDiagBtn)

  void deps.getDiagnostics().then((d) => renderDiagnostics(diagPanel, d))

  if (deps.isIosStandalone?.()) {
    const note = document.createElement('aside')
    note.setAttribute('data-testid', 'recovery-ios-standalone-note')
    note.innerHTML = `
      <p><strong>Lotta körs som hemskärmsapp på iOS.</strong></p>
      <p>
        Lagring (databas, cache) är knuten till hemskärmsappen. Om återställning
        inte hjälper: ta bort appen från hemskärmen, öppna lotta.app i Safari,
        och lägg till på hemskärmen igen.
      </p>
    `
    root.appendChild(note)
  }

  const backupBtn = document.createElement('button')
  backupBtn.setAttribute('data-testid', 'recovery-backup')
  backupBtn.type = 'button'
  backupBtn.textContent = 'Säkerhetskopiera databas först'
  backupBtn.addEventListener('click', () => {
    void deps.downloadBackup()
  })
  root.appendChild(backupBtn)

  const actionsPanel = document.createElement('section')
  actionsPanel.setAttribute('data-testid', 'recovery-actions')
  root.appendChild(actionsPanel)

  const countdownPanel = document.createElement('section')
  countdownPanel.setAttribute('data-testid', 'recovery-countdown-panel')
  countdownPanel.hidden = true
  root.appendChild(countdownPanel)

  const countdownLabel = document.createElement('p')
  countdownPanel.appendChild(countdownLabel)

  const countdownEl = document.createElement('div')
  countdownEl.setAttribute('data-testid', 'recovery-countdown')
  countdownPanel.appendChild(countdownEl)

  const cancelBtn = document.createElement('button')
  cancelBtn.setAttribute('data-testid', 'recovery-cancel')
  cancelBtn.type = 'button'
  cancelBtn.textContent = 'Avbryt'
  countdownPanel.appendChild(cancelBtn)

  let activeCancel: (() => void) | null = null

  const startActionCountdown = (action: RecoveryAction): void => {
    if (activeCancel) activeCancel()
    countdownLabel.textContent = `${action.description} om`
    countdownEl.textContent = String(deps.countdownFrom)
    countdownPanel.hidden = false
    actionsPanel.hidden = true
    activeCancel = deps.startCountdown({
      from: deps.countdownFrom,
      onTick: (remaining) => {
        countdownEl.textContent = String(remaining)
      },
      onComplete: () => {
        void action.run()
      },
    })
  }

  cancelBtn.addEventListener('click', () => {
    if (activeCancel) activeCancel()
    activeCancel = null
    countdownPanel.hidden = true
    actionsPanel.hidden = false
  })

  const actions: RecoveryAction[] = [
    {
      id: 'clear-caches',
      label: 'Rensa cache',
      description: 'Rensar cachelagring',
      run: deps.clearCaches,
    },
    {
      id: 'unregister-sw',
      label: 'Avregistrera service workers',
      description: 'Avregistrerar service workers',
      run: deps.unregisterSWs,
    },
    {
      id: 'nuke',
      label: 'Återställ allt (cache + service workers)',
      description: 'Återställer allt och laddar om',
      run: deps.nukeAndReload,
    },
  ]

  for (const action of actions) {
    const btn = document.createElement('button')
    btn.setAttribute('data-testid', `recovery-action-${action.id}`)
    btn.type = 'button'
    btn.textContent = action.label
    btn.addEventListener('click', () => startActionCountdown(action))
    actionsPanel.appendChild(btn)
  }

  const leaveBtn = document.createElement('button')
  leaveBtn.setAttribute('data-testid', 'recovery-leave')
  leaveBtn.type = 'button'
  leaveBtn.textContent = 'Lämna sidan'
  leaveBtn.addEventListener('click', () => deps.leavePage())
  root.appendChild(leaveBtn)
}
