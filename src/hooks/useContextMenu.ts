import { useCallback, useEffect, useState } from 'react'

interface ContextMenuState {
  x: number
  y: number
  boardNr: number
}

export function useContextMenu() {
  const [state, setState] = useState<ContextMenuState | null>(null)

  const open = useCallback((e: React.MouseEvent, boardNr: number) => {
    e.preventDefault()
    setState({ x: e.clientX, y: e.clientY, boardNr })
  }, [])

  const close = useCallback(() => setState(null), [])

  useEffect(() => {
    if (state) {
      const pointerHandler = () => close()
      const keyHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') close()
      }
      document.addEventListener('pointerdown', pointerHandler)
      document.addEventListener('keydown', keyHandler)
      return () => {
        document.removeEventListener('pointerdown', pointerHandler)
        document.removeEventListener('keydown', keyHandler)
      }
    }
  }, [state, close])

  return { state, open, close }
}
