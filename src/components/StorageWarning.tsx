import { useEffect, useState } from 'react'
import { useClientP2PStore } from '../stores/client-p2p-store'

const DISMISSED_KEY = 'storage-warning-dismissed'

export function StorageWarning() {
  const { shareMode } = useClientP2PStore()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (shareMode) return
    if (window.location.pathname.startsWith('/live/')) return
    if (localStorage.getItem(DISMISSED_KEY)) return
    if (!navigator.storage?.persist) return

    navigator.storage.persist().then((granted) => {
      if (!granted) setShow(true)
    })
  }, [shareMode])

  if (!show || shareMode) return null

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1')
    setShow(false)
  }

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches

  return (
    <div className="storage-warning" role="alert">
      <p>
        {isStandalone
          ? 'Webbläsaren kan radera turneringsdata vid lågt lagringsutrymme. Säkerhetskopiera regelbundet via Inställningar.'
          : 'Webbläsaren kan radera turneringsdata om du inte besöker appen på ett tag. Installera appen eller säkerhetskopiera regelbundet via Inställningar.'}
      </p>
      <button className="btn" onClick={dismiss}>
        OK
      </button>
    </div>
  )
}
