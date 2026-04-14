import type { AuditEntry } from '../../db/undo-manager'

interface Props {
  open: boolean
  onClose: () => void
  entries: AuditEntry[]
  currentSnapshotIndex: number
  onRestoreToPoint: (snapshotIndex: number) => void
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp)
  return d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
}

export function TimelinePanel({
  open,
  onClose,
  entries,
  currentSnapshotIndex,
  onRestoreToPoint,
}: Props) {
  if (!open) return null

  // Show newest first
  const reversed = [...entries].reverse()

  return (
    <div className="timeline-overlay" onClick={onClose}>
      <div className="timeline-panel" onClick={(e) => e.stopPropagation()}>
        <div className="timeline-header">
          <span>Historik</span>
          <button className="timeline-close" onClick={onClose} aria-label="Stäng">
            &times;
          </button>
        </div>
        <div className="timeline-entries">
          {reversed.length === 0 && <div className="timeline-empty">Inga ändringar ännu.</div>}
          {reversed.map((entry) => {
            const isCurrent = entry.snapshotIndex === currentSnapshotIndex
            return (
              <div
                key={entry.snapshotIndex}
                className={`timeline-entry${isCurrent ? ' timeline-entry--current' : ''}`}
              >
                <div className={`timeline-dot${isCurrent ? ' timeline-dot--current' : ''}`} />
                <div className="timeline-content">
                  <div className="timeline-label">{entry.label}</div>
                  {entry.detail && <div className="timeline-detail">{entry.detail}</div>}
                  <div className="timeline-time">{formatTime(entry.timestamp)}</div>
                </div>
                {!isCurrent && (
                  <button
                    className="btn btn-small timeline-restore"
                    onClick={() => onRestoreToPoint(entry.snapshotIndex)}
                  >
                    Återställ hit
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
