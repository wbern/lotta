import { useEffect, useState } from 'react'
import { Dialog } from './Dialog'

interface Props {
  open: boolean
  onClose: () => void
  onConfirm: () => void
}

export function ClearDatabaseDialog({ open, onClose, onConfirm }: Props) {
  const [input, setInput] = useState('')

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) setInput('')
  }, [open])
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <Dialog
      title="Rensa databas"
      open={open}
      onClose={onClose}
      width={420}
      footer={
        <>
          <button
            className="btn btn-danger"
            data-testid="clear-db-confirm"
            disabled={input !== 'Ja'}
            onClick={onConfirm}
          >
            Rensa
          </button>
          <button className="btn" onClick={onClose}>
            Avbryt
          </button>
        </>
      }
    >
      <p>
        Varning! Detta raderar alla turneringar, spelare och resultat permanent. Skriv
        &apos;Ja&apos; nedan f&ouml;r att bekr&auml;fta.
      </p>
      <input
        data-testid="clear-db-input"
        type="text"
        placeholder="Skriv Ja för att bekräfta"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        style={{ width: '100%', boxSizing: 'border-box' }}
      />
    </Dialog>
  )
}
