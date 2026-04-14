import type { PairingGame } from './pairing.ts'
import type { MonradGameHistory } from './pairing-monrad.ts'

export interface NordicPlayerInfo {
  id: number
  lotNr: number
  clubId: number
  score: number
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

function isBarred(a: NordicPlayerInfo, b: NordicPlayerInfo, barredPairing: boolean): boolean {
  if (!barredPairing) return false
  return a.clubId > 0 && b.clubId > 0 && a.clubId === b.clubId
}

function hasMetAll(
  player: NordicPlayerInfo,
  group: NordicPlayerInfo[],
  history: MonradGameHistory,
): boolean {
  for (const opponent of group) {
    if (opponent.id === player.id) continue
    if (!hasMet(player.id, opponent.id, history)) return false
  }
  return true
}

function assignColor(
  a: NordicPlayerInfo,
  b: NordicPlayerInfo,
  history: MonradGameHistory,
  roundsPlayed: number,
): PairingGame {
  const aWhites = getWhiteCount(a.id, history)
  const bWhites = getWhiteCount(b.id, history)

  if (bWhites > aWhites) {
    return { whitePlayerId: a.id, blackPlayerId: b.id }
  } else if (bWhites < aWhites) {
    return { whitePlayerId: b.id, blackPlayerId: a.id }
  } else if (roundsPlayed % 2 === 1) {
    // Odd number of rounds played → next round is even → upper gets white
    return { whitePlayerId: a.id, blackPlayerId: b.id }
  } else {
    return { whitePlayerId: b.id, blackPlayerId: a.id }
  }
}

/**
 * Create score groups from players sorted by score (desc) then lotNr (asc).
 */
function createGroups(players: NordicPlayerInfo[]): NordicPlayerInfo[][] {
  const groups: NordicPlayerInfo[][] = []
  let currentGroup: NordicPlayerInfo[] = []
  let lastScore = NaN

  for (const p of players) {
    if (p.score !== lastScore) {
      if (currentGroup.length > 0) groups.push(currentGroup)
      currentGroup = [p]
      lastScore = p.score
    } else {
      currentGroup.push(p)
    }
  }
  if (currentGroup.length > 0) groups.push(currentGroup)
  return groups
}

/**
 * §14B:3f: Pair an even-sized group by splitting upper/lower halves.
 * Uses backtracking and swap mechanism.
 */
function pair3f(
  group: NordicPlayerInfo[],
  history: MonradGameHistory,
  barredPairing: boolean,
  roundsPlayed: number,
): PairingGame[] | null {
  const half = Math.floor(group.length / 2)
  let swapCount = 0

  while (swapCount < half) {
    const upper = group.slice(0, half)
    const lower = group.slice(half)

    // Apply swaps at the boundary
    for (let i = 0; i < swapCount; i++) {
      const uIdx = half - 1 - i
      const lIdx = i
      const temp = upper[uIdx]
      upper[uIdx] = lower[lIdx]
      lower[lIdx] = temp
    }

    const games = pair3fUpperLower(upper, lower, history, barredPairing, roundsPlayed)
    if (games !== null && games.length > 0) return games
    swapCount++
  }

  return null
}

/**
 * Recursive pairing of upper vs lower halves with backtracking.
 */
function pair3fUpperLower(
  upper: NordicPlayerInfo[],
  lower: NordicPlayerInfo[],
  history: MonradGameHistory,
  barredPairing: boolean,
  roundsPlayed: number,
): PairingGame[] | null {
  if (upper.length === 0 && lower.length === 0) return []

  const forbidden = new Set<string>()

  for (let i = 0; i < upper.length; i++) {
    const a = upper[i]

    for (let j = 0; j < lower.length; j++) {
      const b = lower[j]

      if (hasMet(a.id, b.id, history) || isBarred(a, b, barredPairing)) continue
      if (forbidden.has(meetingKey(a.id, b.id))) continue

      const game = assignColor(a, b, history, roundsPlayed)

      // Remove and recurse
      const restUpper = upper.filter((_, idx) => idx !== i)
      const restLower = lower.filter((_, idx) => idx !== j)
      const rest = pair3fUpperLower(restUpper, restLower, history, barredPairing, roundsPlayed)

      if (rest === null && upper.length > 1 && lower.length > 1) {
        forbidden.add(meetingKey(a.id, b.id))
        continue
      }

      return [game, ...(rest ?? [])]
    }
  }

  return null
}

/**
 * §14B:3d: Single player in top group pairs with someone from a lower group.
 */
function pair3d(
  player: NordicPlayerInfo,
  groups: NordicPlayerInfo[][],
  history: MonradGameHistory,
  barredPairing: boolean,
  roundsPlayed: number,
  alreadyPaired: Set<number>,
): PairingGame | null {
  for (const group of groups) {
    for (const b of group) {
      if (b.id === player.id) continue
      if (alreadyPaired.has(b.id)) continue
      if (hasMet(player.id, b.id, history)) continue
      if (isBarred(player, b, barredPairing)) continue

      return assignColor(player, b, history, roundsPlayed)
    }
  }
  return null
}

/**
 * Move a player from a lower group to the current group (§14B:3e).
 * Returns true if successful.
 */
function movePlayer(
  currentGroup: NordicPlayerInfo[],
  groups: NordicPlayerInfo[][],
  groupIndex: number,
  history: MonradGameHistory,
): boolean {
  if (groupIndex + 1 >= groups.length) {
    return concatenateLastTwo(groups)
  }

  for (let j = groupIndex + 1; j < groups.length; j++) {
    const nextGroup = groups[j]
    for (let k = 0; k < nextGroup.length; k++) {
      const player = nextGroup[k]
      if (!hasMetAll(player, currentGroup, history)) {
        currentGroup.push(player)
        nextGroup.splice(k, 1)
        if (nextGroup.length === 0) {
          groups.splice(j, 1)
        }
        return true
      }
    }
  }
  return false
}

function concatenateLastTwo(groups: NordicPlayerInfo[][]): boolean {
  if (groups.length < 2) return false
  const last = groups.pop()!
  groups[groups.length - 1].push(...last)
  return true
}

function removeFromGroups(player: NordicPlayerInfo, groups: NordicPlayerInfo[][]): void {
  for (let i = 0; i < groups.length; i++) {
    const idx = groups[i].findIndex((p) => p.id === player.id)
    if (idx !== -1) {
      groups[i].splice(idx, 1)
      if (groups[i].length === 0) {
        groups.splice(i, 1)
      }
      return
    }
  }
}

/**
 * Nordic Schweizer pairing algorithm.
 * Groups players by score and pairs within groups using upper/lower split.
 *
 * @param players Players sorted by score (desc) then lotNr (asc)
 * @param history Game history (meetings, white counts)
 * @param barredPairing Whether same-club pairing is barred
 * @param roundsPlayed Number of rounds already played
 * @returns Array of game pairings, or null if no valid pairing exists
 */
export function pairNordic(
  players: NordicPlayerInfo[],
  history: MonradGameHistory,
  barredPairing: boolean,
  roundsPlayed: number,
): PairingGame[] | null {
  const groups = createGroups(players)
  return pairGroups(groups, history, barredPairing, roundsPlayed, false)
}

function pairGroups(
  groups: NordicPlayerInfo[][],
  history: MonradGameHistory,
  barredPairing: boolean,
  roundsPlayed: number,
  firstGameRemoved: boolean,
): PairingGame[] | null {
  const allGames: PairingGame[] = []

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i]

    if (i === 0 && group.length === 1 && !firstGameRemoved) {
      // §14B:3d: Single player in top group
      const alreadyPaired = new Set<number>()
      const game = pair3d(group[0], groups, history, barredPairing, roundsPlayed, alreadyPaired)
      if (!game) return null

      const whitePlayer = players(groups, game.whitePlayerId!)
      const blackPlayer = players(groups, game.blackPlayerId!)
      if (!whitePlayer || !blackPlayer) return null

      removeFromGroups(whitePlayer, groups)
      removeFromGroups(blackPlayer, groups)

      const rest = pairGroups(groups, history, barredPairing, roundsPlayed, true)
      if (!rest) return null

      allGames.push(game)
      allGames.push(...rest)
      return allGames
    } else if (group.length % 2 === 1) {
      // §14B:3e: Odd group — move player from lower group
      if (!movePlayer(group, groups, i, history)) {
        if (!concatenateLastTwo(groups)) return null
      }
      return pairGroups(groups, history, barredPairing, roundsPlayed, firstGameRemoved)
    } else if (group.length % 2 === 0 && group.length > 0) {
      // §14B:3f: Even group — split and pair
      const games = pair3f(group, history, barredPairing, roundsPlayed)
      if (!games || games.length === 0) {
        // §14B:2i: Move player from lower group
        if (!movePlayer(group, groups, i, history)) {
          if (!concatenateLastTwo(groups)) return null
        }
        return pairGroups(groups, history, barredPairing, roundsPlayed, firstGameRemoved)
      }
      allGames.push(...games)
    }
  }

  return allGames
}

function players(groups: NordicPlayerInfo[][], playerId: number): NordicPlayerInfo | null {
  for (const group of groups) {
    for (const p of group) {
      if (p.id === playerId) return p
    }
  }
  return null
}
