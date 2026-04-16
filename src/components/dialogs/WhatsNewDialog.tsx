import { useEffect, useState } from 'react'
import {
  type ChangelogEntry,
  fetchChangelog,
  GROUP_LABELS,
  groupByDate,
} from '../../domain/changelog'
import { Dialog } from './Dialog'

interface Props {
  open: boolean
  onClose: () => void
}

export function WhatsNewDialog({ open, onClose }: Props) {
  const [entries, setEntries] = useState<ChangelogEntry[] | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setEntries(null)
    fetchChangelog(import.meta.env.BASE_URL).then((data) => {
      if (!cancelled) setEntries(data)
    })
    return () => {
      cancelled = true
    }
  }, [open])

  const days = entries ? groupByDate(entries) : []

  return (
    <Dialog
      title="Vad är nytt"
      open={open}
      onClose={onClose}
      width={520}
      footer={
        <button className="btn" onClick={onClose}>
          Stäng
        </button>
      }
    >
      {entries === null && <p>Laddar ändringslogg…</p>}
      {entries !== null && days.length === 0 && <p>Ingen ändringslogg tillgänglig.</p>}
      {days.length > 0 && (
        <div className="changelog-archive">
          {days.map((day) => (
            <section key={day.date} className="changelog-day">
              <h3>{day.date}</h3>
              <ul>
                {day.entries.map((entry) => (
                  <li key={entry.sha}>
                    <span className={`changelog-pill changelog-pill--${entry.type}`}>
                      {GROUP_LABELS[entry.type]}
                    </span>
                    {entry.breaking && <strong> Brytande ändring: </strong>}
                    <span className="changelog-message">{entry.message}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Dialog>
  )
}
