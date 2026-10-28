import { useEffect, useState } from 'react'
import { Dialog } from './Dialog'

interface Props {
  open: boolean
  title: string
  message: string
  confirmText?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: Props) {
  const [typed, setTyped] = useState('')
  useEffect(() => {
    if (!open) setTyped('')
  }, [open])

  const requiresMatch = typeof confirmText === 'string' && confirmText.length > 0
  const canConfirm = !requiresMatch || typed.trim() === confirmText.trim()

  return (
    <Dialog
      title={title}
      open={open}
      onClose={onCancel}
      footer={
        <>
          <button className="btn" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className="btn btn-primary" onClick={onConfirm} disabled={!canConfirm}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <p>{message}</p>
      {requiresMatch && (
        <p>
          <label>
            Skriv <strong>{confirmText}</strong> för att bekräfta:
            <input
              data-testid="confirm-text-input"
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          </label>
        </p>
      )}
    </Dialog>
  )
}
