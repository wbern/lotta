import { useEffect, useRef } from 'react'

interface Props {
  title: string
  open: boolean
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
  width?: number
  height?: number
  noPadding?: boolean
  isDirty?: boolean
}

export function Dialog({
  title,
  open,
  onClose,
  children,
  footer,
  width,
  height,
  noPadding,
  isDirty,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDirty) onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose, isDirty])

  if (!open) return null

  return (
    <div
      className="dialog-overlay"
      data-testid="dialog-overlay"
      onClick={isDirty ? undefined : onClose}
    >
      <div
        className="dialog"
        style={{
          ...(width ? { maxWidth: width, width } : undefined),
          ...(height ? { height } : undefined),
        }}
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-title" data-testid="dialog-title">
          {title}
        </div>
        <div className={`dialog-body${noPadding ? ' dialog-body--no-padding' : ''}`}>
          {children}
        </div>
        {footer && <div className="dialog-footer">{footer}</div>}
      </div>
    </div>
  )
}
