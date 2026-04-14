import { useCallback, useMemo, useState } from 'react'

export type SortDirection = 'asc' | 'desc'

export interface SortState {
  column: string
  direction: SortDirection
}

type ValueGetter<T> = (item: T, column: string) => string | number | null | undefined

export function useTableSort<T>(data: T[], defaultSort: SortState, getValue: ValueGetter<T>) {
  const [sort, setSort] = useState<SortState>(defaultSort)

  const toggleSort = useCallback((column: string) => {
    setSort((prev) => {
      if (prev.column === column) {
        return { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      }
      return { column, direction: 'asc' }
    })
  }, [])

  const sorted = useMemo(() => {
    const copy = [...data]
    const { column, direction } = sort
    const mult = direction === 'asc' ? 1 : -1

    copy.sort((a, b) => {
      const va = getValue(a, column)
      const vb = getValue(b, column)

      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1

      if (typeof va === 'number' && typeof vb === 'number') {
        return (va - vb) * mult
      }

      return String(va).localeCompare(String(vb), 'sv') * mult
    })

    return copy
  }, [data, sort, getValue])

  return { sorted, sort, toggleSort }
}
