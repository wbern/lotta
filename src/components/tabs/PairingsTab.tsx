import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ResultConflictError } from '../../api/result-command'
import { deleteGame, deleteGames } from '../../api/results'
import { calculateScores, formatResultLabel } from '../../domain/scoring'
import { useContextMenu } from '../../hooks/useContextMenu'
import { useRound } from '../../hooks/useRounds'
import { useShiftSelect } from '../../hooks/useShiftSelect'
import { useSetResult } from '../../hooks/useStandings'
import { sv } from '../../lib/swedish-text'
import type { GameDto, ResultType, RoundDto } from '../../types/api'
import { EditScoreDialog } from '../dialogs/EditScoreDialog'
import { EmptyState } from '../EmptyState'

interface Props {
  tournamentId: number
  round: number | undefined
  rounds: RoundDto[]
  onBoardSelect?: (boardNr: number | undefined) => void
  onEditBoard?: (boardNr: number) => void
  showELO?: boolean
  pointsPerGame?: number
  maxPointsImmediately?: boolean
  chess4?: boolean
}

function resultTypeFromScores(ws: number, bs: number): ResultType {
  if (ws > bs) return 'WHITE_WIN'
  if (bs > ws) return 'BLACK_WIN'
  if (ws > 0) return 'DRAW'
  return 'NO_RESULT'
}

export function PairingsTab({
  tournamentId,
  round,
  rounds,
  onBoardSelect,
  onEditBoard,
  showELO,
  pointsPerGame = 1,
  maxPointsImmediately = false,
  chess4 = false,
}: Props) {
  const roundNr = round ?? (rounds.length > 0 ? rounds[rounds.length - 1].roundNr : undefined)
  const { data: roundData } = useRound(tournamentId, roundNr)
  const setResultMutation = useSetResult(tournamentId, roundNr)
  const queryClient = useQueryClient()
  const [selectedBoards, setSelectedBoards] = useState<Set<number>>(new Set())
  const contextMenu = useContextMenu()
  const [editScoreGame, setEditScoreGame] = useState<GameDto | null>(null)

  const conflictError =
    setResultMutation.error instanceof ResultConflictError ? setResultMutation.error : null
  const conflictBoardNr = conflictError
    ? (setResultMutation.variables as { boardNr: number } | undefined)?.boardNr
    : null
  const resetRef = useRef(setResultMutation.reset)
  useEffect(() => {
    resetRef.current = setResultMutation.reset
  })

  useEffect(() => {
    if (!conflictError) return
    const timer = setTimeout(() => resetRef.current(), 5000)
    return () => clearTimeout(timer)
  }, [conflictError])

  const games = useMemo(() => roundData?.games || [], [roundData?.games])

  // Single selected board for result entry and edit operations
  const singleSelected = selectedBoards.size === 1 ? [...selectedBoards][0] : null

  const getBoardNr = useCallback((g: GameDto) => g.boardNr, [])
  const { handleClick: shiftSelectClick } = useShiftSelect(games, setSelectedBoards, getBoardNr)

  const toggleBoard = useCallback(
    (boardNr: number, event: React.MouseEvent) => {
      shiftSelectClick(boardNr, event)
      onBoardSelect?.(boardNr)
    },
    [shiftSelectClick, onBoardSelect],
  )

  const selectBoard = useCallback(
    (boardNr: number | null) => {
      setSelectedBoards(boardNr != null ? new Set([boardNr]) : new Set())
      onBoardSelect?.(boardNr ?? undefined)
    },
    [onBoardSelect],
  )

  const setResult = useCallback(
    (boardNr: number, resultType: ResultType, whiteScore?: number, blackScore?: number) => {
      const currentGame = games.find((g) => g.boardNr === boardNr)
      const expectedPrior = currentGame?.resultType ?? 'NO_RESULT'
      setResultMutation.mutate({
        boardNr,
        req: { resultType, whiteScore, blackScore, expectedPrior },
      })
    },
    [setResultMutation, games],
  )

  const deleteSelectedBoards = useCallback(async () => {
    if (selectedBoards.size === 0 || tournamentId == null || roundNr == null) return
    const boardNrs = [...selectedBoards]
    const msg =
      boardNrs.length === 1
        ? `Är du säker på att du vill ta bort bord ${boardNrs[0]}?`
        : `Är du säker på att du vill ta bort ${boardNrs.length} bord?`
    if (confirm(msg)) {
      if (boardNrs.length === 1) {
        await deleteGame(tournamentId, roundNr, boardNrs[0])
      } else {
        await deleteGames(tournamentId, roundNr, boardNrs)
      }
      setSelectedBoards(new Set())
      queryClient.invalidateQueries({ queryKey: ['tournaments', tournamentId, 'rounds'] })
    }
  }, [selectedBoards, tournamentId, roundNr, queryClient])

  const scoringConfig = useMemo(() => ({ pointsPerGame, chess4 }), [pointsPerGame, chess4])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (selectedBoards.size === 0 || !roundNr) return
      // Don't handle shortcuts when a dialog input is focused
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return

      const key = e.key.toLowerCase()

      // Delete works with any selection size
      if (key === 'delete' || key === 'backspace') {
        e.preventDefault()
        deleteSelectedBoards()
        return
      }

      // Result keys only apply with exactly one board selected
      if (singleSelected == null) return

      let whiteScore: number | undefined
      let blackScore: number | undefined
      let resultType: ResultType | null = null

      if (chess4) {
        // Chess4: semantic keys map to result types, numeric keys set white's score
        // Valid scores: 1-3 (BLACK_WIN), 2-2 (DRAW), 3-1 (WHITE_WIN)
        if (key === 'v' || key === '3') {
          const scores = calculateScores('WHITE_WIN', scoringConfig)
          whiteScore = scores.whiteScore
          blackScore = scores.blackScore
          resultType = 'WHITE_WIN'
        } else if (key === 'r' || key === 'ö' || key === '2') {
          const scores = calculateScores('DRAW', scoringConfig)
          whiteScore = scores.whiteScore
          blackScore = scores.blackScore
          resultType = 'DRAW'
        } else if (key === 'f' || key === '1') {
          const scores = calculateScores('BLACK_WIN', scoringConfig)
          whiteScore = scores.whiteScore
          blackScore = scores.blackScore
          resultType = 'BLACK_WIN'
        } else if (key === '0') {
          // '0' clears the result in chess4 mode
          resultType = 'NO_RESULT'
          whiteScore = 0
          blackScore = 0
        } else if (key === ' ') {
          e.preventDefault()
          resultType = 'NO_RESULT'
          whiteScore = 0
          blackScore = 0
        }
      } else {
        // Normal chess: effective ppg is 1 when maxPointsImmediately is off
        const ppg = maxPointsImmediately ? pointsPerGame : 1
        const effectiveConfig = { pointsPerGame: ppg, chess4: false }
        const numKey = Number(key)

        if (key === 'f') {
          const scores = calculateScores('BLACK_WIN', effectiveConfig)
          whiteScore = scores.whiteScore
          blackScore = scores.blackScore
          resultType = 'BLACK_WIN'
        } else if (key === 'r' || key === 'ö') {
          const scores = calculateScores('DRAW', effectiveConfig)
          whiteScore = scores.whiteScore
          blackScore = scores.blackScore
          resultType = 'DRAW'
        } else if (key === 'v') {
          const scores = calculateScores('WHITE_WIN', effectiveConfig)
          whiteScore = scores.whiteScore
          blackScore = scores.blackScore
          resultType = 'WHITE_WIN'
        } else if (key >= '0' && key <= '5' && numKey <= ppg) {
          whiteScore = numKey
          blackScore = ppg - numKey
          resultType = resultTypeFromScores(whiteScore, blackScore)
        } else if (key === ' ') {
          e.preventDefault()
          resultType = 'NO_RESULT'
          whiteScore = 0
          blackScore = 0
        }
      }

      if (resultType) {
        setResult(singleSelected, resultType, whiteScore, blackScore)
        // Auto-advance when result is a completed game
        const effectivePpg = chess4 || maxPointsImmediately ? pointsPerGame : 1
        const isFinished =
          whiteScore != null && blackScore != null && whiteScore + blackScore === effectivePpg
        if (isFinished) {
          const idx = games.findIndex((g) => g.boardNr === singleSelected)
          if (idx >= 0 && idx < games.length - 1) {
            const nextBoardNr = games[idx + 1].boardNr
            selectBoard(nextBoardNr)
            const nextRow = document.querySelector<HTMLElement>(
              `tr[data-board-nr="${nextBoardNr}"]`,
            )
            nextRow?.focus()
          }
        }
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [
    selectedBoards,
    singleSelected,
    roundNr,
    games,
    setResult,
    selectBoard,
    deleteSelectedBoards,
    pointsPerGame,
    maxPointsImmediately,
    chess4,
    scoringConfig,
  ])

  const handleDoubleClick = (game: GameDto) => {
    onEditBoard?.(game.boardNr)
  }

  const handleEditScoreSave = (whiteScore: number, blackScore: number) => {
    if (editScoreGame) {
      const resultType = resultTypeFromScores(whiteScore, blackScore)
      setResult(editScoreGame.boardNr, resultType, whiteScore, blackScore)
      setEditScoreGame(null)
    }
  }

  const handleContextEditScore = () => {
    if (contextMenu.state) {
      const game = games.find((g) => g.boardNr === contextMenu.state!.boardNr)
      if (game) {
        setEditScoreGame(game)
      }
    }
    contextMenu.close()
  }

  if (!roundNr) {
    return <EmptyState icon="pawn" title={sv.common.noRoundPaired} />
  }

  if (games.length === 0) {
    return <EmptyState icon="pawn" title={sv.common.noGamesInRound} />
  }

  return (
    <>
      {conflictError && (
        <div className="conflict-notification" role="alert" data-testid="conflict-notification">
          Bord {conflictBoardNr} har redan resultat{' '}
          {formatResultLabel(conflictError.current, { chess4, pointsPerGame })}
        </div>
      )}
      <div className="table-scroll" data-testid="scroll-container">
        <table className="data-table" data-testid="data-table">
          <thead>
            <tr>
              <th className="col-narrow">{sv.columns.board}</th>
              <th className="col-name">{sv.columns.whitePlayer}</th>
              {showELO && <th className="col-number col-rating">{sv.columns.rating}</th>}
              <th className="col-result result-cell">{sv.columns.result}</th>
              <th className="col-name">{sv.columns.blackPlayer}</th>
              {showELO && <th className="col-number col-rating">{sv.columns.rating}</th>}
            </tr>
          </thead>
          <tbody>
            {games.map((game) => (
              <tr
                key={game.boardNr}
                data-board-nr={game.boardNr}
                className={selectedBoards.has(game.boardNr) ? 'selected' : ''}
                onClick={(e) => {
                  toggleBoard(game.boardNr, e)
                  e.currentTarget.focus()
                }}
                onDoubleClick={() => handleDoubleClick(game)}
                onContextMenu={(e) => contextMenu.open(e, game.boardNr)}
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget) return
                  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    e.preventDefault()
                    const idx = games.findIndex((g) => g.boardNr === game.boardNr)
                    const nextIdx = e.key === 'ArrowDown' ? idx + 1 : idx - 1
                    if (nextIdx < 0 || nextIdx >= games.length) return
                    selectBoard(games[nextIdx].boardNr)
                    const sibling =
                      e.key === 'ArrowDown'
                        ? e.currentTarget.nextElementSibling
                        : e.currentTarget.previousElementSibling
                    if (sibling instanceof HTMLElement) sibling.focus()
                  }
                }}
                tabIndex={0}
              >
                <td className="place-cell">{game.boardNr}</td>
                <td>{game.whitePlayer?.name || 'frirond'}</td>
                {showELO && (
                  <td className="number-cell col-rating">{game.whitePlayer?.rating || ''}</td>
                )}
                <td className="result-cell">
                  <button
                    className="result-dropdown"
                    data-testid={`result-dropdown-${game.boardNr}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      contextMenu.open(e, game.boardNr)
                    }}
                  >
                    {game.resultDisplay} <span className="result-dropdown-arrow">▾</span>
                  </button>
                </td>
                <td>{game.blackPlayer?.name || 'frirond'}</td>
                {showELO && (
                  <td className="number-cell col-rating">{game.blackPlayer?.rating || ''}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {contextMenu.state && (
        <ContextMenuPopup
          x={contextMenu.state.x}
          y={contextMenu.state.y}
          onSelect={(resultType) => {
            const scores = calculateScores(resultType, scoringConfig)
            setResult(contextMenu.state!.boardNr, resultType, scores.whiteScore, scores.blackScore)
            contextMenu.close()
          }}
          onEditScore={handleContextEditScore}
          onClose={contextMenu.close}
        />
      )}

      <EditScoreDialog
        open={editScoreGame != null}
        game={editScoreGame}
        pointsPerGame={pointsPerGame}
        onSave={handleEditScoreSave}
        onClose={() => setEditScoreGame(null)}
      />
    </>
  )
}

function ContextMenuPopup({
  x,
  y,
  onSelect,
  onEditScore,
}: {
  x: number
  y: number
  onSelect: (type: ResultType) => void
  onEditScore: () => void
  onClose: () => void
}) {
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 0
  const flipUp = viewportHeight > 0 && y > viewportHeight / 2
  const positionStyle = flipUp ? { left: x, bottom: viewportHeight - y } : { left: x, top: y }
  return (
    <div className="context-menu" style={positionStyle}>
      <button onClick={() => onSelect('NO_RESULT')}>
        {sv.contextMenu.notPlayed}
        <span className="context-menu-shortcut" data-testid="shortcut-no-result">
          Space
        </span>
      </button>
      <button onClick={() => onSelect('WHITE_WIN')}>
        {sv.contextMenu.whiteWin}
        <span className="context-menu-shortcut" data-testid="shortcut-white-win">
          V
        </span>
      </button>
      <button onClick={() => onSelect('DRAW')}>
        {sv.contextMenu.draw}
        <span className="context-menu-shortcut" data-testid="shortcut-draw">
          R
        </span>
      </button>
      <button onClick={() => onSelect('BLACK_WIN')}>
        {sv.contextMenu.blackWin}
        <span className="context-menu-shortcut" data-testid="shortcut-black-win">
          F
        </span>
      </button>
      <div className="context-submenu">
        <button>{sv.contextMenu.walkOver} ▸</button>
        <div className="context-submenu-items">
          <button onClick={() => onSelect('WHITE_WIN_WO')}>{sv.contextMenu.whiteWinWO}</button>
          <button onClick={() => onSelect('BLACK_WIN_WO')}>{sv.contextMenu.blackWinWO}</button>
          <button onClick={() => onSelect('DOUBLE_WO')}>{sv.contextMenu.doubleWO}</button>
        </div>
      </div>
      <button onClick={() => onSelect('POSTPONED')}>{sv.contextMenu.postponed}</button>
      <button onClick={() => onSelect('CANCELLED')}>{sv.contextMenu.cancelled}</button>
      <button onClick={onEditScore}>{sv.contextMenu.editScore}</button>
    </div>
  )
}
