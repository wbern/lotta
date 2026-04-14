import { useId, useState } from 'react'
import { Dialog } from './Dialog'

interface Props {
  open: boolean
  onClose: () => void
  onSubmit: (password: string) => void
  error?: string
}

export function BackupRestoreDialog({ open, onClose, onSubmit, error }: Props) {
  const [password, setPassword] = useState('')
  const id = useId()
  const formId = `${id}-form`
  const passwordId = `${id}-password`

  const handleClose = () => {
    setPassword('')
    onClose()
  }

  const handleSubmit = () => {
    if (password.length > 0) {
      onSubmit(password)
    }
  }

  return (
    <Dialog
      title="Krypterad säkerhetskopia"
      open={open}
      onClose={handleClose}
      footer={
        <>
          <button className="btn" onClick={handleClose}>
            Avbryt
          </button>
          <button
            className="btn btn-primary"
            data-testid="restore-submit"
            type="submit"
            form={formId}
            disabled={password.length === 0}
          >
            Återställ
          </button>
        </>
      }
    >
      <p>Denna säkerhetskopia är krypterad. Ange lösenord för att återställa.</p>
      <form
        id={formId}
        onSubmit={(e) => {
          e.preventDefault()
          handleSubmit()
        }}
      >
        <div className="form-group">
          <label htmlFor={passwordId}>Lösenord</label>
          <input
            id={passwordId}
            type="password"
            data-testid="restore-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
        </div>
      </form>
      {error && (
        <p data-testid="restore-error" className="form-error">
          {error}
        </p>
      )}
    </Dialog>
  )
}
