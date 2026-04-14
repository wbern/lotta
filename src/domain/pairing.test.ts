import { describe, expect, it } from 'vitest'
import type { PairingInput } from './pairing.ts'
import { pairSequential, preparePairing } from './pairing.ts'

describe('preparePairing', () => {
  it('throws if fewer than 2 active players', () => {
    const input: PairingInput = {
      nrOfRounds: 7,
      roundsPlayed: 0,
      nextRoundNr: 1,
      initialPairing: 'Slumpad',
      allResultsEntered: true,
      players: [{ id: 1, rating: 1500, withdrawnFromRound: -1, lotNr: 0 }],
    }
    expect(() => preparePairing(input)).toThrow('Lägg till några spelare först!')
  })

  it('throws if not all results are entered for previous round', () => {
    const input: PairingInput = {
      nrOfRounds: 7,
      roundsPlayed: 1,
      nextRoundNr: 2,
      initialPairing: 'Slumpad',
      allResultsEntered: false,
      players: [
        { id: 1, rating: 1500, withdrawnFromRound: -1, lotNr: 0 },
        { id: 2, rating: 1400, withdrawnFromRound: -1, lotNr: 0 },
      ],
    }
    expect(() => preparePairing(input)).toThrow('resultat')
  })

  it('excludes withdrawn players from active list', () => {
    const input: PairingInput = {
      nrOfRounds: 7,
      roundsPlayed: 2,
      nextRoundNr: 3,
      initialPairing: 'Slumpad',
      allResultsEntered: true,
      players: [
        { id: 1, rating: 1500, withdrawnFromRound: -1, lotNr: 1 },
        { id: 2, rating: 1400, withdrawnFromRound: 3, lotNr: 2 }, // withdrawn at round 3
        { id: 3, rating: 1300, withdrawnFromRound: -1, lotNr: 3 },
        { id: 4, rating: 1200, withdrawnFromRound: 5, lotNr: 4 }, // withdrawn at round 5 (still active for round 3)
      ],
    }
    const activePlayers = preparePairing(input)
    const allIds = activePlayers.map((p) => p.id).sort((a, b) => a - b)
    expect(allIds).toEqual([1, 3, 4])
    // Player 2 is excluded (withdrawn at round 3)
  })

  it('returns all active players (bye selection is caller responsibility)', () => {
    const input: PairingInput = {
      nrOfRounds: 7,
      roundsPlayed: 0,
      nextRoundNr: 1,
      initialPairing: 'Rating',
      allResultsEntered: true,
      players: [
        { id: 1, rating: 1500, withdrawnFromRound: -1, lotNr: 1 },
        { id: 2, rating: 1400, withdrawnFromRound: -1, lotNr: 2 },
        { id: 3, rating: 1300, withdrawnFromRound: -1, lotNr: 3 },
      ],
    }
    const activePlayers = preparePairing(input)
    expect(activePlayers).toHaveLength(3)
  })

  it('returns all active players when even count', () => {
    const input: PairingInput = {
      nrOfRounds: 7,
      roundsPlayed: 0,
      nextRoundNr: 1,
      initialPairing: 'Rating',
      allResultsEntered: true,
      players: [
        { id: 1, rating: 1500, withdrawnFromRound: -1, lotNr: 1 },
        { id: 2, rating: 1400, withdrawnFromRound: -1, lotNr: 2 },
      ],
    }
    const activePlayers = preparePairing(input)
    expect(activePlayers).toHaveLength(2)
  })

  it('throws if all rounds are already played', () => {
    const input: PairingInput = {
      nrOfRounds: 3,
      roundsPlayed: 3,
      nextRoundNr: 4,
      initialPairing: 'Slumpad',
      allResultsEntered: true,
      players: [
        { id: 1, rating: 1500, withdrawnFromRound: -1, lotNr: 0 },
        { id: 2, rating: 1400, withdrawnFromRound: -1, lotNr: 0 },
      ],
    }
    expect(() => preparePairing(input)).toThrow('Alla ronder är spelade!')
  })
})

describe('pairSequential', () => {
  it('pairs players sequentially: 1v2, 3v4', () => {
    const players = [
      { id: 10, rating: 1500, withdrawnFromRound: -1, lotNr: 1 },
      { id: 20, rating: 1400, withdrawnFromRound: -1, lotNr: 2 },
      { id: 30, rating: 1300, withdrawnFromRound: -1, lotNr: 3 },
      { id: 40, rating: 1200, withdrawnFromRound: -1, lotNr: 4 },
    ]

    const games = pairSequential(players)
    expect(games).toEqual([
      { whitePlayerId: 10, blackPlayerId: 20 },
      { whitePlayerId: 30, blackPlayerId: 40 },
    ])
  })

  it('returns bye game when bye player provided', () => {
    const players = [
      { id: 10, rating: 1500, withdrawnFromRound: -1, lotNr: 1 },
      { id: 20, rating: 1400, withdrawnFromRound: -1, lotNr: 2 },
    ]
    const bye = { id: 30, rating: 1300, withdrawnFromRound: -1, lotNr: 3 }

    const games = pairSequential(players, bye)
    expect(games).toEqual([
      { whitePlayerId: 10, blackPlayerId: 20 },
      { whitePlayerId: 30, blackPlayerId: null },
    ])
  })
})
