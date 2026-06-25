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
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDirty) onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose, isDirty])

  // Move focus into the dialog on open and restore it on close. This makes the
  // dialog own focus, so document-level keyboard shortcuts (e.g. result entry on
  // the pairings table) cannot act on the element behind the modal (ADR-0005).
  useEffect(() => {
    if (!open) return
    previousFocusRef.current = document.activeElement as HTMLElement | null
    // Only pull focus into the dialog if it isn't already there — a child may
    // have autofocused a specific control (e.g. a password input).
    const dialog = dialogRef.current
    if (dialog && !dialog.contains(document.activeElement)) {
      dialog.focus()
    }
    return () => {
      previousFocusRef.current?.focus?.()
    }
  }, [open])

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
        // biome-ignore lint/a11y/noNoninteractiveTabindex: focus target for the modal focus-trap (ADR-0005)
        tabIndex={-1}
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
