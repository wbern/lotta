import type { ResultType } from '../types/api.ts'
import { getActualScores, isPlayed, isToBePlayed } from './scoring.ts'

export interface TiebreakContext {
  pointsPerGame: number
  chess4: boolean
  compensateWeakPlayerPP: boolean
  getPlayerGames: (playerId: number) => TiebreakGameInfo[]
}

export interface TiebreakGameInfo {
  roundNr: number
  side: 'white' | 'black'
  resultType: ResultType
  whiteScore: number // pairing score
  blackScore: number // pairing score
  opponentId: number | null
  opponentRating: number
  isBye: boolean
}

function gamesUpToRound(games: TiebreakGameInfo[], roundNr: number): TiebreakGameInfo[] {
  return games.filter((g) => g.roundNr <= roundNr)
}

function getPlayerActualScore(game: TiebreakGameInfo): number {
  const actual = getActualScores(game.resultType, game.whiteScore, game.blackScore, {
    hasWhitePlayer: true,
    hasBlackPlayer: !game.isBye,
  })
  return game.side === 'white' ? actual.whiteScore : actual.blackScore
}

export function tiebreakWins(games: TiebreakGameInfo[], roundNr: number): number {
  let wins = 0
  for (const game of gamesUpToRound(games, roundNr)) {
    if (game.isBye) continue
    if (
      (game.side === 'white' &&
        (game.resultType === 'WHITE_WIN' || game.resultType === 'WHITE_WIN_WO')) ||
      (game.side === 'black' &&
        (game.resultType === 'BLACK_WIN' || game.resultType === 'BLACK_WIN_WO'))
    ) {
      wins++
    }
  }
  return wins
}

export function tiebreakBlacks(games: TiebreakGameInfo[], roundNr: number): number {
  let count = 0
  for (const game of gamesUpToRound(games, roundNr)) {
    if (game.isBye) continue
    if (game.side === 'black') count++
  }
  return count
}

export function tiebreakManual(manualValue: number): number {
  return manualValue
}

export function tiebreakProgressive(games: TiebreakGameInfo[], roundNr: number): number {
  let tiebreak = 0
  for (const game of gamesUpToRound(games, roundNr)) {
    const multiplier = roundNr - game.roundNr + 1
    tiebreak += multiplier * getPlayerActualScore(game)
  }
  return tiebreak
}

/**
 * Buchholz opponent tiebreak score: uses pairing scores, but treats
 * byes/WOs/unplayed games as half points.
 */
function opponentTiebreakScore(
  opponentGames: TiebreakGameInfo[],
  roundNr: number,
  pointsPerGame: number,
): number {
  let score = 0
  for (const game of gamesUpToRound(opponentGames, roundNr)) {
    if (game.isBye || wonOnWO(game) || isToBePlayed(game.resultType)) {
      score += pointsPerGame / 2
    } else {
      score += game.side === 'white' ? game.whiteScore : game.blackScore
    }
  }
  return score
}

function wonOnWO(game: TiebreakGameInfo): boolean {
  return (
    (game.side === 'white' && game.resultType === 'WHITE_WIN_WO') ||
    (game.side === 'black' && game.resultType === 'BLACK_WIN_WO')
  )
}

export function tiebreakBuchholz(
  games: TiebreakGameInfo[],
  roundNr: number,
  ctx: TiebreakContext,
): number {
  let tiebreak = 0
  for (const game of gamesUpToRound(games, roundNr)) {
    if (game.isBye) {
      tiebreak += (ctx.pointsPerGame / 2) * roundNr
    } else if (game.opponentId != null) {
      const opponentGames = ctx.getPlayerGames(game.opponentId)
      tiebreak += opponentTiebreakScore(opponentGames, roundNr, ctx.pointsPerGame)
    }
  }
  return tiebreak
}

export function tiebreakMedianBuchholz(
  games: TiebreakGameInfo[],
  roundNr: number,
  ctx: TiebreakContext,
): number {
  const scores: number[] = []
  for (const game of gamesUpToRound(games, roundNr)) {
    if (game.isBye) {
      scores.push(ctx.pointsPerGame * roundNr)
    } else if (game.opponentId != null) {
      const opponentGames = ctx.getPlayerGames(game.opponentId)
      scores.push(opponentTiebreakScore(opponentGames, roundNr, ctx.pointsPerGame))
    }
  }

  const total = scores.reduce((sum, s) => sum + s, 0)
  if (roundNr > 2 && scores.length > 2) {
    const min = Math.min(...scores)
    const max = Math.max(...scores)
    return total - min - max
  }
  return total
}

/**
 * SSF Buchholz opponent score: like regular Buchholz but byes count as
 * win points (not half), and the lowest opponent score is removed.
 */
function opponentSSFTiebreakScore(
  opponentGames: TiebreakGameInfo[],
  roundNr: number,
  pointsPerGame: number,
  chess4: boolean,
): number {
  const maxPointsForWin = chess4 ? pointsPerGame - 1 : pointsPerGame
  let score = 0
  for (const game of gamesUpToRound(opponentGames, roundNr)) {
    if (game.isBye) {
      score += maxPointsForWin
    } else if (isToBePlayed(game.resultType)) {
      score += pointsPerGame / 2
    } else {
      score += game.side === 'white' ? game.whiteScore : game.blackScore
    }
  }
  return score
}

export function tiebreakSSFBuchholz(
  games: TiebreakGameInfo[],
  roundNr: number,
  ctx: TiebreakContext,
): number {
  const scores: number[] = []
  for (const game of gamesUpToRound(games, roundNr)) {
    if (game.isBye) {
      scores.push(0)
    } else if (game.opponentId != null) {
      const opponentGames = ctx.getPlayerGames(game.opponentId)
      scores.push(opponentSSFTiebreakScore(opponentGames, roundNr, ctx.pointsPerGame, ctx.chess4))
    }
  }

  const total = scores.reduce((sum, s) => sum + s, 0)
  if (roundNr > 1 && scores.length > 1) {
    const min = Math.min(...scores)
    return Math.max(total - min, 0)
  }
  return total
}

function getPlayerPairingScore(game: TiebreakGameInfo): number {
  return game.side === 'white' ? game.whiteScore : game.blackScore
}

function getOpponentPairingScoreTotal(opponentGames: TiebreakGameInfo[], roundNr: number): number {
  let score = 0
  for (const game of gamesUpToRound(opponentGames, roundNr)) {
    score += getPlayerPairingScore(game)
  }
  return score
}

export function tiebreakBerger(
  games: TiebreakGameInfo[],
  roundNr: number,
  ctx: TiebreakContext,
): number {
  let tiebreak = 0
  for (const game of gamesUpToRound(games, roundNr)) {
    if (game.isBye || !isPlayed(game.resultType)) continue
    if (game.opponentId == null) continue

    const opponentGames = ctx.getPlayerGames(game.opponentId)
    const opponentScore = getOpponentPairingScoreTotal(opponentGames, roundNr)
    const myScore = getPlayerPairingScore(game)
    tiebreak += opponentScore * myScore
  }
  return tiebreak
}

// LASK performance rating lookup table
const LASK_TABLE: [number, number][] = [
  [0.99, 800],
  [0.98, 677],
  [0.97, 589],
  [0.96, 538],
  [0.95, 501],
  [0.94, 470],
  [0.93, 444],
  [0.92, 422],
  [0.91, 401],
  [0.9, 383],
  [0.89, 366],
  [0.88, 351],
  [0.87, 336],
  [0.86, 322],
  [0.85, 309],
  [0.84, 296],
  [0.83, 284],
  [0.82, 273],
  [0.81, 262],
  [0.8, 251],
  [0.79, 240],
  [0.78, 230],
  [0.77, 220],
  [0.76, 211],
  [0.75, 202],
  [0.74, 193],
  [0.73, 184],
  [0.72, 175],
  [0.71, 166],
  [0.7, 158],
  [0.69, 149],
  [0.68, 141],
  [0.67, 133],
  [0.66, 125],
  [0.65, 117],
  [0.64, 110],
  [0.63, 102],
  [0.62, 95],
  [0.61, 87],
  [0.6, 80],
  [0.59, 72],
  [0.58, 65],
  [0.57, 57],
  [0.56, 50],
  [0.55, 43],
  [0.54, 36],
  [0.53, 29],
  [0.52, 21],
  [0.51, 14],
  [0.5, 7],
]

export function tiebreakRatingPerformance(
  games: TiebreakGameInfo[],
  roundNr: number,
  playerScore: number,
): number {
  const relevantGames = gamesUpToRound(games, roundNr)
  if (relevantGames.length === 0) return 0

  let opponentRatingSum = 0
  for (const game of relevantGames) {
    opponentRatingSum += game.opponentRating
  }
  const average = Math.floor(opponentRatingSum / relevantGames.length)

  let fracScore = playerScore / roundNr
  let minusFrac = false
  if (fracScore < 0.5) {
    minusFrac = true
    fracScore = 1 - fracScore
  }
  fracScore = Math.abs(fracScore)

  let addon = 0
  for (const [threshold, value] of LASK_TABLE) {
    if (fracScore > threshold) {
      addon = value
      break
    }
  }

  if (minusFrac) addon = -addon
  return average + addon
}

export function tiebreakInternalMeeting(
  playerId: number,
  games: TiebreakGameInfo[],
  roundNr: number,
  playerScores: Record<number, number>,
  previousTiebreaks: Record<number, number[]>,
): number {
  const myScore = playerScores[playerId] ?? 0
  const myPreviousTb = previousTiebreaks[playerId] ?? []

  // Find players with the same score and same previous tiebreaks
  const tiedPlayerIds = new Set<number>()
  for (const [idStr, score] of Object.entries(playerScores)) {
    const id = Number(idStr)
    if (id === playerId) continue
    if (score !== myScore) continue
    const otherTb = previousTiebreaks[id] ?? []
    if (myPreviousTb.length !== otherTb.length) continue
    if (myPreviousTb.every((v, i) => v === otherTb[i])) {
      tiedPlayerIds.add(id)
    }
  }

  // Sum actual scores against tied players
  let tiebreak = 0
  for (const game of gamesUpToRound(games, roundNr)) {
    if (game.isBye || game.opponentId == null) continue
    if (!tiedPlayerIds.has(game.opponentId)) continue
    tiebreak += getPlayerActualScore(game)
  }
  return tiebreak
}
