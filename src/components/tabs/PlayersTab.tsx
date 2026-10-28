import { useCallback } from 'react'
import { withdrawnSuffix } from '../../domain/player-names'
import { getPlayerRating, normaliseRatingChoice } from '../../domain/ratings'
import { useTableSort } from '../../hooks/useTableSort'
import { useTournamentPlayers } from '../../hooks/useTournamentPlayers'
import { sv } from '../../lib/swedish-text'
import type { PlayerDto } from '../../types/api'
import { EmptyState } from '../EmptyState'
import { SortableHeader } from '../SortableHeader'

interface Props {
  tournamentId: number
  showELO?: boolean
  showGroup?: boolean
  /** The tournament's rating choice; the column shows the same rating as Lottning/Ställning. */
  ratingChoice?: string
}

export function PlayersTab({ tournamentId, showELO, showGroup, ratingChoice }: Props) {
  const { data: players, isLoading } = useTournamentPlayers(tournamentId)
  const choice = normaliseRatingChoice(ratingChoice)

  const getValue = useCallback(
    (p: PlayerDto, col: string): string | number | null => {
      if (col === 'name') return `${p.firstName}, ${p.lastName}`
      if (col === 'group') return p.playerGroup
      if (col === 'club') return p.club
      if (col === 'rating') return getPlayerRating(p, choice)
      return null
    },
    [choice],
  )

  const { sorted, sort, toggleSort } = useTableSort(
    players || [],
    { column: 'name', direction: 'asc' },
    getValue,
  )

  if (isLoading) return <div className="empty-state">Laddar...</div>
  if (!players || players.length === 0) {
    return <EmptyState icon="users" title={sv.common.noPlayers} />
  }

  return (
    <div className="table-scroll" data-testid="scroll-container">
      <table className="data-table" data-testid="data-table">
        <thead>
          <tr>
            <th className="col-narrow">Nr</th>
            <SortableHeader
              column="name"
              label={sv.columns.name}
              sort={sort}
              onToggle={toggleSort}
              className="col-name"
            />
            {showGroup && (
              <SortableHeader
                column="group"
                label="Grp"
                sort={sort}
                onToggle={toggleSort}
                className="col-narrow"
              />
            )}
            <SortableHeader
              column="club"
              label={sv.columns.club}
              sort={sort}
              onToggle={toggleSort}
              className="col-club"
            />
            {showELO && (
              <SortableHeader
                column="rating"
                label={sv.columns.rating}
                sort={sort}
                onToggle={toggleSort}
                className="number-cell col-number"
              />
            )}
          </tr>
        </thead>
        <tbody>
          {sorted.map((p, i) => (
            <tr key={p.id}>
              <td className="place-cell">{i + 1}</td>
              <td>
                {p.firstName} {p.lastName}
                {withdrawnSuffix(p.withdrawnFromRound)}
              </td>
              {showGroup && <td>{p.playerGroup || ''}</td>}
              <td>{p.club || ''}</td>
              {showELO && (
                <td className="number-cell">
                  {getPlayerRating(p, choice) > 0 ? getPlayerRating(p, choice) : ''}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
