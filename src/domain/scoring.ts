import type { ResultType } from '../types/api.ts'

interface ScoringConfig {
  pointsPerGame: number
  /** Winner's points. If omitted, derived from chess4 (legacy/backwards-compat). */
  maxPointsForWin?: number
  /** Legacy Schackfyran scoring flag; only used to derive maxPointsForWin when absent. */
  chess4?: boolean
}

interface Scores {
  whiteScore: number
  blackScore: number
}

interface GamePlayers {
  hasWhitePlayer: boolean
  hasBlackPlayer: boolean
}

/**
 * The winner's points for a game. Prefers the explicit `maxPointsForWin`; falls
 * back to the legacy `chess4 ? pointsPerGame - 1 : pointsPerGame` so old data and
 * callers that still pass `chess4` keep their exact behaviour (ADR-0006).
 */
export function effectiveMaxPointsForWin(config: ScoringConfig): number {
  if (config.maxPointsForWin != null) return config.maxPointsForWin
  return config.chess4 ? config.pointsPerGame - 1 : config.pointsPerGame
}

export function calculateScores(resultType: ResultType, config: ScoringConfig): Scores {
  const { pointsPerGame } = config
  const maxPointsForWin = effectiveMaxPointsForWin(config)

  switch (resultType) {
    case 'WHITE_WIN':
      return { whiteScore: maxPointsForWin, blackScore: pointsPerGame - maxPointsForWin }
    case 'WHITE_WIN_WO':
      return { whiteScore: maxPointsForWin, blackScore: 0 }
    case 'DRAW':
      return { whiteScore: pointsPerGame / 2, blackScore: pointsPerGame / 2 }
    case 'BLACK_WIN':
      return { whiteScore: pointsPerGame - maxPointsForWin, blackScore: maxPointsForWin }
    case 'BLACK_WIN_WO':
      return { whiteScore: 0, blackScore: maxPointsForWin }
    case 'POSTPONED':
      return { whiteScore: maxPointsForWin, blackScore: maxPointsForWin }
    case 'DOUBLE_WO':
    case 'NO_RESULT':
    case 'CANCELLED':
      return { whiteScore: 0, blackScore: 0 }
  }
}

interface PairingScoreContext {
  resultType: ResultType
  whitePairingScore: number
  blackPairingScore: number
  whiteRating: number
  blackRating: number
  hasWhitePlayer: boolean
  hasBlackPlayer: boolean
  compensateWeakPlayerPP: boolean
  pointsPerGame: number
  maxPointsForWin?: number
  chess4?: boolean
}

/**
 * Returns pairing score for a specific player in a game.
 * Implements compensateWeakPlayerPP: if the opponent's rating is 200+ higher
 * and the game is POSTPONED, the weaker player gets draw score instead.
 */
export function getPairingScore(side: 'white' | 'black', ctx: PairingScoreContext): number {
  const compensate = ctx.compensateWeakPlayerPP && ctx.resultType === 'POSTPONED'

  if (side === 'white') {
    if (compensate && ctx.hasBlackPlayer && ctx.blackRating - ctx.whiteRating > 200) {
      const drawScores = calculateScores('DRAW', {
        pointsPerGame: ctx.pointsPerGame,
        maxPointsForWin: ctx.maxPointsForWin,
        chess4: ctx.chess4,
      })
      return drawScores.whiteScore
    }
    return ctx.whitePairingScore
  } else {
    if (compensate && ctx.hasWhitePlayer && ctx.whiteRating - ctx.blackRating > 200) {
      const drawScores = calculateScores('DRAW', {
        pointsPerGame: ctx.pointsPerGame,
        maxPointsForWin: ctx.maxPointsForWin,
        chess4: ctx.chess4,
      })
      return drawScores.blackScore
    }
    return ctx.blackPairingScore
  }
}

/**
 * Returns actual tournament scores (for standings).
 * Unlike pairing scores, POSTPONED games return 0 for both players
 * when both players exist (the postponed points are only for pairing).
 */
export function getActualScores(
  resultType: ResultType,
  whitePairingScore: number,
  blackPairingScore: number,
  players: GamePlayers,
): Scores {
  if (resultType === 'POSTPONED' && players.hasWhitePlayer && players.hasBlackPlayer) {
    return { whiteScore: 0, blackScore: 0 }
  }
  return { whiteScore: whitePairingScore, blackScore: blackPairingScore }
}

export function isPlayed(resultType: ResultType): boolean {
  return resultType === 'WHITE_WIN' || resultType === 'BLACK_WIN' || resultType === 'DRAW'
}

export function isToBePlayed(resultType: ResultType): boolean {
  return resultType === 'NO_RESULT' || resultType === 'POSTPONED'
}

/**
 * Format a result type as a display label, adjusting for the tournament's
 * scoring config. Mirrors what the referee pairings buttons show:
 * standard 1-0/½-½/0-1, chess4 3-1/2-2/1-3, Skollags-DM 2-0/1-1/0-2.
 * Walkover types get a ' WO' suffix. Non-played statuses return Swedish
 * abbreviations so this can be used in undo history and conflict messages.
 */
export function formatResultLabel(
  resultType: ResultType,
  config?: { chess4?: boolean; pointsPerGame?: number; maxPointsForWin?: number },
): string {
  if (resultType === 'POSTPONED') return 'uppskj'
  if (resultType === 'CANCELLED') return 'inställd'
  if (resultType === 'NO_RESULT') return ''

  const scoringConfig = {
    chess4: config?.chess4 ?? false,
    pointsPerGame: config?.pointsPerGame ?? 1,
    maxPointsForWin: config?.maxPointsForWin,
  }
  const s = calculateScores(resultType, scoringConfig)
  const base = `${formatScore(s.whiteScore)}-${formatScore(s.blackScore)}`
  const isWalkover =
    resultType === 'WHITE_WIN_WO' || resultType === 'BLACK_WIN_WO' || resultType === 'DOUBLE_WO'
  return isWalkover ? `${base} WO` : base
}

export function formatScore(score: number): string {
  const intPart = Math.floor(score)
  const hasHalf = score % 1 === 0.5
  if (score === 0.5) return '½'
  let result = intPart.toString()
  if (hasHalf) result += '½'
  return result
}

export type KeybindSlot = 'whiteWin' | 'draw' | 'blackWin' | 'noResult'

export interface ResultKeybinds {
  whiteWin: string[]
  draw: string[]
  blackWin: string[]
  noResult: string[]
}

/**
 * Returns the keyboard shortcuts that produce each result, derived from the
 * tournament's scoring config. Used both by the keyboard handler and the
 * context menu hints so the displayed shortcut always matches what the key
 * actually does.
 *
 * Numeric keys map to the white player's score in the winning/drawing result,
 * so they line up with the visible button labels (Schackfyran `3` → 3-1,
 * Skollags-DM `2` → 2-0, etc.). Semantic keys (V/R/F) always work.
 */
export function getResultKeybinds(config: ScoringConfig): ResultKeybinds {
  const keys: ResultKeybinds = {
    whiteWin: ['V'],
    draw: ['R', 'Ö'],
    blackWin: ['F'],
    noResult: ['Space'],
  }

  // Numeric keys map to each side's points in the decisive/drawn result, derived
  // generically from the scoring config (winner = maxPointsForWin, loser =
  // pointsPerGame - maxPointsForWin, draw = pointsPerGame / 2).
  const win = calculateScores('WHITE_WIN', config)
  const winnerPoints = win.whiteScore
  const loserPoints = win.blackScore
  const drawScore = config.pointsPerGame / 2

  keys.whiteWin.push(String(winnerPoints))
  keys.blackWin.push(String(loserPoints))
  if (Number.isInteger(drawScore)) keys.draw.push(String(drawScore))
  // When the loser still scores (e.g. 3-2-1), '0' is free to mean "not played".
  if (loserPoints !== 0) keys.noResult.push('0')

  return keys
}
