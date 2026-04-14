import { useRegisterSW } from 'virtual:pwa-register/react'
import { useEffect, useState } from 'react'

const UPDATE_INTERVAL = 60 * 60 * 1000

interface VersionInfo {
  hash: string
  date: string
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  // Extract "YYYY-MM-DD HH:MM" from git date format "2026-04-04 12:00:00 +0200"
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

  useEffect(() => {
    if (!needRefresh) return
    fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setNewVersion({ hash: data.hash, date: data.date }))
      .catch(() => {
        // version.json not available, show toast without version details
      })
  }, [needRefresh])

  function close() {
    setOfflineReady(false)
    setNeedRefresh(false)
  }

  if (!offlineReady && !needRefresh) return null

  const currentHash = __COMMIT_HASH__
  const currentDate = formatDate(__COMMIT_DATE__)

  return (
    <div className="pwa-toast" role="alert">
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
