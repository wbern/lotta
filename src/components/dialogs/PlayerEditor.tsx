import { useState } from 'react'
import { sv } from '../../lib/swedish-text'
import type { ClubDto, PlayerDto } from '../../types/api'

type RatingField = 'ratingI' | 'ratingQ' | 'ratingB'
type KField = 'ratingK' | 'ratingKQ' | 'ratingKB'
const fideRatingRows: { label: string; ratingKey: RatingField; kKey: KField }[] = [
  { label: sv.player.ratingELO, ratingKey: 'ratingI', kKey: 'ratingK' },
  { label: sv.player.rapidELO, ratingKey: 'ratingQ', kKey: 'ratingKQ' },
  { label: sv.player.blitzELO, ratingKey: 'ratingB', kKey: 'ratingKB' },
]

interface Props {
  player: Partial<PlayerDto>
  clubs: ClubDto[]
  onChange: (player: Partial<PlayerDto>) => void
  nameError?: string
  showTournamentFields?: boolean
  onAddClub?: (name: string) => Promise<number | void> | void
  onRenameClub?: (id: number, name: string) => void
  onDeleteClub?: (id: number) => void
}

export function PlayerEditor({
  player,
  clubs,
  onChange,
  showTournamentFields,
  nameError,
  onAddClub,
  onRenameClub,
  onDeleteClub,
}: Props) {
  const [editorTab, setEditorTab] = useState<'main' | 'fide' | 'other'>('main')
  const update = (fields: Partial<PlayerDto>) => onChange({ ...player, ...fields })

  const handleAddClub = async () => {
    const name = prompt(sv.club.enterName)
    if (name?.trim()) {
      const newId = await onAddClub?.(name.trim())
      if (newId && !player.clubIndex) {
        update({ clubIndex: newId })
      }
    }
  }

  const handleRenameClub = () => {
    const id = player.clubIndex
    if (!id) return
    const current = clubs.find((c) => c.id === id)
    const name = prompt(sv.club.enterName, current?.name || '')
    if (name?.trim()) onRenameClub?.(id, name.trim())
  }

  const handleDeleteClub = () => {
    const id = player.clubIndex
    if (!id) return
    const current = clubs.find((c) => c.id === id)
    if (confirm(`${sv.common.delete} "${current?.name}"?`)) {
      onDeleteClub?.(id)
      update({ clubIndex: 0 })
    }
  }

  return (
    <div>
      {nameError && (
        <div
          data-testid="name-error"
          style={{
            color: 'var(--color-danger)',
            fontSize: 'var(--font-size-small)',
            marginBottom: 8,
          }}
        >
          {nameError}
        </div>
      )}

      <div className="form-group">
        <label>{sv.player.firstName}</label>
        <input
          data-testid="first-name-input"
          type="text"
          value={player.firstName || ''}
          onChange={(e) => update({ firstName: e.target.value })}
        />
      </div>
      <div className="form-group">
        <label>{sv.player.lastName}</label>
        <input
          data-testid="last-name-input"
          type="text"
          value={player.lastName || ''}
          onChange={(e) => update({ lastName: e.target.value })}
        />
      </div>

      <div className="form-group">
        <label>{sv.player.club}</label>
        <div className="club-row">
          <select
            value={player.clubIndex || 0}
            onChange={(e) => update({ clubIndex: Number(e.target.value) })}
          >
            <option value={0}>---</option>
            {clubs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {onAddClub && (
            <div className="club-buttons">
              <button type="button" className="btn btn-small" onClick={handleAddClub}>
                {sv.common.add}
              </button>
              <button
                type="button"
                className="btn btn-small"
                onClick={handleRenameClub}
                disabled={!player.clubIndex}
              >
                {sv.common.change}
              </button>
              <button
                type="button"
                className="btn btn-small"
                onClick={handleDeleteClub}
                disabled={!player.clubIndex}
              >
                {sv.common.delete}
              </button>
            </div>
          )}
        </div>
      </div>

      {showTournamentFields && (
        <fieldset
          style={{ border: '1px solid var(--color-border)', padding: '8px', marginBottom: 12 }}
        >
          <legend
            style={{
              fontSize: 'var(--font-size-small)',
              color: 'var(--color-text-muted)',
              padding: '0 4px',
            }}
          >
            {sv.player.tournamentSettings}
          </legend>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <input
              data-testid="withdrawn-checkbox"
              type="checkbox"
              checked={(player.withdrawnFromRound ?? -1) >= 1}
              onChange={(e) => update({ withdrawnFromRound: e.target.checked ? 1 : -1 })}
            />
            {sv.player.withdrawn}
          </label>
          {(player.withdrawnFromRound ?? -1) >= 1 && (
            <div className="form-group" style={{ marginLeft: 24 }}>
              <label>{sv.player.fromRound}</label>
              <input
                data-testid="withdrawn-round-input"
                type="number"
                min={1}
                value={player.withdrawnFromRound}
                onChange={(e) => update({ withdrawnFromRound: Number(e.target.value) })}
              />
            </div>
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <input
              data-testid="tiebreak-checkbox"
              type="checkbox"
              checked={(player.manualTiebreak ?? 0) !== 0}
              onChange={(e) => update({ manualTiebreak: e.target.checked ? 1 : 0 })}
            />
            {sv.player.manualTiebreak}
          </label>
          {(player.manualTiebreak ?? 0) !== 0 && (
            <div className="form-group" style={{ marginLeft: 24 }}>
              <label>{sv.player.tiebreakValue}</label>
              <input
                data-testid="tiebreak-value-input"
                type="number"
                value={player.manualTiebreak || 0}
                onChange={(e) => update({ manualTiebreak: Number(e.target.value) })}
              />
            </div>
          )}
        </fieldset>
      )}

      <div className="editor-tabs">
        <button
          data-testid="editor-tab-main"
          className={`editor-tab ${editorTab === 'main' ? 'active' : ''}`}
          onClick={() => setEditorTab('main')}
          type="button"
        >
          {sv.player.mainTab}
        </button>
        <button
          data-testid="editor-tab-fide"
          className={`editor-tab ${editorTab === 'fide' ? 'active' : ''}`}
          onClick={() => setEditorTab('fide')}
          type="button"
        >
          {sv.player.fideTab}
        </button>
        <button
          data-testid="editor-tab-other"
          className={`editor-tab ${editorTab === 'other' ? 'active' : ''}`}
          onClick={() => setEditorTab('other')}
          type="button"
        >
          {sv.player.otherTab}
        </button>
      </div>

      {editorTab === 'main' && (
        <div>
          <div className="form-group">
            <label>{sv.player.title}</label>
            <input
              type="text"
              value={player.title || ''}
              onChange={(e) => update({ title: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>{sv.columns.group}</label>
            <input
              type="text"
              value={player.playerGroup || ''}
              onChange={(e) => update({ playerGroup: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>{sv.player.sex}</label>
            <select value={player.sex || ''} onChange={(e) => update({ sex: e.target.value })}>
              <option value="">---</option>
              <option value="M">M</option>
              <option value="K">K</option>
            </select>
          </div>

          <div className="form-group">
            <label>{sv.player.birthdate}</label>
            <input
              type="text"
              value={player.birthdate || ''}
              onChange={(e) => update({ birthdate: e.target.value })}
              placeholder="YYYY-MM-DD"
            />
          </div>
        </div>
      )}

      {editorTab === 'fide' && (
        <fieldset
          style={{ border: '1px solid var(--color-border)', padding: '8px', marginBottom: 12 }}
        >
          <legend
            style={{
              fontSize: 'var(--font-size-small)',
              color: 'var(--color-text-muted)',
              padding: '0 4px',
            }}
          >
            {sv.player.fideInformation}
          </legend>
          {fideRatingRows.map(({ label, ratingKey, kKey }) => (
            <div className="form-row" key={ratingKey}>
              <div className="form-group">
                <label>{label}</label>
                <input
                  type="number"
                  value={player[ratingKey] || 0}
                  onChange={(e) => update({ [ratingKey]: Number(e.target.value) })}
                />
              </div>
              <div className="form-group">
                <label>{sv.player.kFactor}</label>
                <input
                  type="number"
                  value={player[kKey] || 0}
                  onChange={(e) => update({ [kKey]: Number(e.target.value) })}
                />
              </div>
            </div>
          ))}
        </fieldset>
      )}

      {editorTab === 'other' && (
        <div>
          <div className="form-group">
            <label>{sv.player.ssfId}</label>
            <input
              type="number"
              value={player.ssfId || 0}
              onChange={(e) => update({ ssfId: Number(e.target.value) })}
            />
          </div>
          <div className="form-group">
            <label>{sv.player.federation}</label>
            <input
              type="text"
              value={player.federation || ''}
              onChange={(e) => update({ federation: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>{sv.player.fideId}</label>
            <input
              type="number"
              value={player.fideId || 0}
              onChange={(e) => update({ fideId: Number(e.target.value) })}
            />
          </div>
        </div>
      )}
    </div>
  )
}
