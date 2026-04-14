import { useEffect } from 'react'

interface KeyboardShortcutHandlers {
  onUndo: () => void
  onRedo: () => void
}

export function useKeyboardShortcuts({ onUndo, onRedo }: KeyboardShortcutHandlers): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip when focus is on input, textarea, or contenteditable
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      const isCtrlOrMeta = e.ctrlKey || e.metaKey

      if (isCtrlOrMeta && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        onUndo()
      } else if (isCtrlOrMeta && e.key === 'y') {
        e.preventDefault()
        onRedo()
      } else if (isCtrlOrMeta && e.key === 'z' && e.shiftKey) {
        e.preventDefault()
        onRedo()
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onUndo, onRedo])
}
