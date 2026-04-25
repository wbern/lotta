import { useCallback, useRef } from 'react'

export function useShiftSelect<T>(
  sortedItems: T[],
  setSelectedIds: (updater: (prev: Set<number>) => Set<number>) => void,
  getKey: (item: T) => number = (item) => (item as { id: number }).id,
): {
  handleClick: (id: number, event: React.MouseEvent) => void
  handleMouseDown: (event: React.MouseEvent) => void
} {
  const lastClickedId = useRef<number | null>(null)

  // Shift+click would otherwise start a browser text-range selection on
  // mousedown; suppressing the default keeps only the row highlight.
  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    if (event.shiftKey) event.preventDefault()
  }, [])

  const handleClick = useCallback(
    (id: number, event: React.MouseEvent) => {
      if (event.shiftKey && lastClickedId.current !== null) {
        const lastIdx = sortedItems.findIndex((item) => getKey(item) === lastClickedId.current)
        const currentIdx = sortedItems.findIndex((item) => getKey(item) === id)

        if (lastIdx !== -1 && currentIdx !== -1) {
          const start = Math.min(lastIdx, currentIdx)
          const end = Math.max(lastIdx, currentIdx)

          setSelectedIds((prev) => {
            const next = new Set(prev)
            for (let i = start; i <= end; i++) {
              next.add(getKey(sortedItems[i]))
            }
            return next
          })
          lastClickedId.current = id
          return
        }
      }

      // Plain click: single-select (replace selection with just this item)
      setSelectedIds(() => new Set([id]))
      lastClickedId.current = id
    },
    [sortedItems, setSelectedIds, getKey],
  )

  return { handleClick, handleMouseDown }
}
