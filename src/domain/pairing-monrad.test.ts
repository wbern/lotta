import { describe, expect, it } from 'vitest'
import type { MonradGameHistory, MonradPlayerInfo } from './pairing-monrad.ts'
import { pairMonrad } from './pairing-monrad.ts'

function makePlayers(...ids: number[]): MonradPlayerInfo[] {
  return ids.map((id, i) => ({
    id,
    lotNr: i + 1,
    clubId: 0,
  }))
}

describe('pairMonrad', () => {
  it('pairs 4 players in round 1 (no history)', () => {
    const players = makePlayers(1, 2, 3, 4)
    const history: MonradGameHistory = { meetings: new Set(), whiteCounts: new Map() }

    const games = pairMonrad(players, history, false)
    expect(games).not.toBeNull()
    expect(games!).toHaveLength(2)
    // P1 vs P2, P3 vs P4 (sequential by lotNr)
    const pairings = games!.map((g) => [g.whitePlayerId, g.blackPlayerId].sort().join('-'))
    expect(pairings).toContain('1-2')
    expect(pairings).toContain('3-4')
  })

  it('avoids re-pairing players who already met', () => {
    const players = makePlayers(1, 2, 3, 4)
    const history: MonradGameHistory = {
      meetings: new Set(['1-2', '3-4']), // Round 1: P1 met P2, P3 met P4
      whiteCounts: new Map(),
    }

    const games = pairMonrad(players, history, false)
    expect(games).not.toBeNull()
    expect(games!).toHaveLength(2)
    // Must pair differently: P1 vs P3 and P2 vs P4, or P1 vs P4 and P2 vs P3
    const pairings = games!.map((g) => [g.whitePlayerId, g.blackPlayerId].sort().join('-'))
    expect(pairings).not.toContain('1-2')
    expect(pairings).not.toContain('3-4')
  })

  it('uses backtracking when initial pairing fails', () => {
    // 4 players: P1 has met P2 and P3 (can only meet P4)
    // But P2 has met P4 (can only meet P3)
    // So valid pairing: P1-P4, P2-P3
    const players = makePlayers(1, 2, 3, 4)
    const history: MonradGameHistory = {
      meetings: new Set(['1-2', '1-3', '2-4']),
      whiteCounts: new Map(),
    }

    const games = pairMonrad(players, history, false)
    expect(games).not.toBeNull()
    expect(games!).toHaveLength(2)
    const pairings = new Set(games!.map((g) => [g.whitePlayerId, g.blackPlayerId].sort().join('-')))
    expect(pairings.has('1-4')).toBe(true)
    expect(pairings.has('2-3')).toBe(true)
  })

  it('returns null when no valid pairing exists', () => {
    // 4 players: everyone has met everyone except P1-P2 and P3-P4
    // But those are the ONLY valid options and they were already played
    const players = makePlayers(1, 2, 3, 4)
    const history: MonradGameHistory = {
      meetings: new Set(['1-2', '1-3', '1-4', '2-3', '2-4', '3-4']),
      whiteCounts: new Map(),
    }

    const games = pairMonrad(players, history, false)
    expect(games).toBeNull()
  })

  it('balances white/black colors', () => {
    const players = makePlayers(1, 2)
    const history: MonradGameHistory = {
      meetings: new Set(),
      whiteCounts: new Map([
        [1, 3],
        [2, 1],
      ]), // P1 has 3 whites, P2 has 1
    }

    const games = pairMonrad(players, history, false)
    expect(games).not.toBeNull()
    // P2 should get white (fewer white games)
    expect(games![0].whitePlayerId).toBe(2)
    expect(games![0].blackPlayerId).toBe(1)
  })

  it('respects barred pairing (same club cannot meet)', () => {
    const players: MonradPlayerInfo[] = [
      { id: 1, lotNr: 1, clubId: 100 },
      { id: 2, lotNr: 2, clubId: 100 }, // Same club as P1
      { id: 3, lotNr: 3, clubId: 200 },
      { id: 4, lotNr: 4, clubId: 200 }, // Same club as P3
    ]
    const history: MonradGameHistory = { meetings: new Set(), whiteCounts: new Map() }

    const games = pairMonrad(players, history, true)
    expect(games).not.toBeNull()
    // P1 cannot meet P2 (same club), P3 cannot meet P4 (same club)
    const pairings = games!.map((g) => [g.whitePlayerId, g.blackPlayerId].sort().join('-'))
    expect(pairings).not.toContain('1-2')
    expect(pairings).not.toContain('3-4')
  })

  it('returns null when barred and one club in majority', () => {
    const players: MonradPlayerInfo[] = [
      { id: 1, lotNr: 1, clubId: 100 },
      { id: 2, lotNr: 2, clubId: 100 },
      { id: 3, lotNr: 3, clubId: 100 }, // 3 out of 4 from same club
      { id: 4, lotNr: 4, clubId: 200 },
    ]
    const history: MonradGameHistory = { meetings: new Set(), whiteCounts: new Map() }

    const games = pairMonrad(players, history, true)
    expect(games).toBeNull() // 3 > 4/2 = 2, so one club in majority
  })
})
