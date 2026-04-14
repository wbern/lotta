import type { PairingGame } from './pairing.ts'

export interface MonradPlayerInfo {
  id: number
  lotNr: number
  clubId: number
}

export interface MonradGameHistory {
  /** Set of "min-max" player ID pairs that have already met */
  meetings: Set<string>
  /** Map of playerId → number of times played as white */
  whiteCounts: Map<number, number>
}

function meetingKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`
}

function hasMet(a: number, b: number, history: MonradGameHistory): boolean {
  return history.meetings.has(meetingKey(a, b))
}

function getWhiteCount(playerId: number, history: MonradGameHistory): number {
  return history.whiteCounts.get(playerId) ?? 0
}

function isBarred(a: MonradPlayerInfo, b: MonradPlayerInfo, barredPairing: boolean): boolean {
  if (!barredPairing) return false
  return a.clubId > 0 && b.clubId > 0 && a.clubId === b.clubId
}

/**
 * Monrad (Swiss) pairing algorithm.
 * Recursive backtracking: pairs top player with next available opponent,
 * then recursively pairs remaining players.
 *
 * @returns Array of game pairings, or null if no valid pairing exists
 */
export function pairMonrad(
  players: MonradPlayerInfo[],
  history: MonradGameHistory,
  barredPairing: boolean,
): PairingGame[] | null {
  if (players.length === 0) return []
  if (players.length === 1) return null // Can't pair odd player without bye

  // Check barred pairing feasibility
  if (barredPairing && isOneClubInMajority(players)) {
    return null
  }

  return pairRecursive(players, history, barredPairing, new Set<string>())
}

function isOneClubInMajority(players: MonradPlayerInfo[]): boolean {
  const counts = new Map<number, number>()
  for (const p of players) {
    if (p.clubId > 0) {
      counts.set(p.clubId, (counts.get(p.clubId) ?? 0) + 1)
    }
  }
  let max = 0
  for (const count of counts.values()) {
    if (count > max) max = count
  }
  return max > Math.floor(players.length / 2)
}

function pairRecursive(
  players: MonradPlayerInfo[],
  history: MonradGameHistory,
  barredPairing: boolean,
  forbidden: Set<string>,
): PairingGame[] | null {
  if (players.length === 0) return []

  const games: PairingGame[] = []

  for (let i = 0; i < players.length; i++) {
    const a = players[i]
    let canMeetSomeone = false

    for (let j = i + 1; j < players.length; j++) {
      const b = players[j]

      if (hasMet(a.id, b.id, history) || isBarred(a, b, barredPairing)) {
        continue
      }

      const key = meetingKey(a.id, b.id)
      if (forbidden.has(key)) {
        continue
      }

      canMeetSomeone = true

      // Determine colors: player with fewer whites gets white
      let whiteId: number
      let blackId: number
      if (getWhiteCount(b.id, history) > getWhiteCount(a.id, history)) {
        whiteId = a.id
        blackId = b.id
      } else {
        whiteId = b.id
        blackId = a.id
      }

      // Remove a and b, recursively pair rest.
      // Pass a COPY of forbidden so that entries added by nested backtracking
      // don't leak back and incorrectly block pairings when this level retries.
      const remaining = players.filter((p) => p.id !== a.id && p.id !== b.id)
      const rest = pairRecursive(remaining, history, barredPairing, new Set(forbidden))

      if (rest === null && players.length > 2) {
        // Backtrack: add this pairing to forbidden and retry from the higher player
        forbidden.add(key)
        // Restart from the higher-ranked player (lower lotNr)
        const higherId = a.lotNr < b.lotNr ? a.id : b.id
        const higherIdx = players.findIndex((p) => p.id === higherId)
        i = higherIdx - 1 // Will be incremented by for loop
        break
      } else {
        games.push({ whitePlayerId: whiteId, blackPlayerId: blackId })
        if (rest) {
          games.push(...rest)
        }
        return games
      }
    }

    if (!canMeetSomeone) {
      return null
    }
  }

  if (games.length === 0) {
    return null
  }
  return games
}
