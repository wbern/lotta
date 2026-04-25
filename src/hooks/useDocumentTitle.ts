import { useEffect, useRef } from 'react'

const FLASH_INTERVAL_MS = 1500

/**
 * Updates the browser tab title to show an unread count badge.
 * When the document is hidden and count > 0, the title flashes
 * between the count badge and "Ny aktivitet!" to attract attention.
 *
 * Pass `enabled={false}` to leave the document title alone (e.g. when the
 * owning feature is mounted but inactive). Transitioning from enabled to
 * disabled restores the title that was set before the hook took ownership.
 */
export function useDocumentTitle(
  unreadCount: number,
  baseTitle: string,
  enabled: boolean = true,
): void {
  const flashRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const showingFlash = useRef(false)
  const previousTitleRef = useRef<string | null>(null)

  useEffect(() => {
    if (!enabled) {
      if (flashRef.current) {
        clearInterval(flashRef.current)
        flashRef.current = null
        showingFlash.current = false
      }
      if (previousTitleRef.current !== null) {
        document.title = previousTitleRef.current
        previousTitleRef.current = null
      }
      return
    }

    if (previousTitleRef.current === null) {
      previousTitleRef.current = document.title
    }

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
  }, [unreadCount, baseTitle, enabled])

  useEffect(() => {
    return () => {
      if (previousTitleRef.current !== null) {
        document.title = previousTitleRef.current
        previousTitleRef.current = null
      }
    }
  }, [])
}
