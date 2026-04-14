import { useCallback } from 'react'
import { useStandings } from '../../hooks/useStandings'
import { useTableSort } from '../../hooks/useTableSort'
import { sv } from '../../lib/swedish-text'
import type { StandingDto } from '../../types/api'
import { EmptyState } from '../EmptyState'
import { SortableHeader } from '../SortableHeader'

interface Props {
  tournamentId: number
  round: number | undefined
  showELO?: boolean
  showGroup?: boolean
}

export function StandingsTab({ tournamentId, round, showELO, showGroup }: Props) {
  const { data: standings, isLoading } = useStandings(tournamentId, round)

  const getValue = useCallback((s: StandingDto, col: string): string | number | null => {
    if (col === 'place') return s.place
    if (col === 'name') return s.name
    if (col === 'group') return s.playerGroup
    if (col === 'club') return s.club
    if (col === 'rating') return s.rating
    if (col === 'score') return s.score
    // Tiebreak columns
    const tb = s.tiebreaks[col]
    if (tb != null) {
      const num = parseFloat(tb)
      return isNaN(num) ? tb : num
    }
    return null
  }, [])

  const { sorted, sort, toggleSort } = useTableSort(
    standings || [],
    { column: 'place', direction: 'asc' },
    getValue,
  )

  if (isLoading) return <div className="empty-state">Laddar...</div>
  if (!standings || standings.length === 0) {
    return <EmptyState icon="list" title={sv.common.noStandings} />
  }

  const tiebreakKeys = Object.keys(standings[0]?.tiebreaks || {})

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
              column="name"
              label={sv.columns.name}
              sort={sort}
              onToggle={toggleSort}
            />
            {showGroup && (
              <SortableHeader column="group" label="Grp" sort={sort} onToggle={toggleSort} />
            )}
            <SortableHeader
              column="club"
              label={sv.columns.club}
              sort={sort}
              onToggle={toggleSort}
            />
            {showELO && (
              <SortableHeader
                column="rating"
                label={sv.columns.rating}
                sort={sort}
                onToggle={toggleSort}
                className="number-cell"
              />
            )}
            <SortableHeader
              column="score"
              label={sv.columns.score}
              sort={sort}
              onToggle={toggleSort}
              className="score-cell"
            />
            {tiebreakKeys.map((key) => (
              <SortableHeader
                key={key}
                column={key}
                label={key}
                sort={sort}
                onToggle={toggleSort}
                className="score-cell"
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((s, i) => {
            const showPlace = i === 0 || sorted[i - 1].place !== s.place
            return (
              <tr key={i}>
                <td className="place-cell">{showPlace ? s.place : ''}</td>
                <td>{s.name}</td>
                {showGroup && <td>{s.playerGroup || ''}</td>}
                <td>{s.club || ''}</td>
                {showELO && <td className="number-cell">{s.rating > 0 ? s.rating : ''}</td>}
                <td className="score-cell">{s.scoreDisplay}</td>
                {tiebreakKeys.map((key) => (
                  <td key={key} className="score-cell">
                    {s.tiebreaks[key] || ''}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
