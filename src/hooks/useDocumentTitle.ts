import { useEffect, useRef } from 'react'

const FLASH_INTERVAL_MS = 1500

/**
 * Updates the browser tab title to show an unread count badge.
 * When the document is hidden and count > 0, the title flashes
 * between the count badge and "Ny aktivitet!" to attract attention.
 */
export function useDocumentTitle(unreadCount: number, baseTitle: string): void {
  const flashRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const showingFlash = useRef(false)

  useEffect(() => {
    if (unreadCount > 0) {
      document.title = `(${unreadCount}) ${baseTitle}`

      if (document.hidden && !flashRef.current) {
        flashRef.current = setInterval(() => {
          showingFlash.current = !showingFlash.current
          document.title = showingFlash.current ? 'Ny aktivitet!' : `(${unreadCount}) ${baseTitle}`
        }, FLASH_INTERVAL_MS)
      }
    } else {
      document.title = baseTitle
      if (flashRef.current) {
        clearInterval(flashRef.current)
        flashRef.current = null
        showingFlash.current = false
      }
    }

    return () => {
      if (flashRef.current) {
        clearInterval(flashRef.current)
        flashRef.current = null
        showingFlash.current = false
      }
    }
  }, [unreadCount, baseTitle])

  // Restore title on unmount
  useEffect(() => {
    return () => {
      document.title = baseTitle
    }
  }, [baseTitle])
}
