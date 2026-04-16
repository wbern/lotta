import { useRegisterSW } from 'virtual:pwa-register/react'
import { useEffect, useState } from 'react'
import { type ChangelogEntry, entriesSince, fetchChangelog, groupByType } from '../domain/changelog'

const UPDATE_INTERVAL = 60 * 60 * 1000

interface VersionInfo {
  hash: string
  date: string
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  return dateStr.slice(0, 16)
}

export function ReloadPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) {
        // setInterval is intentional here — this callback runs once on SW registration
        // and the interval should live for the entire page lifetime.
        setInterval(() => registration.update(), UPDATE_INTERVAL)
      }
    },
  })

  const [newVersion, setNewVersion] = useState<VersionInfo | null>(null)
  const [changes, setChanges] = useState<ChangelogEntry[]>([])

  useEffect(() => {
    if (!needRefresh) return
    let cancelled = false
    fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (!cancelled) setNewVersion({ hash: data.hash, date: data.date })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [needRefresh])

  useEffect(() => {
    if (!needRefresh) return
    let cancelled = false
    fetchChangelog(import.meta.env.BASE_URL).then((entries) => {
      if (!cancelled) setChanges(entriesSince(entries, __COMMIT_HASH__, __COMMIT_DATE__))
    })
    return () => {
      cancelled = true
    }
  }, [needRefresh])

  function close() {
    setOfflineReady(false)
    setNeedRefresh(false)
  }

  if (!offlineReady && !needRefresh) return null

  const currentHash = __COMMIT_HASH__
  const currentDate = formatDate(__COMMIT_DATE__)
  const groups = groupByType(changes)

  return (
    <div className="pwa-toast" role="alert">
      <button
        type="button"
        className="pwa-toast-dismiss"
        onClick={close}
        aria-label="Stäng"
        title="Stäng"
      >
        ×
      </button>
      {offlineReady ? (
        <p>Appen är redo offline</p>
      ) : (
        <div className="pwa-toast-versions">
          <p>Ny version tillgänglig</p>
          {newVersion && currentHash && (
            <div className="pwa-toast-version-details">
              <span>
                Nuvarande: {currentHash}
                {currentDate && ` (${currentDate})`}
              </span>
              <span>
                Ny: {newVersion.hash}
                {newVersion.date && ` (${formatDate(newVersion.date)})`}
              </span>
            </div>
          )}
          {groups.length > 0 && (
            <div className="pwa-toast-changes">
              {groups.map((group) => (
                <section key={group.type} className="pwa-toast-change-group">
                  <h4>{group.label}</h4>
                  <ul>
                    {group.entries.map((entry) => (
                      <li key={entry.sha}>
                        {entry.breaking && <strong>Brytande ändring: </strong>}
                        {entry.message}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="pwa-toast-actions">
        {needRefresh && !offlineReady && (
          <button className="btn btn-primary" onClick={() => updateServiceWorker(true)}>
            Uppdatera
          </button>
        )}
        <button className="btn" onClick={close}>
          Stäng
        </button>
      </div>
    </div>
  )
}
