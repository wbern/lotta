import { describe, expect, it } from 'vitest'
import type { PairingGame } from './pairing.ts'
import { pairBergerRound } from './pairing-berger.ts'

describe('pairBergerRound', () => {
  it('pairs 4 players for round 1 correctly', () => {
    const playerIds = [1, 2, 3, 4]
    const games = pairBergerRound(playerIds, 1)

    // Upper=[P1, P3], Lower=[P4, P2]. No rotations for round 1.
    // Round 1 (odd): i=0 upper white, i=1 lower white
    expect(games).toEqual([
      { whitePlayerId: 1, blackPlayerId: 4 },
      { whitePlayerId: 2, blackPlayerId: 3 },
    ])
  })

  it('pairs 4 players for round 2 with rotation', () => {
    const playerIds = [1, 2, 3, 4]
    const games = pairBergerRound(playerIds, 2)

    // Start: Upper=[P1, P3], Lower=[P4, P2]
    // Rotate 1 time:
    //   Move P1 from upper[0] → lower[1]: Lower=[P4, P1, P2]
    //   Move P2 from lower[last] → upper[end]: Upper=[P3, P2]
    // After rotation: Upper=[P3, P2], Lower=[P4, P1]
    // Round 2 (even): i=0 → lower white (i<2): P4 vs P3, i=1 → lower white: P1 vs P2
    expect(games).toEqual([
      { whitePlayerId: 4, blackPlayerId: 3 },
      { whitePlayerId: 1, blackPlayerId: 2 },
    ])
  })

  it('pairs 4 players for round 3 with two rotations', () => {
    const playerIds = [1, 2, 3, 4]
    const games = pairBergerRound(playerIds, 3)

    // Start: Upper=[P1, P3], Lower=[P4, P2]
    // Rotate 1: Upper=[P3, P2], Lower=[P4, P1]
    // Rotate 2:
    //   Move P3 from upper[0] → lower[1]: Lower=[P4, P3, P1]
    //   Move P1 from lower[last] → upper[end]: Upper=[P2, P1]
    // After: Upper=[P2, P1], Lower=[P4, P3]
    // Round 3 (odd): i=0 upper white: P2 vs P4, i=1 lower white: P3 vs P1
    expect(games).toEqual([
      { whitePlayerId: 2, blackPlayerId: 4 },
      { whitePlayerId: 3, blackPlayerId: 1 },
    ])
  })

  it('handles odd number of players with bye (null)', () => {
    // 3 players + null bye = 4 entries
    const playerIds: (number | null)[] = [1, 2, 3, null]
    const games = pairBergerRound(playerIds, 1)

    // Upper/lower construction for 4:
    //   i=0: pos=0 → upper[0]=P1, lower[0]=null(bye)
    //   i=1: pos=2 → upper[1]=P3, lower[1]=P2
    // Round 1 (odd): i=0 upper white: P1 vs null, i=1 lower white: P2 vs P3
    expect(games).toEqual([
      { whitePlayerId: 1, blackPlayerId: null },
      { whitePlayerId: 2, blackPlayerId: 3 },
    ])
  })

  it('generates all rounds for a 4-player round-robin', () => {
    const playerIds = [1, 2, 3, 4]

    // 4 players need 3 rounds
    const allGames: PairingGame[][] = []
    for (let r = 1; r <= 3; r++) {
      allGames.push(pairBergerRound(playerIds, r))
    }

    // Every pair of players should meet exactly once
    const meetings = new Set<string>()
    for (const round of allGames) {
      for (const game of round) {
        if (game.whitePlayerId != null && game.blackPlayerId != null) {
          const key = [game.whitePlayerId, game.blackPlayerId].sort().join('-')
          expect(meetings.has(key)).toBe(false)
          meetings.add(key)
        }
      }
    }
    // C(4,2) = 6 unique meetings
    expect(meetings.size).toBe(6)
  })

  it('generates all rounds for a 6-player round-robin', () => {
    const playerIds = [1, 2, 3, 4, 5, 6]

    // 6 players need 5 rounds
    const allGames: PairingGame[][] = []
    for (let r = 1; r <= 5; r++) {
      allGames.push(pairBergerRound(playerIds, r))
    }

    // Every pair should meet exactly once: C(6,2) = 15
    const meetings = new Set<string>()
    for (const round of allGames) {
      for (const game of round) {
        if (game.whitePlayerId != null && game.blackPlayerId != null) {
          const key = [game.whitePlayerId, game.blackPlayerId].sort().join('-')
          expect(meetings.has(key)).toBe(false)
          meetings.add(key)
        }
      }
    }
    expect(meetings.size).toBe(15)
  })
})
