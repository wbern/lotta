import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DataProvider } from './data-provider'
import { PROVIDERS } from './test-providers'

describe.each(PROVIDERS)('rounds API (%s)', (_name, factory) => {
  let provider: DataProvider
  let teardown: () => Promise<void>
  let tournamentId: number

  beforeEach(async () => {
    const setup = await factory()
    provider = setup.provider
    teardown = setup.teardown
    const t = await provider.tournaments.create({
      name: 'Test',
      group: 'A',
      pairingSystem: 'Monrad',
      initialPairing: 'Slumpad',
      nrOfRounds: 7,
      barredPairing: false,
      compensateWeakPlayerPP: false,
      pointsPerGame: 1,
      chess4: false,
      ratingChoice: 'ELO',
      showELO: true,
      showGroup: true,
    })
    tournamentId = t.id
  })

  afterEach(async () => {
    await teardown()
  })

  it('returns empty rounds when none exist', async () => {
    const rounds = await provider.rounds.list(tournamentId)
    expect(rounds).toEqual([])
  })

  it('pairNextRound creates games for first round', async () => {
    await provider.tournamentPlayers.add(tournamentId, {
      lastName: 'Andersson',
      firstName: 'Anna',
      ratingI: 1500,
    })
    await provider.tournamentPlayers.add(tournamentId, {
      lastName: 'Björk',
      firstName: 'Bo',
      ratingI: 1400,
    })
    await provider.tournamentPlayers.add(tournamentId, {
      lastName: 'Carlsson',
      firstName: 'Cilla',
      ratingI: 1300,
    })
    await provider.tournamentPlayers.add(tournamentId, {
      lastName: 'Dahl',
      firstName: 'Dan',
      ratingI: 1200,
    })

    const round = await provider.rounds.pairNext(tournamentId)
    expect(round.roundNr).toBe(1)
    expect(round.gameCount).toBe(2)
    expect(round.games).toHaveLength(2)
    // All games should have NO_RESULT initially
    for (const g of round.games) {
      expect(g.resultType).toBe('NO_RESULT')
    }
  })

  it('pairNextRound throws with fewer than 2 players', async () => {
    await provider.tournamentPlayers.add(tournamentId, {
      lastName: 'Solo',
      firstName: 'Player',
      ratingI: 1500,
    })
    await expect(provider.rounds.pairNext(tournamentId)).rejects.toThrow('spelare')
  })

  it('pairNextRound handles odd number of players with bye', async () => {
    await provider.tournamentPlayers.add(tournamentId, {
      lastName: 'A',
      firstName: 'A',
      ratingI: 1500,
    })
    await provider.tournamentPlayers.add(tournamentId, {
      lastName: 'B',
      firstName: 'B',
      ratingI: 1400,
    })
    await provider.tournamentPlayers.add(tournamentId, {
      lastName: 'C',
      firstName: 'C',
      ratingI: 1300,
    })

    const round = await provider.rounds.pairNext(tournamentId)
    expect(round.roundNr).toBe(1)
    expect(round.gameCount).toBe(2) // 1 regular game + 1 bye game
    // One game should have null blackPlayer (bye)
    const byeGame = round.games.find((g) => g.blackPlayer === null)
    expect(byeGame).toBeDefined()
  })

  it('pairNextRound refuses when previous round has no results', async () => {
    await provider.tournamentPlayers.add(tournamentId, {
      lastName: 'A',
      firstName: 'A',
      ratingI: 1500,
    })
    await provider.tournamentPlayers.add(tournamentId, {
      lastName: 'B',
      firstName: 'B',
      ratingI: 1400,
    })

    await provider.rounds.pairNext(tournamentId) // Round 1
    // Don't set any results
    await expect(provider.rounds.pairNext(tournamentId)).rejects.toThrow('resultat')
  })

  it('pairNextRound with Berger creates all rounds at once', async () => {
    // Create a Berger tournament with 4 players, 3 rounds
    const bergerT = await provider.tournaments.create({
      name: 'Berger',
      group: 'A',
      pairingSystem: 'Berger',
      initialPairing: 'Rating',
      nrOfRounds: 3,
      barredPairing: false,
      compensateWeakPlayerPP: false,
      pointsPerGame: 1,
      chess4: false,
      ratingChoice: 'ELO',
      showELO: true,
      showGroup: true,
    })
    await provider.tournamentPlayers.add(bergerT.id, {
      lastName: 'A',
      firstName: 'A',
      ratingI: 1800,
    })
    await provider.tournamentPlayers.add(bergerT.id, {
      lastName: 'B',
      firstName: 'B',
      ratingI: 1700,
    })
    await provider.tournamentPlayers.add(bergerT.id, {
      lastName: 'C',
      firstName: 'C',
      ratingI: 1600,
    })
    await provider.tournamentPlayers.add(bergerT.id, {
      lastName: 'D',
      firstName: 'D',
      ratingI: 1500,
    })

    const round = await provider.rounds.pairNext(bergerT.id)
    // Berger creates all 3 rounds at once, returns the first
    expect(round.roundNr).toBe(1)

    const rounds = await provider.rounds.list(bergerT.id)
    expect(rounds).toHaveLength(3)
    // Each round should have 2 games (4 players / 2)
    for (const r of rounds) {
      expect(r.gameCount).toBe(2)
    }
  })

  it('Berger throws if rounds already exist', async () => {
    const bergerT = await provider.tournaments.create({
      name: 'Berger2',
      group: 'A',
      pairingSystem: 'Berger',
      initialPairing: 'Rating',
      nrOfRounds: 3,
      barredPairing: false,
      compensateWeakPlayerPP: false,
      pointsPerGame: 1,
      chess4: false,
      ratingChoice: 'ELO',
      showELO: true,
      showGroup: true,
    })
    await provider.tournamentPlayers.add(bergerT.id, {
      lastName: 'A',
      firstName: 'A',
      ratingI: 1800,
    })
    await provider.tournamentPlayers.add(bergerT.id, {
      lastName: 'B',
      firstName: 'B',
      ratingI: 1700,
    })
    await provider.tournamentPlayers.add(bergerT.id, {
      lastName: 'C',
      firstName: 'C',
      ratingI: 1600,
    })
    await provider.tournamentPlayers.add(bergerT.id, {
      lastName: 'D',
      firstName: 'D',
      ratingI: 1500,
    })

    await provider.rounds.pairNext(bergerT.id)
    await expect(provider.rounds.pairNext(bergerT.id)).rejects.toThrow('redan lottade')
  })

  it('Berger requires enough rounds for players', async () => {
    const bergerT = await provider.tournaments.create({
      name: 'Berger3',
      group: 'A',
      pairingSystem: 'Berger',
      initialPairing: 'Rating',
      nrOfRounds: 2, // Too few for 4 players (need 3)
      barredPairing: false,
      compensateWeakPlayerPP: false,
      pointsPerGame: 1,
      chess4: false,
      ratingChoice: 'ELO',
      showELO: true,
      showGroup: true,
    })
    await provider.tournamentPlayers.add(bergerT.id, {
      lastName: 'A',
      firstName: 'A',
      ratingI: 1800,
    })
    await provider.tournamentPlayers.add(bergerT.id, {
      lastName: 'B',
      firstName: 'B',
      ratingI: 1700,
    })
    await provider.tournamentPlayers.add(bergerT.id, {
      lastName: 'C',
      firstName: 'C',
      ratingI: 1600,
    })
    await provider.tournamentPlayers.add(bergerT.id, {
      lastName: 'D',
      firstName: 'D',
      ratingI: 1500,
    })

    await expect(provider.rounds.pairNext(bergerT.id)).rejects.toThrow('ronder')
  })

  it('NS 8-player round 1 matches E2E snapshot', async () => {
    const nordicT = await provider.tournaments.create({
      name: 'NS-8p-base',
      group: 'Snapshot',
      pairingSystem: 'Nordisk Schweizer',
      initialPairing: 'Rating',
      nrOfRounds: 7,
      barredPairing: false,
      compensateWeakPlayerPP: false,
      pointsPerGame: 1,
      chess4: false,
      ratingChoice: 'ELO',
      showELO: true,
      showGroup: false,
    })
    for (const [ln, fn, r] of [
      ['Ödinson', 'Thor', 2100],
      ['Läufeyson', 'Loki', 1950],
      ['Järnsida', 'Björn', 1800],
      ['Åskväder', 'Odin', 1750],
      ['Stormöga', 'Frej', 1600],
      ['Svärdhand', 'Tyr', 1500],
      ['Stjärnljus', 'Freja', 1400],
      ['Nattskärm', 'Sigrid', 1300],
    ] as [string, string, number][]) {
      await provider.tournamentPlayers.add(nordicT.id, { lastName: ln, firstName: fn, ratingI: r })
    }

    const r1 = await provider.rounds.pairNext(nordicT.id)
    expect(r1.roundNr).toBe(1)
    expect(r1.gameCount).toBe(4)

    const pairings = r1.games.map((g) => [
      g.whitePlayer?.name ?? '(bye)',
      g.blackPlayer?.name ?? '(bye)',
    ])
    expect(pairings).toEqual([
      ['Frej Stormöga', 'Thor Ödinson'],
      ['Tyr Svärdhand', 'Loki Läufeyson'],
      ['Freja Stjärnljus', 'Björn Järnsida'],
      ['Sigrid Nattskärm', 'Odin Åskväder'],
    ])
  })

  it('NS 8-player all 7 rounds match E2E snapshot', async () => {
    const nordicT = await provider.tournaments.create({
      name: 'NS-8p-full',
      group: 'Snapshot',
      pairingSystem: 'Nordisk Schweizer',
      initialPairing: 'Rating',
      nrOfRounds: 7,
      barredPairing: false,
      compensateWeakPlayerPP: false,
      pointsPerGame: 1,
      chess4: false,
      ratingChoice: 'ELO',
      showELO: true,
      showGroup: false,
    })
    for (const [ln, fn, r] of [
      ['Ödinson', 'Thor', 2100],
      ['Läufeyson', 'Loki', 1950],
      ['Järnsida', 'Björn', 1800],
      ['Åskväder', 'Odin', 1750],
      ['Stormöga', 'Frej', 1600],
      ['Svärdhand', 'Tyr', 1500],
      ['Stjärnljus', 'Freja', 1400],
      ['Nattskärm', 'Sigrid', 1300],
    ] as [string, string, number][]) {
      await provider.tournamentPlayers.add(nordicT.id, { lastName: ln, firstName: fn, ratingI: r })
    }

    const expectedPairings = [
      [
        ['Frej Stormöga', 'Thor Ödinson'],
        ['Tyr Svärdhand', 'Loki Läufeyson'],
        ['Freja Stjärnljus', 'Björn Järnsida'],
        ['Sigrid Nattskärm', 'Odin Åskväder'],
      ],
      [
        ['Thor Ödinson', 'Björn Järnsida'],
        ['Loki Läufeyson', 'Odin Åskväder'],
        ['Frej Stormöga', 'Freja Stjärnljus'],
        ['Tyr Svärdhand', 'Sigrid Nattskärm'],
      ],
      [
        ['Loki Läufeyson', 'Thor Ödinson'],
        ['Björn Järnsida', 'Frej Stormöga'],
        ['Odin Åskväder', 'Tyr Svärdhand'],
        ['Sigrid Nattskärm', 'Freja Stjärnljus'],
      ],
      [
        ['Thor Ödinson', 'Odin Åskväder'],
        ['Björn Järnsida', 'Loki Läufeyson'],
        ['Frej Stormöga', 'Sigrid Nattskärm'],
        ['Freja Stjärnljus', 'Tyr Svärdhand'],
      ],
      [
        ['Tyr Svärdhand', 'Thor Ödinson'],
        ['Loki Läufeyson', 'Frej Stormöga'],
        ['Sigrid Nattskärm', 'Björn Järnsida'],
        ['Odin Åskväder', 'Freja Stjärnljus'],
      ],
      [
        ['Thor Ödinson', 'Freja Stjärnljus'],
        ['Loki Läufeyson', 'Sigrid Nattskärm'],
        ['Björn Järnsida', 'Odin Åskväder'],
        ['Frej Stormöga', 'Tyr Svärdhand'],
      ],
      [
        ['Sigrid Nattskärm', 'Thor Ödinson'],
        ['Freja Stjärnljus', 'Loki Läufeyson'],
        ['Tyr Svärdhand', 'Björn Järnsida'],
        ['Odin Åskväder', 'Frej Stormöga'],
      ],
    ]

    for (let roundIdx = 0; roundIdx < 7; roundIdx++) {
      const round = await provider.rounds.pairNext(nordicT.id)
      expect(round.roundNr).toBe(roundIdx + 1)
      const pairings = round.games.map((g) => [
        g.whitePlayer?.name ?? '(bye)',
        g.blackPlayer?.name ?? '(bye)',
      ])
      expect(pairings, `Round ${roundIdx + 1} pairings`).toEqual(expectedPairings[roundIdx])

      // Higher-rated always wins
      for (const g of round.games) {
        if (!g.whitePlayer || !g.blackPlayer) continue
        const resultType = g.whitePlayer.rating > g.blackPlayer.rating ? 'WHITE_WIN' : 'BLACK_WIN'
        await provider.results.set(nordicT.id, roundIdx + 1, g.boardNr, { resultType })
      }
    }

    // Verify final standings
    const standings = await provider.standings.get(nordicT.id, 7)
    const standingSummary = standings.map((s) => ({ place: s.place, name: s.name, score: s.score }))
    expect(standingSummary).toEqual([
      { place: 1, name: 'Thor Ödinson', score: 7 },
      { place: 2, name: 'Loki Läufeyson', score: 6 },
      { place: 3, name: 'Björn Järnsida', score: 5 },
      { place: 4, name: 'Odin Åskväder', score: 4 },
      { place: 5, name: 'Frej Stormöga', score: 3 },
      { place: 6, name: 'Tyr Svärdhand', score: 2 },
      { place: 7, name: 'Freja Stjärnljus', score: 1 },
      { place: 8, name: 'Sigrid Nattskärm', score: 0 },
    ])
  })

  it('Monrad 8-player all 7 rounds match E2E snapshot', async () => {
    const monradT = await provider.tournaments.create({
      name: 'Monrad-8p-full',
      group: 'Snapshot',
      pairingSystem: 'Monrad',
      initialPairing: 'Rating',
      nrOfRounds: 7,
      barredPairing: false,
      compensateWeakPlayerPP: false,
      pointsPerGame: 1,
      chess4: false,
      ratingChoice: 'ELO',
      showELO: true,
      showGroup: false,
    })
    for (const [ln, fn, r] of [
      ['Ödinson', 'Thor', 2100],
      ['Läufeyson', 'Loki', 1950],
      ['Järnsida', 'Björn', 1800],
      ['Åskväder', 'Odin', 1750],
      ['Stormöga', 'Frej', 1600],
      ['Svärdhand', 'Tyr', 1500],
      ['Stjärnljus', 'Freja', 1400],
      ['Nattskärm', 'Sigrid', 1300],
    ] as [string, string, number][]) {
      await provider.tournamentPlayers.add(monradT.id, { lastName: ln, firstName: fn, ratingI: r })
    }

    const expectedPairings = [
      [
        ['Loki Läufeyson', 'Thor Ödinson'],
        ['Odin Åskväder', 'Björn Järnsida'],
        ['Tyr Svärdhand', 'Frej Stormöga'],
        ['Sigrid Nattskärm', 'Freja Stjärnljus'],
      ],
      [
        ['Björn Järnsida', 'Thor Ödinson'],
        ['Freja Stjärnljus', 'Frej Stormöga'],
        ['Odin Åskväder', 'Loki Läufeyson'],
        ['Sigrid Nattskärm', 'Tyr Svärdhand'],
      ],
      [
        ['Frej Stormöga', 'Thor Ödinson'],
        ['Freja Stjärnljus', 'Björn Järnsida'],
        ['Tyr Svärdhand', 'Loki Läufeyson'],
        ['Sigrid Nattskärm', 'Odin Åskväder'],
      ],
      [
        ['Thor Ödinson', 'Freja Stjärnljus'],
        ['Björn Järnsida', 'Frej Stormöga'],
        ['Loki Läufeyson', 'Sigrid Nattskärm'],
        ['Odin Åskväder', 'Tyr Svärdhand'],
      ],
      [
        ['Thor Ödinson', 'Odin Åskväder'],
        ['Loki Läufeyson', 'Björn Järnsida'],
        ['Frej Stormöga', 'Sigrid Nattskärm'],
        ['Tyr Svärdhand', 'Freja Stjärnljus'],
      ],
      [
        ['Thor Ödinson', 'Tyr Svärdhand'],
        ['Frej Stormöga', 'Loki Läufeyson'],
        ['Björn Järnsida', 'Sigrid Nattskärm'],
        ['Freja Stjärnljus', 'Odin Åskväder'],
      ],
      [
        ['Sigrid Nattskärm', 'Thor Ödinson'],
        ['Freja Stjärnljus', 'Loki Läufeyson'],
        ['Tyr Svärdhand', 'Björn Järnsida'],
        ['Odin Åskväder', 'Frej Stormöga'],
      ],
    ]

    for (let roundIdx = 0; roundIdx < 7; roundIdx++) {
      const round = await provider.rounds.pairNext(monradT.id)
      expect(round.roundNr).toBe(roundIdx + 1)
      const pairings = round.games.map((g) => [
        g.whitePlayer?.name ?? '(bye)',
        g.blackPlayer?.name ?? '(bye)',
      ])
      expect(pairings, `Round ${roundIdx + 1} pairings`).toEqual(expectedPairings[roundIdx])

      for (const g of round.games) {
        if (!g.whitePlayer || !g.blackPlayer) continue
        const resultType = g.whitePlayer.rating > g.blackPlayer.rating ? 'WHITE_WIN' : 'BLACK_WIN'
        await provider.results.set(monradT.id, roundIdx + 1, g.boardNr, { resultType })
      }
    }

    const standings = await provider.standings.get(monradT.id, 7)
    const standingSummary = standings.map((s) => ({ place: s.place, name: s.name, score: s.score }))
    expect(standingSummary).toEqual([
      { place: 1, name: 'Thor Ödinson', score: 7 },
      { place: 2, name: 'Loki Läufeyson', score: 6 },
      { place: 3, name: 'Björn Järnsida', score: 5 },
      { place: 4, name: 'Odin Åskväder', score: 4 },
      { place: 5, name: 'Frej Stormöga', score: 3 },
      { place: 6, name: 'Tyr Svärdhand', score: 2 },
      { place: 7, name: 'Freja Stjärnljus', score: 1 },
      { place: 8, name: 'Sigrid Nattskärm', score: 0 },
    ])
  })

  it('Berger 8-player all 7 rounds match E2E snapshot', async () => {
    const bergerT = await provider.tournaments.create({
      name: 'Berger-8p',
      group: 'Snapshot',
      pairingSystem: 'Berger',
      initialPairing: 'Rating',
      nrOfRounds: 7,
      barredPairing: false,
      compensateWeakPlayerPP: false,
      pointsPerGame: 1,
      chess4: false,
      ratingChoice: 'ELO',
      showELO: true,
      showGroup: false,
    })
    for (const [ln, fn, r] of [
      ['Ödinson', 'Thor', 2100],
      ['Läufeyson', 'Loki', 1950],
      ['Järnsida', 'Björn', 1800],
      ['Åskväder', 'Odin', 1750],
      ['Stormöga', 'Frej', 1600],
      ['Svärdhand', 'Tyr', 1500],
      ['Stjärnljus', 'Freja', 1400],
      ['Nattskärm', 'Sigrid', 1300],
    ] as [string, string, number][]) {
      await provider.tournamentPlayers.add(bergerT.id, { lastName: ln, firstName: fn, ratingI: r })
    }

    const r1 = await provider.rounds.pairNext(bergerT.id) // Berger creates all rounds at once
    expect(r1.roundNr).toBe(1)
    const rounds = await provider.rounds.list(bergerT.id)
    expect(rounds).toHaveLength(7)

    const expectedPairings = [
      [
        ['Thor Ödinson', 'Sigrid Nattskärm'],
        ['Odin Åskväder', 'Frej Stormöga'],
        ['Loki Läufeyson', 'Freja Stjärnljus'],
        ['Björn Järnsida', 'Tyr Svärdhand'],
      ],
      [
        ['Sigrid Nattskärm', 'Frej Stormöga'],
        ['Thor Ödinson', 'Loki Läufeyson'],
        ['Tyr Svärdhand', 'Odin Åskväder'],
        ['Freja Stjärnljus', 'Björn Järnsida'],
      ],
      [
        ['Loki Läufeyson', 'Sigrid Nattskärm'],
        ['Frej Stormöga', 'Tyr Svärdhand'],
        ['Björn Järnsida', 'Thor Ödinson'],
        ['Odin Åskväder', 'Freja Stjärnljus'],
      ],
      [
        ['Sigrid Nattskärm', 'Tyr Svärdhand'],
        ['Loki Läufeyson', 'Björn Järnsida'],
        ['Freja Stjärnljus', 'Frej Stormöga'],
        ['Thor Ödinson', 'Odin Åskväder'],
      ],
      [
        ['Björn Järnsida', 'Sigrid Nattskärm'],
        ['Tyr Svärdhand', 'Freja Stjärnljus'],
        ['Odin Åskväder', 'Loki Läufeyson'],
        ['Frej Stormöga', 'Thor Ödinson'],
      ],
      [
        ['Sigrid Nattskärm', 'Freja Stjärnljus'],
        ['Björn Järnsida', 'Odin Åskväder'],
        ['Thor Ödinson', 'Tyr Svärdhand'],
        ['Loki Läufeyson', 'Frej Stormöga'],
      ],
      [
        ['Odin Åskväder', 'Sigrid Nattskärm'],
        ['Freja Stjärnljus', 'Thor Ödinson'],
        ['Frej Stormöga', 'Björn Järnsida'],
        ['Tyr Svärdhand', 'Loki Läufeyson'],
      ],
    ]

    for (let i = 0; i < 7; i++) {
      const pairings = rounds[i].games.map((g) => [
        g.whitePlayer?.name ?? '(bye)',
        g.blackPlayer?.name ?? '(bye)',
      ])
      expect(pairings, `Berger round ${i + 1}`).toEqual(expectedPairings[i])
    }
  })

  it('NS 7-player odd (bye) matches E2E snapshot', async () => {
    const t = await provider.tournaments.create({
      name: 'NS-7p',
      group: 'Snapshot',
      pairingSystem: 'Nordisk Schweizer',
      initialPairing: 'Rating',
      nrOfRounds: 6,
      barredPairing: false,
      compensateWeakPlayerPP: false,
      pointsPerGame: 1,
      chess4: false,
      ratingChoice: 'ELO',
      showELO: true,
      showGroup: false,
    })
    for (const [ln, fn, r] of [
      ['Ödinson', 'Thor', 2100],
      ['Läufeyson', 'Loki', 1950],
      ['Järnsida', 'Björn', 1800],
      ['Åskväder', 'Odin', 1750],
      ['Stormöga', 'Frej', 1600],
      ['Svärdhand', 'Tyr', 1500],
      ['Stjärnljus', 'Freja', 1400],
    ] as [string, string, number][]) {
      await provider.tournamentPlayers.add(t.id, { lastName: ln, firstName: fn, ratingI: r })
    }

    const expectedPairings = [
      [
        ['Odin Åskväder', 'Thor Ödinson'],
        ['Frej Stormöga', 'Loki Läufeyson'],
        ['Tyr Svärdhand', 'Björn Järnsida'],
        ['Freja Stjärnljus', '(bye)'],
      ],
      [
        ['Thor Ödinson', 'Björn Järnsida'],
        ['Loki Läufeyson', 'Freja Stjärnljus'],
        ['Odin Åskväder', 'Frej Stormöga'],
        ['Tyr Svärdhand', '(bye)'],
      ],
      [
        ['Loki Läufeyson', 'Thor Ödinson'],
        ['Björn Järnsida', 'Freja Stjärnljus'],
        ['Tyr Svärdhand', 'Odin Åskväder'],
        ['Frej Stormöga', '(bye)'],
      ],
      [
        ['Thor Ödinson', 'Frej Stormöga'],
        ['Björn Järnsida', 'Loki Läufeyson'],
        ['Freja Stjärnljus', 'Tyr Svärdhand'],
        ['Odin Åskväder', '(bye)'],
      ],
      [
        ['Thor Ödinson', 'Tyr Svärdhand'],
        ['Loki Läufeyson', 'Odin Åskväder'],
        ['Freja Stjärnljus', 'Frej Stormöga'],
        ['Björn Järnsida', '(bye)'],
      ],
      [
        ['Thor Ödinson', 'Freja Stjärnljus'],
        ['Björn Järnsida', 'Odin Åskväder'],
        ['Frej Stormöga', 'Tyr Svärdhand'],
        ['Loki Läufeyson', '(bye)'],
      ],
    ]

    for (let i = 0; i < 6; i++) {
      const round = await provider.rounds.pairNext(t.id)
      expect(round.roundNr).toBe(i + 1)
      const pairings = round.games.map((g) => [
        g.whitePlayer?.name ?? '(bye)',
        g.blackPlayer?.name ?? '(bye)',
      ])
      expect(pairings, `NS 7P round ${i + 1}`).toEqual(expectedPairings[i])
      for (const g of round.games) {
        if (!g.whitePlayer || !g.blackPlayer) continue
        await provider.results.set(t.id, i + 1, g.boardNr, {
          resultType: g.whitePlayer.rating > g.blackPlayer.rating ? 'WHITE_WIN' : 'BLACK_WIN',
        })
      }
    }
  })

  it('NS 8-player draws matches E2E snapshot', async () => {
    const t = await provider.tournaments.create({
      name: 'NS-draws',
      group: 'Snapshot',
      pairingSystem: 'Nordisk Schweizer',
      initialPairing: 'Rating',
      nrOfRounds: 3,
      barredPairing: false,
      compensateWeakPlayerPP: false,
      pointsPerGame: 1,
      chess4: false,
      ratingChoice: 'ELO',
      showELO: true,
      showGroup: false,
    })
    for (const [ln, fn, r] of [
      ['Ödinson', 'Thor', 2100],
      ['Läufeyson', 'Loki', 1950],
      ['Järnsida', 'Björn', 1800],
      ['Åskväder', 'Odin', 1750],
      ['Stormöga', 'Frej', 1600],
      ['Svärdhand', 'Tyr', 1500],
      ['Stjärnljus', 'Freja', 1400],
      ['Nattskärm', 'Sigrid', 1300],
    ] as [string, string, number][]) {
      await provider.tournamentPlayers.add(t.id, { lastName: ln, firstName: fn, ratingI: r })
    }

    const expectedPairings = [
      [
        ['Frej Stormöga', 'Thor Ödinson'],
        ['Tyr Svärdhand', 'Loki Läufeyson'],
        ['Freja Stjärnljus', 'Björn Järnsida'],
        ['Sigrid Nattskärm', 'Odin Åskväder'],
      ],
      [
        ['Thor Ödinson', 'Tyr Svärdhand'],
        ['Loki Läufeyson', 'Frej Stormöga'],
        ['Björn Järnsida', 'Sigrid Nattskärm'],
        ['Odin Åskväder', 'Freja Stjärnljus'],
      ],
      [
        ['Freja Stjärnljus', 'Thor Ödinson'],
        ['Sigrid Nattskärm', 'Loki Läufeyson'],
        ['Frej Stormöga', 'Björn Järnsida'],
        ['Tyr Svärdhand', 'Odin Åskväder'],
      ],
    ]

    for (let i = 0; i < 3; i++) {
      const round = await provider.rounds.pairNext(t.id)
      const pairings = round.games.map((g) => [
        g.whitePlayer?.name ?? '(bye)',
        g.blackPlayer?.name ?? '(bye)',
      ])
      expect(pairings, `NS draws round ${i + 1}`).toEqual(expectedPairings[i])
      for (const g of round.games) {
        if (!g.whitePlayer || !g.blackPlayer) continue
        await provider.results.set(t.id, i + 1, g.boardNr, { resultType: 'DRAW' })
      }
    }
  })

  it('NS 8-player withdrawal matches E2E snapshot', async () => {
    const t = await provider.tournaments.create({
      name: 'NS-withdraw',
      group: 'Snapshot',
      pairingSystem: 'Nordisk Schweizer',
      initialPairing: 'Rating',
      nrOfRounds: 3,
      barredPairing: false,
      compensateWeakPlayerPP: false,
      pointsPerGame: 1,
      chess4: false,
      ratingChoice: 'ELO',
      showELO: true,
      showGroup: false,
    })
    for (const [ln, fn, r] of [
      ['Ödinson', 'Thor', 2100],
      ['Läufeyson', 'Loki', 1950],
      ['Järnsida', 'Björn', 1800],
      ['Åskväder', 'Odin', 1750],
      ['Stormöga', 'Frej', 1600],
      ['Svärdhand', 'Tyr', 1500],
      ['Stjärnljus', 'Freja', 1400],
      ['Nattskärm', 'Sigrid', 1300],
    ] as [string, string, number][]) {
      await provider.tournamentPlayers.add(t.id, { lastName: ln, firstName: fn, ratingI: r })
    }

    const expectedPairings = [
      [
        ['Frej Stormöga', 'Thor Ödinson'],
        ['Tyr Svärdhand', 'Loki Läufeyson'],
        ['Freja Stjärnljus', 'Björn Järnsida'],
        ['Sigrid Nattskärm', 'Odin Åskväder'],
      ],
      [
        ['Thor Ödinson', 'Björn Järnsida'],
        ['Loki Läufeyson', 'Odin Åskväder'],
        ['Frej Stormöga', 'Freja Stjärnljus'],
        ['Tyr Svärdhand', 'Sigrid Nattskärm'],
      ],
      [
        ['Loki Läufeyson', 'Thor Ödinson'],
        ['Björn Järnsida', 'Frej Stormöga'],
        ['Odin Åskväder', 'Tyr Svärdhand'],
        ['Freja Stjärnljus', '(bye)'],
      ],
    ]

    for (let i = 0; i < 3; i++) {
      // Withdraw Sigrid after round 2
      if (i === 2) {
        const players = await provider.tournamentPlayers.list(t.id)
        const sigrid = players.find((p) => p.lastName === 'Nattskärm')!
        await provider.tournamentPlayers.update(t.id, sigrid.id, { withdrawnFromRound: 3 })
      }
      const round = await provider.rounds.pairNext(t.id)
      const pairings = round.games.map((g) => [
        g.whitePlayer?.name ?? '(bye)',
        g.blackPlayer?.name ?? '(bye)',
      ])
      expect(pairings, `NS withdraw round ${i + 1}`).toEqual(expectedPairings[i])
      for (const g of round.games) {
        if (!g.whitePlayer || !g.blackPlayer) continue
        await provider.results.set(t.id, i + 1, g.boardNr, {
          resultType: g.whitePlayer.rating > g.blackPlayer.rating ? 'WHITE_WIN' : 'BLACK_WIN',
        })
      }
    }
  })

  it('Monrad 7-player odd (bye) matches E2E snapshot', async () => {
    const t = await provider.tournaments.create({
      name: 'Monrad-7p',
      group: 'Snapshot',
      pairingSystem: 'Monrad',
      initialPairing: 'Rating',
      nrOfRounds: 6,
      barredPairing: false,
      compensateWeakPlayerPP: false,
      pointsPerGame: 1,
      chess4: false,
      ratingChoice: 'ELO',
      showELO: true,
      showGroup: false,
    })
    for (const [ln, fn, r] of [
      ['Ödinson', 'Thor', 2100],
      ['Läufeyson', 'Loki', 1950],
      ['Järnsida', 'Björn', 1800],
      ['Åskväder', 'Odin', 1750],
      ['Stormöga', 'Frej', 1600],
      ['Svärdhand', 'Tyr', 1500],
      ['Stjärnljus', 'Freja', 1400],
    ] as [string, string, number][]) {
      await provider.tournamentPlayers.add(t.id, { lastName: ln, firstName: fn, ratingI: r })
    }

    const expectedPairings = [
      [
        ['Loki Läufeyson', 'Thor Ödinson'],
        ['Odin Åskväder', 'Björn Järnsida'],
        ['Tyr Svärdhand', 'Frej Stormöga'],
        ['Freja Stjärnljus', '(bye)'],
      ],
      [
        ['Björn Järnsida', 'Thor Ödinson'],
        ['Frej Stormöga', 'Freja Stjärnljus'],
        ['Odin Åskväder', 'Loki Läufeyson'],
        ['Tyr Svärdhand', '(bye)'],
      ],
      [
        ['Thor Ödinson', 'Frej Stormöga'],
        ['Freja Stjärnljus', 'Björn Järnsida'],
        ['Loki Läufeyson', 'Tyr Svärdhand'],
        ['Odin Åskväder', '(bye)'],
      ],
      [
        ['Thor Ödinson', 'Freja Stjärnljus'],
        ['Björn Järnsida', 'Frej Stormöga'],
        ['Tyr Svärdhand', 'Odin Åskväder'],
        ['Loki Läufeyson', '(bye)'],
      ],
      [
        ['Thor Ödinson', 'Odin Åskväder'],
        ['Björn Järnsida', 'Loki Läufeyson'],
        ['Freja Stjärnljus', 'Tyr Svärdhand'],
        ['Frej Stormöga', '(bye)'],
      ],
      [
        ['Tyr Svärdhand', 'Thor Ödinson'],
        ['Frej Stormöga', 'Loki Läufeyson'],
        ['Freja Stjärnljus', 'Odin Åskväder'],
        ['Björn Järnsida', '(bye)'],
      ],
    ]

    for (let i = 0; i < 6; i++) {
      const round = await provider.rounds.pairNext(t.id)
      expect(round.roundNr).toBe(i + 1)
      const pairings = round.games.map((g) => [
        g.whitePlayer?.name ?? '(bye)',
        g.blackPlayer?.name ?? '(bye)',
      ])
      expect(pairings, `Monrad 7P round ${i + 1}`).toEqual(expectedPairings[i])
      for (const g of round.games) {
        if (!g.whitePlayer || !g.blackPlayer) continue
        await provider.results.set(t.id, i + 1, g.boardNr, {
          resultType: g.whitePlayer.rating > g.blackPlayer.rating ? 'WHITE_WIN' : 'BLACK_WIN',
        })
      }
    }
  })

  it('Monrad 8-player draws matches E2E snapshot', async () => {
    const t = await provider.tournaments.create({
      name: 'Monrad-draws',
      group: 'Snapshot',
      pairingSystem: 'Monrad',
      initialPairing: 'Rating',
      nrOfRounds: 7,
      barredPairing: false,
      compensateWeakPlayerPP: false,
      pointsPerGame: 1,
      chess4: false,
      ratingChoice: 'ELO',
      showELO: true,
      showGroup: false,
    })
    for (const [ln, fn, r] of [
      ['Ödinson', 'Thor', 2100],
      ['Läufeyson', 'Loki', 1950],
      ['Järnsida', 'Björn', 1800],
      ['Åskväder', 'Odin', 1750],
      ['Stormöga', 'Frej', 1600],
      ['Svärdhand', 'Tyr', 1500],
      ['Stjärnljus', 'Freja', 1400],
      ['Nattskärm', 'Sigrid', 1300],
    ] as [string, string, number][]) {
      await provider.tournamentPlayers.add(t.id, { lastName: ln, firstName: fn, ratingI: r })
    }

    const expectedPairings = [
      [
        ['Loki Läufeyson', 'Thor Ödinson'],
        ['Odin Åskväder', 'Björn Järnsida'],
        ['Tyr Svärdhand', 'Frej Stormöga'],
        ['Sigrid Nattskärm', 'Freja Stjärnljus'],
      ],
      [
        ['Björn Järnsida', 'Thor Ödinson'],
        ['Odin Åskväder', 'Loki Läufeyson'],
        ['Freja Stjärnljus', 'Frej Stormöga'],
        ['Sigrid Nattskärm', 'Tyr Svärdhand'],
      ],
      [
        ['Thor Ödinson', 'Odin Åskväder'],
        ['Björn Järnsida', 'Loki Läufeyson'],
        ['Frej Stormöga', 'Sigrid Nattskärm'],
        ['Freja Stjärnljus', 'Tyr Svärdhand'],
      ],
      [
        ['Frej Stormöga', 'Thor Ödinson'],
        ['Tyr Svärdhand', 'Loki Läufeyson'],
        ['Freja Stjärnljus', 'Björn Järnsida'],
        ['Sigrid Nattskärm', 'Odin Åskväder'],
      ],
      [
        ['Thor Ödinson', 'Tyr Svärdhand'],
        ['Loki Läufeyson', 'Frej Stormöga'],
        ['Björn Järnsida', 'Sigrid Nattskärm'],
        ['Odin Åskväder', 'Freja Stjärnljus'],
      ],
      [
        ['Thor Ödinson', 'Freja Stjärnljus'],
        ['Loki Läufeyson', 'Sigrid Nattskärm'],
        ['Frej Stormöga', 'Björn Järnsida'],
        ['Tyr Svärdhand', 'Odin Åskväder'],
      ],
      [
        ['Sigrid Nattskärm', 'Thor Ödinson'],
        ['Freja Stjärnljus', 'Loki Läufeyson'],
        ['Tyr Svärdhand', 'Björn Järnsida'],
        ['Frej Stormöga', 'Odin Åskväder'],
      ],
    ]

    for (let i = 0; i < 7; i++) {
      const round = await provider.rounds.pairNext(t.id)
      const pairings = round.games.map((g) => [
        g.whitePlayer?.name ?? '(bye)',
        g.blackPlayer?.name ?? '(bye)',
      ])
      expect(pairings, `Monrad draws round ${i + 1}`).toEqual(expectedPairings[i])
      for (const g of round.games) {
        if (!g.whitePlayer || !g.blackPlayer) continue
        await provider.results.set(t.id, i + 1, g.boardNr, { resultType: 'DRAW' })
      }
    }
  })

  it('Monrad 8-player withdrawal matches E2E snapshot', async () => {
    const t = await provider.tournaments.create({
      name: 'Monrad-withdraw',
      group: 'Snapshot',
      pairingSystem: 'Monrad',
      initialPairing: 'Rating',
      nrOfRounds: 4,
      barredPairing: false,
      compensateWeakPlayerPP: false,
      pointsPerGame: 1,
      chess4: false,
      ratingChoice: 'ELO',
      showELO: true,
      showGroup: false,
    })
    for (const [ln, fn, r] of [
      ['Ödinson', 'Thor', 2100],
      ['Läufeyson', 'Loki', 1950],
      ['Järnsida', 'Björn', 1800],
      ['Åskväder', 'Odin', 1750],
      ['Stormöga', 'Frej', 1600],
      ['Svärdhand', 'Tyr', 1500],
      ['Stjärnljus', 'Freja', 1400],
      ['Nattskärm', 'Sigrid', 1300],
    ] as [string, string, number][]) {
      await provider.tournamentPlayers.add(t.id, { lastName: ln, firstName: fn, ratingI: r })
    }

    const expectedPairings = [
      [
        ['Loki Läufeyson', 'Thor Ödinson'],
        ['Odin Åskväder', 'Björn Järnsida'],
        ['Tyr Svärdhand', 'Frej Stormöga'],
        ['Sigrid Nattskärm', 'Freja Stjärnljus'],
      ],
      [
        ['Björn Järnsida', 'Thor Ödinson'],
        ['Freja Stjärnljus', 'Frej Stormöga'],
        ['Odin Åskväder', 'Loki Läufeyson'],
        ['Sigrid Nattskärm', 'Tyr Svärdhand'],
      ],
      [
        ['Frej Stormöga', 'Thor Ödinson'],
        ['Freja Stjärnljus', 'Björn Järnsida'],
        ['Tyr Svärdhand', 'Loki Läufeyson'],
        ['Odin Åskväder', '(bye)'],
      ],
      [
        ['Thor Ödinson', 'Freja Stjärnljus'],
        ['Frej Stormöga', 'Odin Åskväder'],
        ['Loki Läufeyson', 'Björn Järnsida'],
        ['Tyr Svärdhand', '(bye)'],
      ],
    ]

    for (let i = 0; i < 4; i++) {
      if (i === 2) {
        const players = await provider.tournamentPlayers.list(t.id)
        const sigrid = players.find((p) => p.lastName === 'Nattskärm')!
        await provider.tournamentPlayers.update(t.id, sigrid.id, { withdrawnFromRound: 3 })
      }
      const round = await provider.rounds.pairNext(t.id)
      const pairings = round.games.map((g) => [
        g.whitePlayer?.name ?? '(bye)',
        g.blackPlayer?.name ?? '(bye)',
      ])
      expect(pairings, `Monrad withdraw round ${i + 1}`).toEqual(expectedPairings[i])
      for (const g of round.games) {
        if (!g.whitePlayer || !g.blackPlayer) continue
        await provider.results.set(t.id, i + 1, g.boardNr, {
          resultType: g.whitePlayer.rating > g.blackPlayer.rating ? 'WHITE_WIN' : 'BLACK_WIN',
        })
      }
    }
  })

  it('Nordic Schweizer pairs players within score groups', async () => {
    const nordicT = await provider.tournaments.create({
      name: 'Nordic',
      group: 'A',
      pairingSystem: 'Nordisk Schweizer',
      initialPairing: 'Rating',
      nrOfRounds: 7,
      barredPairing: false,
      compensateWeakPlayerPP: false,
      pointsPerGame: 1,
      chess4: false,
      ratingChoice: 'ELO',
      showELO: true,
      showGroup: true,
    })
    await provider.tournamentPlayers.add(nordicT.id, {
      lastName: 'A',
      firstName: 'A',
      ratingI: 1800,
    })
    await provider.tournamentPlayers.add(nordicT.id, {
      lastName: 'B',
      firstName: 'B',
      ratingI: 1700,
    })
    await provider.tournamentPlayers.add(nordicT.id, {
      lastName: 'C',
      firstName: 'C',
      ratingI: 1600,
    })
    await provider.tournamentPlayers.add(nordicT.id, {
      lastName: 'D',
      firstName: 'D',
      ratingI: 1500,
    })

    const r1 = await provider.rounds.pairNext(nordicT.id)
    expect(r1.roundNr).toBe(1)
    expect(r1.gameCount).toBe(2)
  })

  it('Monrad avoids re-pairing players across rounds', async () => {
    await provider.tournamentPlayers.add(tournamentId, {
      lastName: 'A',
      firstName: 'A',
      ratingI: 1800,
    })
    await provider.tournamentPlayers.add(tournamentId, {
      lastName: 'B',
      firstName: 'B',
      ratingI: 1700,
    })
    await provider.tournamentPlayers.add(tournamentId, {
      lastName: 'C',
      firstName: 'C',
      ratingI: 1600,
    })
    await provider.tournamentPlayers.add(tournamentId, {
      lastName: 'D',
      firstName: 'D',
      ratingI: 1500,
    })

    // Pair round 1
    const r1 = await provider.rounds.pairNext(tournamentId)
    expect(r1.roundNr).toBe(1)
    expect(r1.gameCount).toBe(2)

    // Set results for round 1
    for (const g of r1.games) {
      await provider.results.set(tournamentId, 1, g.boardNr, { resultType: 'DRAW' })
    }

    // Pair round 2
    const r2 = await provider.rounds.pairNext(tournamentId)
    expect(r2.roundNr).toBe(2)
    expect(r2.gameCount).toBe(2)

    // No pair from round 1 should repeat in round 2
    const r1Pairs = new Set(
      r1.games.map((g) => [g.whitePlayer?.id, g.blackPlayer?.id].sort().join('-')),
    )
    for (const g of r2.games) {
      const pair = [g.whitePlayer?.id, g.blackPlayer?.id].sort().join('-')
      expect(r1Pairs.has(pair)).toBe(false)
    }
  })

  it('unpairLastRound removes the last round', async () => {
    await provider.tournamentPlayers.add(tournamentId, {
      lastName: 'A',
      firstName: 'A',
      ratingI: 1500,
    })
    await provider.tournamentPlayers.add(tournamentId, {
      lastName: 'B',
      firstName: 'B',
      ratingI: 1400,
    })

    await provider.rounds.pairNext(tournamentId)
    let rounds = await provider.rounds.list(tournamentId)
    expect(rounds).toHaveLength(1)

    await provider.rounds.unpairLast(tournamentId)
    rounds = await provider.rounds.list(tournamentId)
    expect(rounds).toHaveLength(0)
  })
})
