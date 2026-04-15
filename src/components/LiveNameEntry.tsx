import { type ReactNode, useState } from 'react'
import { LIVE_NAME_STORAGE_KEY } from '../lib/live-name'

interface Props {
  title: string
  onConfirm: (name: string) => void
  warning?: ReactNode
}

export function LiveNameEntry({ title, onConfirm, warning }: Props) {
  const [nameInput, setNameInput] = useState(
    () => localStorage.getItem(LIVE_NAME_STORAGE_KEY) ?? '',
  )

  const trimmed = nameInput.trim()

  const confirm = () => {
    if (!trimmed) return
    localStorage.setItem(LIVE_NAME_STORAGE_KEY, trimmed)
    onConfirm(trimmed)
  }

  return (
    <div className="live-page">
      <header className="live-header">
        <div className="live-title">{title}</div>
      </header>
      <main className="live-content">
        <div className="live-name-entry">
          <label htmlFor="live-name-input">Ange ditt namn:</label>
          <input
            id="live-name-input"
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirm()
            }}
            placeholder="Ditt namn"
            autoFocus
          />
          {warning}
          <button className="btn btn-primary" onClick={confirm} disabled={!trimmed}>
            Anslut
          </button>
        </div>
      </main>
    </div>
  )
}
