import { useEffect, useState } from 'react'
import { deleteDatabase } from '../../db/persistence'
import { useInstallPrompt } from '../../hooks/useInstallPrompt'
import { useSettings, useUpdateSettings } from '../../hooks/useSettings'
import { useTheme } from '../../hooks/useTheme'
import { ClearDatabaseDialog } from './ClearDatabaseDialog'
import { Dialog } from './Dialog'

function isIos() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
}

interface Props {
  open: boolean
  onClose: () => void
}

export function SettingsDialog({ open, onClose }: Props) {
  const { data: settings } = useSettings()
  const updateSettings = useUpdateSettings()
  const { theme, setTheme } = useTheme()
  const { canInstall, install } = useInstallPrompt()
  const [playerPresentation, setPlayerPresentation] = useState('FIRST_LAST')
  const [maxPointsImmediately, setMaxPointsImmediately] = useState(true)
  const [nrOfRows, setNrOfRows] = useState(0)
  const [searchForUpdate, setSearchForUpdate] = useState(false)
  const [clearDbOpen, setClearDbOpen] = useState(false)

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (settings) {
      setPlayerPresentation(settings.playerPresentation)
      setMaxPointsImmediately(settings.maxPointsImmediately)
      setNrOfRows(settings.nrOfRows)
      setSearchForUpdate(settings.searchForUpdate)
    }
  }, [settings])
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSave = () => {
    updateSettings.mutate(
      { playerPresentation, maxPointsImmediately, nrOfRows, searchForUpdate },
      {
        onSuccess: () => onClose(),
      },
    )
  }

  return (
    <Dialog
      title="Inställningar"
      open={open}
      onClose={onClose}
      width={460}
      footer={
        <>
          <button className="btn btn-primary" onClick={handleSave}>
            OK
          </button>
          <button className="btn" onClick={onClose}>
            Avbryt
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <span>Namnvisning</span>
        <select
          value={playerPresentation}
          onChange={(e) => setPlayerPresentation(e.target.value)}
          style={{ marginLeft: 'auto' }}
        >
          <option value="FIRST_LAST">Förnamn efternamn</option>
          <option value="LAST_FIRST">Efternamn förnamn</option>
        </select>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <span>
          Radbryt publicerad alfabetisk lottningslista efter så här många rader (0=radbryt aldrig)
        </span>
        <input
          type="number"
          min={0}
          max={100}
          value={nrOfRows}
          onChange={(e) => setNrOfRows(Number(e.target.value))}
          style={{ width: 60, marginLeft: 'auto', flexShrink: 0 }}
        />
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <input
          type="checkbox"
          checked={maxPointsImmediately}
          onChange={(e) => setMaxPointsImmediately(e.target.checked)}
        />
        Sätt maxpoäng per match omedelbart
      </label>
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 12,
          color: 'var(--color-text-muted)',
        }}
      >
        <input type="checkbox" checked={searchForUpdate} disabled />
        Sök efter uppdateringar vid start
      </label>
      <div className="menu-separator" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <span>Utseende</span>
        <select
          data-testid="theme-select"
          value={theme}
          onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
          style={{ marginLeft: 'auto' }}
        >
          <option value="system">System</option>
          <option value="light">Ljust</option>
          <option value="dark">Mörkt</option>
        </select>
      </div>
      {canInstall && (
        <>
          <div className="menu-separator" style={{ margin: '12px 0' }} />
          <button className="btn" onClick={install} style={{ width: '100%' }}>
            Installera som app
          </button>
        </>
      )}
      {!canInstall && isIos() && !isStandalone() && (
        <>
          <div className="menu-separator" style={{ margin: '12px 0' }} />
          <p
            style={{
              fontSize: 'var(--font-size-small)',
              color: 'var(--color-text-muted)',
              margin: 0,
            }}
          >
            Installera som app: tryck Dela-knappen i Safari och välj &quot;Lägg till på
            hemskärmen&quot;
          </p>
        </>
      )}
      <div className="menu-separator" style={{ margin: '12px 0' }} />
      <button
        className="btn btn-danger"
        data-testid="clear-db-button"
        onClick={() => setClearDbOpen(true)}
        style={{ width: '100%' }}
      >
        Rensa databas
      </button>
      <ClearDatabaseDialog
        open={clearDbOpen}
        onClose={() => setClearDbOpen(false)}
        onConfirm={async () => {
          await deleteDatabase()
          window.location.reload()
        }}
      />
    </Dialog>
  )
}
