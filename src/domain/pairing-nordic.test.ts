import { describe, expect, it } from 'vitest'
import type { MonradGameHistory } from './pairing-monrad.ts'
import type { NordicPlayerInfo } from './pairing-nordic.ts'
import { pairNordic } from './pairing-nordic.ts'

function makePlayers(...entries: [number, number][]): NordicPlayerInfo[] {
  return entries.map(([id, score], i) => ({
    id,
    lotNr: i + 1,
    clubId: 0,
    score,
  }))
}

describe('pairNordic', () => {
  it('pairs 4 players in one score group (round 1)', () => {
    const players = makePlayers([1, 0], [2, 0], [3, 0], [4, 0])
    const history: MonradGameHistory = { meetings: new Set(), whiteCounts: new Map() }

    const games = pairNordic(players, history, false, 0)
    expect(games).not.toBeNull()
    expect(games!).toHaveLength(2)
    // Upper [P1, P2] vs Lower [P3, P4]: P1 vs P3, P2 vs P4
    const pairings = games!.map((g) => [g.whitePlayerId, g.blackPlayerId].sort().join('-'))
    expect(pairings).toContain('1-3')
    expect(pairings).toContain('2-4')
  })

  it('pairs players from different score groups', () => {
    // After round 1: P1=2pts, P2=2pts, P3=0pts, P4=0pts
    const players = makePlayers([1, 2], [2, 2], [3, 0], [4, 0])
    const history: MonradGameHistory = {
      meetings: new Set(['1-3', '2-4']), // R1: P1 beat P3, P2 beat P4
      whiteCounts: new Map(),
    }

    const games = pairNordic(players, history, false, 1)
    expect(games).not.toBeNull()
    expect(games!).toHaveLength(2)
    // Group 1: [P1, P2] (score=2), Group 2: [P3, P4] (score=0)
    // P1 vs P2 (within group), P3 vs P4 (within group)
    const pairings = games!.map((g) => [g.whitePlayerId, g.blackPlayerId].sort().join('-'))
    expect(pairings).toContain('1-2')
    expect(pairings).toContain('3-4')
  })

  it('handles odd score group by moving player from lower group', () => {
    // 3 players with score 2, 1 with score 0
    const players = makePlayers([1, 2], [2, 2], [3, 2], [4, 0])
    const history: MonradGameHistory = { meetings: new Set(), whiteCounts: new Map() }

    const games = pairNordic(players, history, false, 1)
    expect(games).not.toBeNull()
    expect(games!).toHaveLength(2)
  })

  it('handles §14B:3d — single player in top group pairs with lower group', () => {
    // 1 player with score 2, 3 with score 0
    const players = makePlayers([1, 2], [2, 0], [3, 0], [4, 0])
    const history: MonradGameHistory = { meetings: new Set(), whiteCounts: new Map() }

    const games = pairNordic(players, history, false, 1)
    expect(games).not.toBeNull()
    expect(games!).toHaveLength(2)
    // P1 must pair with someone from the lower group
    const p1Game = games!.find((g) => g.whitePlayerId === 1 || g.blackPlayerId === 1)
    expect(p1Game).toBeDefined()
  })
})
