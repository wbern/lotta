import { useState } from 'react'
import { useVersions } from '../../hooks/useVersions'
import { Dialog } from './Dialog'

interface Props {
  open: boolean
  onClose: () => void
  onExport: () => Promise<void>
  onSwitch: (version: string) => void
}

export function RollbackDialog({ open, onClose, onExport, onSwitch }: Props) {
  const { data: versions, isLoading } = useVersions()
  const [exported, setExported] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const handleExport = async () => {
    setExporting(true)
    setExportError(null)
    try {
      await onExport()
      setExported(true)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : String(e))
    } finally {
      setExporting(false)
    }
  }

  const handleClose = () => {
    setExported(false)
    setExporting(false)
    setExportError(null)
    onClose()
  }

  return (
    <Dialog
      title="Byt till tidigare version"
      open={open}
      onClose={handleClose}
      footer={
        <button className="btn" onClick={handleClose}>
          Stäng
        </button>
      }
    >
      {isLoading && <p data-testid="rollback-loading">Läser in tillgängliga versioner…</p>}
      {!isLoading && (!versions || versions.length === 0) && (
        <p data-testid="rollback-empty">
          Inga tidigare versioner tillgängliga. Äldre versioner dyker upp här när nya versioner
          publiceras.
        </p>
      )}
      {!isLoading && versions && versions.length > 0 && (
        <>
          <div className="rollback-export-row">
            <p>
              Innan du byter version måste du säkerhetskopiera databasen. En äldre version kan inte
              läsa nyare databasformat.
            </p>
            <button
              className="btn"
              data-testid="rollback-export"
              onClick={handleExport}
              disabled={exporting}
            >
              {exported ? 'Säkerhetskopia sparad' : 'Ladda ner säkerhetskopia'}
            </button>
            {exportError && (
              <p className="form-error" data-testid="rollback-export-error">
                {exportError}
              </p>
            )}
          </div>
          <ul className="rollback-version-list">
            {versions.map((v) => (
              <li key={v.version} data-testid={`rollback-version-${v.version}`}>
                <span className="rollback-version-label">v{v.version}</span>
                {v.date && <span className="rollback-version-date"> ({v.date})</span>}
                <button
                  className="btn btn-primary"
                  data-testid={`rollback-switch-${v.version}`}
                  onClick={() => onSwitch(v.version)}
                  disabled={!exported}
                >
                  Byt till v{v.version}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Dialog>
  )
}
