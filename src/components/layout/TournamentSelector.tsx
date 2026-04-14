import { useMemo } from 'react'
import type { RoundDto, TournamentListItemDto } from '../../types/api'

interface Props {
  tournaments: TournamentListItemDto[]
  selectedTournamentId: number | undefined
  onSelectTournament: (id: number | undefined) => void
  rounds: RoundDto[]
  selectedRound: number | undefined
  onSelectRound: (round: number | undefined) => void
}

export function TournamentSelector({
  tournaments,
  selectedTournamentId,
  onSelectTournament,
  rounds,
  selectedRound,
  onSelectRound,
}: Props) {
  // Derive unique tournament names
  const tournamentNames = useMemo(() => {
    const names = new Set(tournaments.map((t) => t.name))
    return Array.from(names).sort()
  }, [tournaments])

  // Get selected tournament's name for group filtering
  const selectedTournament = tournaments.find((t) => t.id === selectedTournamentId)
  const selectedName = selectedTournament?.name

  // Derive groups for selected tournament name
  const groups = useMemo(() => {
    if (!selectedName) return []
    return tournaments
      .filter((t) => t.name === selectedName)
      .map((t) => ({ id: t.id, group: t.group }))
  }, [tournaments, selectedName])

  const handleNameChange = (name: string) => {
    if (!name) {
      onSelectTournament(undefined)
      return
    }
    // Auto-select first group for this name
    const first = tournaments.find((t) => t.name === name)
    if (first) onSelectTournament(first.id)
  }

  const handleGroupChange = (id: string) => {
    onSelectTournament(id ? Number(id) : undefined)
  }

  const handleRoundChange = (round: string) => {
    onSelectRound(round ? Number(round) : undefined)
  }

  return (
    <fieldset className="tournament-selector" data-testid="tournament-selector">
      <legend>Aktiv turnering</legend>
      <span className="selector-field">
        <label>Turnering:</label>
        <select value={selectedName || ''} onChange={(e) => handleNameChange(e.target.value)}>
          <option value="">
            {tournamentNames.length > 0 ? `(${tournamentNames.length} turneringar)` : '---'}
          </option>
          {tournamentNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </span>

      <span className="selector-field">
        <label>Grupp:</label>
        <select
          value={selectedTournamentId ?? ''}
          onChange={(e) => handleGroupChange(e.target.value)}
          disabled={!selectedName}
        >
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.group}
            </option>
          ))}
        </select>
      </span>

      <span className="selector-field">
        <label>Rond:</label>
        <select
          value={selectedRound ?? ''}
          onChange={(e) => handleRoundChange(e.target.value)}
          disabled={rounds.length === 0}
        >
          {rounds.map((r) => (
            <option key={r.roundNr} value={r.roundNr}>
              Rond {r.roundNr}
            </option>
          ))}
        </select>
      </span>
    </fieldset>
  )
}
