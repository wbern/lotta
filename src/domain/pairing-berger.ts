import type { PairingGame } from './pairing.ts'

/**
 * Berger round-robin pairing algorithm.
 * Generates pairings for a single round of a round-robin tournament.
 *
 * @param playerIds Player IDs in seed order (sorted by score then lotNr)
 * @param roundNr The round number to generate (1-indexed)
 * @returns Array of game pairings with white/black player IDs
 */
export function pairBergerRound(playerIds: (number | null)[], roundNr: number): PairingGame[] {
  const gamesPerRound = Math.ceil(playerIds.length / 2)

  // Construct upper and lower rows
  const upper: (number | null)[] = []
  const lower: (number | null)[] = []

  for (let i = 0; i < gamesPerRound; i++) {
    let pos: number
    if (i % 2 === 0) {
      pos = Math.floor(i / 2)
    } else {
      pos = Math.floor(playerIds.length / 2) + Math.floor(i / 2)
    }
    upper.push(playerIds[pos])
    lower.push(playerIds[playerIds.length - 1 - pos])
  }

  // Rotate to the correct round
  for (let i = 1; i < roundNr; i++) {
    rotate(upper, lower)
  }

  // Create games with color assignment
  return createGames(upper, lower, roundNr)
}

function rotate(upper: (number | null)[], lower: (number | null)[]): void {
  // Move first element from upper to position 1 in lower
  const fromUpper = upper.shift()!
  lower.splice(1, 0, fromUpper)

  // Move last element from lower to end of upper
  const fromLower = lower.pop()!
  upper.push(fromLower)
}

function createGames(
  upper: (number | null)[],
  lower: (number | null)[],
  roundNr: number,
): PairingGame[] {
  const games: PairingGame[] = []

  for (let i = 0; i < upper.length; i++) {
    let whiteId: number | null
    let blackId: number | null

    if (roundNr % 2 === 1) {
      // Odd round: positions 0, 2, 4... → upper has white
      if (i % 2 === 0) {
        whiteId = upper[i]
        blackId = lower[i]
      } else {
        whiteId = lower[i]
        blackId = upper[i]
      }
    } else {
      // Even round: positions 2, 4, 6... → upper has white; 0, 1 → lower has white
      if (i % 2 === 0 && i >= 2) {
        whiteId = upper[i]
        blackId = lower[i]
      } else {
        whiteId = lower[i]
        blackId = upper[i]
      }
    }

    games.push({ whitePlayerId: whiteId, blackPlayerId: blackId })
  }

  return games
}
