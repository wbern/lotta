import { useCallback } from 'react'
import { useClubStandings } from '../../hooks/useStandings'
import { useTableSort } from '../../hooks/useTableSort'
import { sv } from '../../lib/swedish-text'
import type { ClubStandingDto } from '../../types/api'
import { EmptyState } from '../EmptyState'
import { SortableHeader } from '../SortableHeader'

interface Props {
  tournamentId: number
  round: number | undefined
}

export function ClubStandingsTab({ tournamentId, round }: Props) {
  const { data: standings, isLoading } = useClubStandings(tournamentId, round)

  const getValue = useCallback((s: ClubStandingDto, col: string): string | number | null => {
    switch (col) {
      case 'place':
        return s.place
      case 'club':
        return s.club
      case 'score':
        return s.score
      default:
        return null
    }
  }, [])

  const { sorted, sort, toggleSort } = useTableSort(
    standings || [],
    { column: 'place', direction: 'asc' },
    getValue,
  )

  if (isLoading) return <div className="empty-state">Laddar...</div>
  if (!standings || standings.length === 0) {
    return <EmptyState icon="trophy" title={sv.common.noClubStandings} />
  }

  return (
    <div className="table-scroll" data-testid="scroll-container">
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
              label={sv.columns.club}
              sort={sort}
              onToggle={toggleSort}
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
                <td className="score-cell">{s.score}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
