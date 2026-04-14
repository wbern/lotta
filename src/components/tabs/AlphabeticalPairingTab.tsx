import { useCallback, useMemo } from 'react'
import { useTableSort } from '../../hooks/useTableSort'
import { sv } from '../../lib/swedish-text'
import type { RoundDto } from '../../types/api'
import { EmptyState } from '../EmptyState'
import { SortableHeader } from '../SortableHeader'

interface Props {
  tournamentId: number
  rounds: RoundDto[]
  activeRound?: number
}

interface PlayerRow {
  name: string
  club: string
  board: string
}

export function AlphabeticalPairingTab({ rounds, activeRound }: Props) {
  // Use the active round, or latest round if not specified
  const roundNr = activeRound ?? (rounds.length > 0 ? rounds[rounds.length - 1].roundNr : undefined)
  const round = rounds.find((r) => r.roundNr === roundNr)

  const playerRows = useMemo(() => {
    if (!round) return []
    const rows: PlayerRow[] = []

    for (const game of round.games) {
      if (game.whitePlayer) {
        let board: string
        if (game.blackPlayer == null) {
          board = 'Fri'
        } else {
          board = `${game.boardNr} V`
        }
        rows.push({
          name: game.whitePlayer.name,
          club: game.whitePlayer.club || '',
          board,
        })
      }
      if (game.blackPlayer) {
        let board: string
        if (game.whitePlayer == null) {
          board = 'Fri'
        } else {
          board = `${game.boardNr} S`
        }
        rows.push({
          name: game.blackPlayer.name,
          club: game.blackPlayer.club || '',
          board,
        })
      }
    }

    return rows
  }, [round])

  const getValue = useCallback((row: PlayerRow, col: string): string | number | null => {
    if (col === 'name') return row.name
    if (col === 'club') return row.club
    if (col === 'board') return row.board
    return null
  }, [])

  const { sorted, sort, toggleSort } = useTableSort(
    playerRows,
    { column: 'name', direction: 'asc' },
    getValue,
  )

  if (rounds.length === 0 || !round) {
    return <EmptyState icon="list" title={sv.common.noRounds} />
  }

  return (
    <div className="table-scroll">
      <table className="data-table" data-testid="data-table">
        <thead>
          <tr>
            <SortableHeader
              column="name"
              label={sv.columns.name}
              sort={sort}
              onToggle={toggleSort}
            />
            <SortableHeader
              column="club"
              label={sv.columns.club}
              sort={sort}
              onToggle={toggleSort}
            />
            <SortableHeader
              column="board"
              label={sv.columns.board}
              sort={sort}
              onToggle={toggleSort}
              style={{ textAlign: 'center' }}
            />
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={i}>
              <td>{row.name}</td>
              <td>{row.club}</td>
              <td style={{ textAlign: 'center' }}>{row.board}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
