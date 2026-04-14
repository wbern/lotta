import type { SortState } from '../hooks/useTableSort'

interface Props {
  column: string
  label: string
  sort: SortState
  onToggle: (column: string) => void
  className?: string
  style?: React.CSSProperties
}

export function SortableHeader({ column, label, sort, onToggle, className, style }: Props) {
  const isActive = sort.column === column
  return (
    <th className={`sortable ${className || ''}`} style={style} onClick={() => onToggle(column)}>
      {label}
      <span className={`sort-indicator ${isActive ? 'active' : ''}`}>
        {isActive ? (sort.direction === 'asc' ? '\u25B2' : '\u25BC') : ''}
      </span>
    </th>
  )
}
