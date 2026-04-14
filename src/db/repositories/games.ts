import type { Database } from 'sql.js'
import { calculateScores } from '../../domain/scoring.ts'
import type {
  GameDto,
  PlayerSummaryDto,
  ResultType,
  RoundDto,
  SetResultRequest,
} from '../../types/api.ts'
import { formatPlayerName, getPlayerPresentation } from '../format-name.ts'

const DEFAULT_SCORES: Record<ResultType, [number, number]> = {
  NO_RESULT: [0, 0],
  WHITE_WIN: [1, 0],
  DRAW: [0.5, 0.5],
  BLACK_WIN: [0, 1],
  WHITE_WIN_WO: [1, 0],
  BLACK_WIN_WO: [0, 1],
  DOUBLE_WO: [0, 0],
  POSTPONED: [1, 1],
  CANCELLED: [0, 0],
}

const RESULT_TYPES: ResultType[] = [
  'NO_RESULT',
  'WHITE_WIN',
  'DRAW',
  'BLACK_WIN',
  'WHITE_WIN_WO',
  'BLACK_WIN_WO',
  'DOUBLE_WO',
  'POSTPONED',
  'CANCELLED',
]

function formatResultDisplay(
  resultType: ResultType,
  whiteScore: number,
  blackScore: number,
): string {
  if (resultType === 'NO_RESULT') return ''
  if (resultType === 'POSTPONED') return 'uppskj'
  if (resultType === 'CANCELLED') return 'inställd'

  const formatScore = (score: number): string => {
    const intPart = Math.floor(score)
    const hasHalf = score - intPart >= 0.4
    if (intPart === 0 && hasHalf) return '½'
    if (intPart === 0 && !hasHalf) return '0'
    return hasHalf ? `${intPart}½` : `${intPart}`
  }

  const suffix =
    resultType === 'WHITE_WIN_WO' || resultType === 'BLACK_WIN_WO' || resultType === 'DOUBLE_WO'
      ? ' wo'
      : ''

  return `${formatScore(whiteScore)}-${formatScore(blackScore)}${suffix}`
}

export class GameRepository {
  private db: Database
  constructor(db: Database) {
    this.db = db
  }

  listRounds(tournamentId: number): RoundDto[] {
    const result = this.db.exec(
      `SELECT DISTINCT round FROM tournamentgames WHERE tournament = ? ORDER BY round`,
      [tournamentId],
    )
    if (result.length === 0) return []

    return result[0].values.map((row) => {
      const roundNr = row[0] as number
      return this.getRound(tournamentId, roundNr)!
    })
  }

  getRound(tournamentId: number, roundNr: number): RoundDto | null {
    const ratingExpr = this.ratingExpression(tournamentId)
    const result = this.db.exec(
      `SELECT
        g.boardnr, g.round, g.whiteplayer, g.blackplayer,
        g.resulttype, g.whitescore, g.blackscore,
        g.whiteplayerlotnr, g.blackplayerlotnr,
        wp.lastname AS wlast, wp.firstname AS wfirst, wc.club AS wclub,
        ${ratingExpr.replace(/P\./g, 'wp.')} AS wrating, wp."index" AS wpid,
        bp.lastname AS blast, bp.firstname AS bfirst, bc.club AS bclub,
        ${ratingExpr.replace(/P\./g, 'bp.')} AS brating, bp."index" AS bpid
      FROM tournamentgames g
      LEFT JOIN tournamentplayers wp ON wp."index" = g.whiteplayer
      LEFT JOIN clubs wc ON wc."index" = wp.clubindex
      LEFT JOIN tournamentplayers bp ON bp."index" = g.blackplayer
      LEFT JOIN clubs bc ON bc."index" = bp.clubindex
      WHERE g.tournament = ? AND g.round = ?
      ORDER BY g.boardnr`,
      [tournamentId, roundNr],
    )

    if (result.length === 0) return null

    const presentation = getPlayerPresentation(this.db)

    let hasAllResults = true
    const games: GameDto[] = result[0].values.map((row) => {
      const resultTypeIndex = row[4] as number
      const resultType = RESULT_TYPES[resultTypeIndex] ?? 'NO_RESULT'
      const whiteScore = row[5] as number
      const blackScore = row[6] as number

      if (resultType === 'NO_RESULT') hasAllResults = false

      const whitePlayer: PlayerSummaryDto | null =
        row[13] != null
          ? {
              id: row[13] as number,
              name: formatPlayerName((row[10] as string) ?? '', row[9] as string, presentation),
              club: row[11] as string | null,
              rating: (row[12] as number) ?? 0,
              lotNr: (row[7] as number) ?? 0,
            }
          : null

      const blackPlayer: PlayerSummaryDto | null =
        row[18] != null
          ? {
              id: row[18] as number,
              name: formatPlayerName((row[15] as string) ?? '', row[14] as string, presentation),
              club: row[16] as string | null,
              rating: (row[17] as number) ?? 0,
              lotNr: (row[8] as number) ?? 0,
            }
          : null

      return {
        boardNr: row[0] as number,
        roundNr: row[1] as number,
        whitePlayer,
        blackPlayer,
        resultType,
        whiteScore,
        blackScore,
        resultDisplay: formatResultDisplay(resultType, whiteScore, blackScore),
      }
    })

    return {
      roundNr,
      hasAllResults,
      gameCount: games.length,
      games,
    }
  }

  setResult(
    tournamentId: number,
    roundNr: number,
    boardNr: number,
    req: SetResultRequest,
  ): GameDto {
    const resultTypeIndex = RESULT_TYPES.indexOf(req.resultType)
    const [defaultWhite, defaultBlack] = this.defaultScoresForTournament(
      tournamentId,
      req.resultType,
    )
    const whiteScore = req.whiteScore ?? defaultWhite
    const blackScore = req.blackScore ?? defaultBlack

    this.db.run(
      `UPDATE tournamentgames SET resulttype = ?, whitescore = ?, blackscore = ?
       WHERE tournament = ? AND round = ? AND boardnr = ?`,
      [resultTypeIndex, whiteScore, blackScore, tournamentId, roundNr, boardNr],
    )

    const round = this.getRound(tournamentId, roundNr)!
    return round.games.find((g) => g.boardNr === boardNr)!
  }

  private defaultScoresForTournament(
    tournamentId: number,
    resultType: ResultType,
  ): [number, number] {
    const rc = this.db.exec('SELECT chess4, pointspergame FROM tournaments WHERE "index" = ?', [
      tournamentId,
    ])
    if (rc.length === 0 || rc[0].values.length === 0) return DEFAULT_SCORES[resultType]
    const row = rc[0].values[0]
    const chess4 = row[0] === 'true'
    const pointsPerGame = row[1] as number
    const scores = calculateScores(resultType, { chess4, pointsPerGame })
    return [scores.whiteScore, scores.blackScore]
  }

  insertGame(
    tournamentId: number,
    roundNr: number,
    boardNr: number,
    whitePlayerId: number | null,
    blackPlayerId: number | null,
    whiteLotNr = 0,
    blackLotNr = 0,
  ): void {
    this.db.run(
      `INSERT INTO tournamentgames (tournament, round, boardnr, whiteplayer, blackplayer, resulttype, whitescore, blackscore, whiteplayerlotnr, blackplayerlotnr)
       VALUES (?, ?, ?, ?, ?, 0, 0.0, 0.0, ?, ?)`,
      [tournamentId, roundNr, boardNr, whitePlayerId, blackPlayerId, whiteLotNr, blackLotNr],
    )
  }

  deleteGame(tournamentId: number, roundNr: number, boardNr: number): void {
    this.db.run('DELETE FROM tournamentgames WHERE tournament = ? AND round = ? AND boardnr = ?', [
      tournamentId,
      roundNr,
      boardNr,
    ])
  }

  deleteGames(tournamentId: number, roundNr: number, boardNrs: number[]): void {
    for (const boardNr of boardNrs) this.deleteGame(tournamentId, roundNr, boardNr)
  }

  updateGame(
    tournamentId: number,
    roundNr: number,
    boardNr: number,
    whitePlayerId: number | null,
    blackPlayerId: number | null,
  ): void {
    this.db.run(
      `UPDATE tournamentgames SET whiteplayer = ?, blackplayer = ?
       WHERE tournament = ? AND round = ? AND boardnr = ?`,
      [whitePlayerId, blackPlayerId, tournamentId, roundNr, boardNr],
    )
  }

  getNextBoardNr(tournamentId: number, roundNr: number): number {
    const result = this.db.exec(
      'SELECT COALESCE(MAX(boardnr), 0) + 1 FROM tournamentgames WHERE tournament = ? AND round = ?',
      [tournamentId, roundNr],
    )
    return result[0].values[0][0] as number
  }

  setLotNumbers(
    tournamentId: number,
    roundNr: number,
    boardNr: number,
    whiteLotNr: number,
    blackLotNr: number,
  ): void {
    this.db.run(
      `UPDATE tournamentgames SET whiteplayerlotnr = ?, blackplayerlotnr = ?
       WHERE tournament = ? AND round = ? AND boardnr = ?`,
      [whiteLotNr, blackLotNr, tournamentId, roundNr, boardNr],
    )
  }

  unpairRound(tournamentId: number, roundNr: number): void {
    this.db.run('DELETE FROM tournamentgames WHERE tournament = ? AND round = ?', [
      tournamentId,
      roundNr,
    ])
  }

  /**
   * Build a SQL expression that resolves the effective player rating based on
   * the tournament's ratingChoice setting.  Uses placeholder prefix "P." which
   * callers replace with the actual table alias (e.g. "wp." or "bp.").
   */
  private ratingExpression(tournamentId: number): string {
    const rc = this.db.exec('SELECT ratingchoice FROM tournaments WHERE "index" = ?', [
      tournamentId,
    ])
    const ratingChoice = rc.length > 0 ? (rc[0].values[0][0] as string) : 'ELO'

    switch (ratingChoice) {
      case 'ELO':
        return 'P.ratingi'
      case 'QUICK':
        return 'P.ratingq'
      case 'BLITZ':
        return 'P.ratingb'
      case 'QUICK_THEN_ELO':
        return 'CASE WHEN P.ratingq > 0 THEN P.ratingq ELSE P.ratingi END'
      case 'BLITZ_THEN_ELO':
        return 'CASE WHEN P.ratingb > 0 THEN P.ratingb ELSE P.ratingi END'
      default:
        return 'P.ratingn'
    }
  }
}
