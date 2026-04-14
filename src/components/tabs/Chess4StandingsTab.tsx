import { useCallback } from 'react'
import { useChess4Standings } from '../../hooks/useStandings'
import { useTableSort } from '../../hooks/useTableSort'
import { sv } from '../../lib/swedish-text'
import type { Chess4StandingDto } from '../../types/api'
import { EmptyState } from '../EmptyState'
import { SortableHeader } from '../SortableHeader'

interface Props {
  tournamentId: number
  round: number | undefined
}

export function Chess4StandingsTab({ tournamentId, round }: Props) {
  const { data: standings, isLoading } = useChess4Standings(tournamentId, round)

  const getValue = useCallback((s: Chess4StandingDto, col: string): string | number | null => {
    if (col === 'place') return s.place
    if (col === 'club') return s.club
    if (col === 'playerCount') return s.playerCount
    if (col === 'teamSize') return s.chess4Members
    if (col === 'score') return s.score
    return null
  }, [])

  const { sorted, sort, toggleSort } = useTableSort(
    standings || [],
    { column: 'place', direction: 'asc' },
    getValue,
  )

  if (isLoading) return <div className="empty-state">Laddar...</div>
  if (!standings || standings.length === 0) {
    return <EmptyState icon="trophy" title={sv.common.noChess4Standings} />
  }

  // jscpd:ignore-start — structurally similar to ClubStandingsTab by design
  return (
    <div className="table-scroll">
      <table className="data-table" data-testid="data-table">
        <thead>
          <tr>
            <SortableHeader
              column="place"
              label={sv.columns.place}
              sort={sort}
              onToggle={toggleSort}
              className="place-cell"
            />
            <SortableHeader
              column="club"
              label={sv.columns.klass}
              sort={sort}
              onToggle={toggleSort}
            />
            {/* jscpd:ignore-end */}
            <SortableHeader
              column="playerCount"
              label={sv.columns.players}
              sort={sort}
              onToggle={toggleSort}
              className="number-cell"
            />
            <SortableHeader
              column="teamSize"
              label={sv.columns.teamSize}
              sort={sort}
              onToggle={toggleSort}
              className="number-cell"
            />
            <SortableHeader
              column="score"
              label={sv.columns.score}
              sort={sort}
              onToggle={toggleSort}
              className="score-cell"
            />
          </tr>
        </thead>
        <tbody>
          {sorted.map((s, i) => {
            const showPlace = i === 0 || sorted[i - 1].place !== s.place
            return (
              <tr key={i}>
                <td className="place-cell">{showPlace ? s.place : ''}</td>
                <td>{s.club}</td>
                <td className="number-cell">{s.playerCount}</td>
                <td className="number-cell">{s.chess4Members}</td>
                <td className="score-cell">{s.score}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
