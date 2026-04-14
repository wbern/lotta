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
      const handler = () => close()
      document.addEventListener('click', handler)
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') close()
      })
      return () => {
        document.removeEventListener('click', handler)
      }
    }
  }, [state, close])

  return { state, open, close }
}
