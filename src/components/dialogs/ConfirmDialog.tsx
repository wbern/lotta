import { Dialog } from './Dialog'

interface Props {
  open: boolean
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ open, title, message, onConfirm, onCancel }: Props) {
  return (
    <Dialog
      title={title}
      open={open}
      onClose={onCancel}
      footer={
        <>
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={onConfirm}>
            OK
          </button>
        </>
      }
    >
      <p>{message}</p>
    </Dialog>
  )
}
