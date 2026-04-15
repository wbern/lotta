import { useEffect, useMemo, useState } from 'react'
import type { TournamentListItemDto } from '../../types/api'
import { Dialog } from './Dialog'

interface Props {
  open: boolean
  tournaments: TournamentListItemDto[]
  currentTournamentId: number | undefined
  onClose: () => void
  onConfirm: (params: { name: string; presetFromId: number | undefined }) => void
}

export function AddGroupDialog({
  open,
  tournaments,
  currentTournamentId,
  onClose,
  onConfirm,
}: Props) {
  const currentName = tournaments.find((t) => t.id === currentTournamentId)?.name ?? ''
  const names = useMemo(
    () => Array.from(new Set(tournaments.map((t) => t.name))).sort(),
    [tournaments],
  )
  const sortedTournaments = useMemo(
    () =>
      [...tournaments].sort((a, b) => {
        const byName = a.name.localeCompare(b.name)
        return byName !== 0 ? byName : a.group.localeCompare(b.group)
      }),
    [tournaments],
  )
  const [name, setName] = useState(currentName)
  const [presetFromId, setPresetFromId] = useState<string>('')

  useEffect(() => {
    if (open) {
      setName(currentName)
      setPresetFromId('')
    }
  }, [open, currentName])

  const handleConfirm = () => {
    onConfirm({
      name,
      presetFromId: presetFromId ? Number(presetFromId) : undefined,
    })
  }

  return (
    <Dialog
      title="Lägg till grupp"
      open={open}
      onClose={onClose}
      width={400}
      footer={
        <>
          <button
            className="btn btn-primary"
            data-testid="add-group-confirm"
            onClick={handleConfirm}
          >
            OK
          </button>
          <button className="btn" onClick={onClose}>
            Avbryt
          </button>
        </>
      }
    >
      <div className="form-group">
        <label>Turnering</label>
        <select
          data-testid="add-group-name-select"
          value={name}
          onChange={(e) => setName(e.target.value)}
        >
          {names.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label>Använd inställningar från</label>
        <select
          data-testid="add-group-preset-select"
          value={presetFromId}
          onChange={(e) => setPresetFromId(e.target.value)}
        >
          <option value="">Standardinställningar</option>
          {sortedTournaments.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} / {t.group}
            </option>
          ))}
        </select>
      </div>
    </Dialog>
  )
}
