/**
 * Pairing scenarios through the real API (local and RPC providers). Expected
 * pairings are derived by hand from the pairing rules in the comments.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { CreateTournamentRequest, RoundDto } from '../types/api'
import type { DataProvider } from './data-provider'
import { PROVIDERS } from './test-providers'

describe.each(PROVIDERS)('pairing scenarios (%s)', (_name, factory) => {
  let provider: DataProvider
  let teardown: () => Promise<void>

  beforeEach(async () => {
    const setup = await factory()
    provider = setup.provider
    teardown = setup.teardown
  })

  afterEach(async () => {
    await teardown()
  })

  async function createTournament(overrides: Partial<CreateTournamentRequest> = {}) {
    return provider.tournaments.create({
      name: 'Scenario',
      group: 'A',
      pairingSystem: 'Monrad',
      initialPairing: 'Rating',
      nrOfRounds: 5,
      barredPairing: false,
      compensateWeakPlayerPP: false,
      pointsPerGame: 1,
      chess4: false,
      ratingChoice: 'ELO',
      showELO: true,
      showGroup: false,
      ...overrides,
    })
  }

  /** lastName → lotNr as stored on the round's games. */
  function lotsByLastName(round: RoundDto): Record<string, number> {
    const lots: Record<string, number> = {}
    for (const g of round.games) {
      for (const p of [g.whitePlayer, g.blackPlayer]) {
        if (p) lots[p.name.split(' ').slice(1).join(' ')] = p.lotNr
      }
    }
    return lots
  }

  describe('identical ratings (ID)', () => {
    it('given four players with equal rating, when round 1 is seeded by rating, then lots follow Swedish name order: Berg, Åberg, Äberg, Öberg', async () => {
      const t = await createTournament()
      for (const lastName of ['Öberg', 'Åberg', 'Äberg', 'Berg']) {
        await provider.tournamentPlayers.add(t.id, { lastName, firstName: 'Anna', ratingI: 1500 })
      }
      const r1 = await provider.rounds.pairNext(t.id)
      expect(lotsByLastName(r1)).toEqual({ Berg: 1, Åberg: 2, Äberg: 3, Öberg: 4 })
    })

    it('given equal rating and equal last name, when seeded, then the first name decides (Åke before Örjan)', async () => {
      const t = await createTournament()
      await provider.tournamentPlayers.add(t.id, {
        lastName: 'Berg',
        firstName: 'Örjan',
        ratingI: 1500,
      })
      await provider.tournamentPlayers.add(t.id, {
        lastName: 'Berg',
        firstName: 'Åke',
        ratingI: 1500,
      })
      const r1 = await provider.rounds.pairNext(t.id)
      const lot = Object.fromEntries(
        r1.games.flatMap((g) => [g.whitePlayer!, g.blackPlayer!]).map((p) => [p.name, p.lotNr]),
      )
      expect(lot).toEqual({ 'Åke Berg': 1, 'Örjan Berg': 2 })
    })
  })

  describe('pairing failure message (MAJ)', () => {
    const BARRED_TEXT =
      'Lottning är inte möjlig!\nFör att lösa detta, avmarkera "Låt ej spelare från samma klubb mötas" i turneringsinställningarna, eller ändra vilka spelare som deltar.'
    const GENERIC_TEXT =
      'Lottning är inte möjlig!\nFör att lösa detta, ändra vilka spelare som deltar (utgå/lägg till) eller avsluta turneringen genom att sätta antal ronder till antalet lottade ronder.'

    async function addPlayers(tid: number, specs: [string, number][]) {
      for (const [lastName, clubIndex] of specs) {
        await provider.tournamentPlayers.add(tid, {
          lastName,
          firstName: 'Anna',
          ratingI: 1500,
          clubIndex,
        })
      }
    }

    it('given four players from one club with "Låt ej spelare från samma klubb mötas", when round 1 is paired, then the message points at the club setting', async () => {
      const club = await provider.clubs.add({ name: 'SK Alfa' })
      const t = await createTournament({ barredPairing: true })
      await addPlayers(t.id, [
        ['Ahl', club.id],
        ['Berg', club.id],
        ['Cedh', club.id],
        ['Dahl', club.id],
      ])
      await expect(provider.rounds.pairNext(t.id)).rejects.toThrow(BARRED_TEXT)
    })

    it('given two clubs of two players each, barred, when round 3 cannot avoid rematches, then the generic message is shown (barred is locked after round 1)', async () => {
      // Barred: only cross-club games are allowed. With A1, A2 (Alfa) and
      // B1, B2 (Beta) there are exactly two cross-club rounds; round 3 must
      // repeat a meeting, so no valid pairing exists.
      const alfa = await provider.clubs.add({ name: 'SK Alfa' })
      const beta = await provider.clubs.add({ name: 'SK Beta' })
      const t = await createTournament({ barredPairing: true })
      await addPlayers(t.id, [
        ['Ahl', alfa.id],
        ['Alm', alfa.id],
        ['Berg', beta.id],
        ['Bok', beta.id],
      ])
      for (const roundNr of [1, 2]) {
        const round = await provider.rounds.pairNext(t.id)
        for (const g of round.games) {
          await provider.results.set(t.id, roundNr, g.boardNr, { resultType: 'DRAW' })
        }
      }
      await expect(provider.rounds.pairNext(t.id)).rejects.toThrow(GENERIC_TEXT)
    })

    it('given two players in Monrad who met in round 1, when round 2 is paired, then the generic message is shown', async () => {
      const t = await createTournament()
      await addPlayers(t.id, [
        ['Ahl', 0],
        ['Berg', 0],
      ])
      const r1 = await provider.rounds.pairNext(t.id)
      await provider.results.set(t.id, 1, r1.games[0].boardNr, { resultType: 'DRAW' })
      await expect(provider.rounds.pairNext(t.id)).rejects.toThrow(GENERIC_TEXT)
    })
  })

  // ── helpers ──────────────────────────────────────────────────────────

  type Spec = [
    lastName: string,
    firstName: string,
    ratingI: number,
    extra?: Record<string, unknown>,
  ]

  async function addAll(tid: number, specs: Spec[]) {
    for (const [lastName, firstName, ratingI, extra] of specs) {
      await provider.tournamentPlayers.add(tid, { lastName, firstName, ratingI, ...extra })
    }
  }

  /** Map player id → last name, so pairings are compared by name fields, never formatted names. */
  async function lastNames(tid: number): Promise<Map<number, string>> {
    const players = await provider.tournamentPlayers.list(tid)
    return new Map(players.map((p) => [p.id, p.lastName]))
  }

  async function boards(tid: number, round: RoundDto): Promise<[string, string][]> {
    const names = await lastNames(tid)
    return round.games.map((g) => [
      g.whitePlayer ? names.get(g.whitePlayer.id)! : '(bye)',
      g.blackPlayer ? names.get(g.blackPlayer.id)! : '(bye)',
    ])
  }

  async function storedLots(tid: number, round: RoundDto): Promise<Record<string, number>> {
    const names = await lastNames(tid)
    const lots: Record<string, number> = {}
    for (const g of round.games) {
      for (const p of [g.whitePlayer, g.blackPlayer]) {
        if (p) lots[names.get(p.id)!] = p.lotNr
      }
    }
    return lots
  }

  /** Set results by board: 'W' white wins, 'B' black wins, 'D' draw, 'P' postponed. */
  async function play(tid: number, round: RoundDto, results: string) {
    const map = { W: 'WHITE_WIN', B: 'BLACK_WIN', D: 'DRAW', P: 'POSTPONED' } as const
    const playable = round.games.filter((g) => g.whitePlayer && g.blackPlayer)
    expect(playable).toHaveLength(results.length)
    for (let i = 0; i < playable.length; i++) {
      await provider.results.set(tid, round.roundNr, playable[i].boardNr, {
        resultType: map[results[i] as keyof typeof map],
      })
    }
  }

  // Monrad rules used for the hand computations below:
  // - order players by score (pairing points), then by the lot number stored
  //   with the previous round's games (round 1: by rating); renumber 1..n;
  // - odd count: the lowest-ranked player without a bye gets it (board last);
  // - the top unpaired player meets the next one they have not met (and, when
  //   barred, is not from the same club); backtrack if the rest cannot pair;
  // - colours: the player with fewer whites (a bye counts as white) gets
  //   white; on equal counts the lower-ranked player gets white.

  describe('Monrad lot carry-over (M1)', () => {
    const PLAYERS: Spec[] = [
      ['Ahl', 'Adam', 2000],
      ['Berg', 'Bea', 1900],
      ['Cedh', 'Carl', 1800],
      ['Dahl', 'Dora', 1700],
      ['Ek', 'Erik', 1600],
      ['Falk', 'Fia', 1500],
    ]

    it('given 6 players over three rounds incl. unpairing and re-pairing round 2, when paired, then lots carry over and pairings follow the Monrad rules', async () => {
      const t = await createTournament()
      await addAll(t.id, PLAYERS)

      // R1: lots by rating 1..6 → 1–2, 3–4, 5–6, lower lot gets white.
      const r1 = await provider.rounds.pairNext(t.id)
      expect(await boards(t.id, r1)).toEqual([
        ['Berg', 'Ahl'],
        ['Dahl', 'Cedh'],
        ['Falk', 'Ek'],
      ])
      // Ahl wins with black, Dahl wins with white, Ek–Falk draw.
      await play(t.id, r1, 'BWD')

      // R2 order: Ahl 1 (lot 1), Dahl 1 (lot 4), Ek ½ (5), Falk ½ (6), Berg 0 (2), Cedh 0 (3).
      // Ahl–Dahl: Dahl has 1 white, Ahl 0 → Ahl white.
      // Ek–Falk met → Ek–Berg: Berg has 1 white → Ek white. Falk–Cedh: Falk 1 white → Cedh white.
      const expectedR2: [string, string][] = [
        ['Ahl', 'Dahl'],
        ['Ek', 'Berg'],
        ['Cedh', 'Falk'],
      ]
      const expectedR2Lots = { Ahl: 1, Dahl: 2, Ek: 3, Falk: 4, Berg: 5, Cedh: 6 }
      const r2 = await provider.rounds.pairNext(t.id)
      expect(await boards(t.id, r2)).toEqual(expectedR2)
      expect(await storedLots(t.id, r2)).toEqual(expectedR2Lots)

      // Unpair and re-pair: round 2 is rebuilt from round 1's stored lots → identical.
      await provider.rounds.unpairLast(t.id)
      const r2again = await provider.rounds.pairNext(t.id)
      expect(await boards(t.id, r2again)).toEqual(expectedR2)
      expect(await storedLots(t.id, r2again)).toEqual(expectedR2Lots)
      // Ahl beats Dahl, Ek–Berg draw, Cedh beats Falk.
      await play(t.id, r2again, 'WDW')

      // Scores: Ahl 2, Dahl 1, Ek 1, Cedh 1, Falk ½, Berg ½.
      // R3 order with R2 lots: Ahl (1), Dahl (2), Ek (3), Cedh (6), Falk (4), Berg (5).
      // Ahl–Dahl met → Ahl–Ek, both 1 white → Ek (lower) white.
      // Dahl–Cedh met (R1) → Dahl–Falk, both 1 white → Falk white.
      // Cedh–Berg, both 1 white → Berg white.
      const r3 = await provider.rounds.pairNext(t.id)
      expect(await boards(t.id, r3)).toEqual([
        ['Ek', 'Ahl'],
        ['Falk', 'Dahl'],
        ['Berg', 'Cedh'],
      ])
      expect(await storedLots(t.id, r3)).toEqual({
        Ahl: 1,
        Dahl: 2,
        Ek: 3,
        Cedh: 4,
        Falk: 5,
        Berg: 6,
      })
    })
  })

  describe('bye rotation (BYE)', () => {
    it('given 5 players in Monrad, when four rounds are paired with the higher rating winning, then the bye goes to the lowest-ranked player without one and nobody gets two', async () => {
      const t = await createTournament()
      await addAll(t.id, [
        ['Ahl', 'Adam', 2000],
        ['Berg', 'Bea', 1900],
        ['Cedh', 'Carl', 1800],
        ['Dahl', 'Dora', 1700],
        ['Ek', 'Erik', 1600],
      ])

      // R1: Ek (last) bye; Ahl–Berg, Cedh–Dahl (lower lot white).
      const r1 = await provider.rounds.pairNext(t.id)
      expect(await boards(t.id, r1)).toEqual([
        ['Berg', 'Ahl'],
        ['Dahl', 'Cedh'],
        ['Ek', '(bye)'],
      ])
      await play(t.id, r1, 'BB')

      // Scores Ahl 1, Cedh 1, Ek 1, Berg 0, Dahl 0 → order Ahl, Cedh, Ek, Berg, Dahl.
      // Bye: Dahl. Ahl–Cedh (0 whites each → Cedh white); Ek–Berg (1 white each → Berg white).
      const r2 = await provider.rounds.pairNext(t.id)
      expect(await boards(t.id, r2)).toEqual([
        ['Cedh', 'Ahl'],
        ['Berg', 'Ek'],
        ['Dahl', '(bye)'],
      ])
      await play(t.id, r2, 'BW')

      // Scores Ahl 2, Cedh 1, Ek 1, Berg 1, Dahl 1 → order Ahl, Cedh, Ek, Berg, Dahl.
      // Bye: Dahl had one → Berg. Ahl–Cedh met; Ahl–Ek would leave Cedh–Dahl
      // (met) → backtrack: Ahl–Dahl (Dahl 2 whites → Ahl white), Cedh–Ek
      // (1 white each → Ek white).
      const r3 = await provider.rounds.pairNext(t.id)
      expect(await boards(t.id, r3)).toEqual([
        ['Ahl', 'Dahl'],
        ['Ek', 'Cedh'],
        ['Berg', '(bye)'],
      ])
      await play(t.id, r3, 'WB')

      // Scores Ahl 3, Cedh 2, Berg 2, Ek 1, Dahl 1 → order Ahl, Cedh, Berg, Ek, Dahl.
      // Bye: Dahl, Berg, Ek had one → Cedh. Ahl–Berg met → Ahl–Ek (Ek 2 whites
      // → Ahl white). Berg–Dahl: Berg 3 whites, Dahl 2 → Dahl white.
      const r4 = await provider.rounds.pairNext(t.id)
      expect(await boards(t.id, r4)).toEqual([
        ['Ahl', 'Ek'],
        ['Dahl', 'Berg'],
        ['Cedh', '(bye)'],
      ])
    })
  })

  describe('postponed games (PP / PO)', () => {
    const PLAYERS: Spec[] = [
      ['Ahl', 'Adam', 2000],
      ['Berg', 'Bea', 1900],
      ['Cedh', 'Carl', 1800],
      ['Dahl', 'Dora', 1700],
    ]

    it('given a postponed game, when standings and the next round are computed, then it scores 0 in standings but the win points for pairing', async () => {
      const t = await createTournament()
      await addAll(t.id, PLAYERS)
      const r1 = await provider.rounds.pairNext(t.id)
      // R1: Berg–Ahl postponed, Dahl–Cedh 0-1.
      await play(t.id, r1, 'PB')

      const standings = await provider.standings.get(t.id, 1)
      expect(Object.fromEntries(standings.map((s) => [s.name, s.score]))).toEqual({
        'Carl Cedh': 1,
        'Adam Ahl': 0,
        'Bea Berg': 0,
        'Dora Dahl': 0,
      })

      // Pairing points: Ahl 1, Berg 1 (postponed), Cedh 1, Dahl 0.
      // Order Ahl, Berg, Cedh, Dahl. Ahl–Berg already met (postponed counts) →
      // Ahl–Cedh (0 whites each → Cedh white), Berg–Dahl (1 each → Dahl white).
      const r2 = await provider.rounds.pairNext(t.id)
      expect(await boards(t.id, r2)).toEqual([
        ['Cedh', 'Ahl'],
        ['Dahl', 'Berg'],
      ])
    })

    it('given every round-1 game postponed, when round 2 is paired, then pairing is allowed and everyone is on equal pairing points', async () => {
      const t = await createTournament()
      await addAll(t.id, PLAYERS)
      const r1 = await provider.rounds.pairNext(t.id)
      await play(t.id, r1, 'PP')

      const standings = await provider.standings.get(t.id, 1)
      expect(standings.map((s) => [s.place, s.score])).toEqual([
        [1, 0],
        [1, 0],
        [1, 0],
        [1, 0],
      ])

      // All on 1 pairing point, lots 1..4. Ahl–Berg met → Ahl–Cedh (Cedh white),
      // Berg–Dahl (1 white each → Dahl white).
      const r2 = await provider.rounds.pairNext(t.id)
      expect(await boards(t.id, r2)).toEqual([
        ['Cedh', 'Ahl'],
        ['Dahl', 'Berg'],
      ])
    })
  })

  describe('barred Monrad (BAR)', () => {
    it('given three clubs of two with "Låt ej spelare från samma klubb mötas", when round 1 is paired, then no game is within a club', async () => {
      const alfa = await provider.clubs.add({ name: 'SK Alfa' })
      const beta = await provider.clubs.add({ name: 'SK Beta' })
      const gamma = await provider.clubs.add({ name: 'SK Gamma' })
      const t = await createTournament({ barredPairing: true })
      await addAll(t.id, [
        ['Ahl', 'Adam', 2000, { clubIndex: alfa.id }],
        ['Berg', 'Bea', 1900, { clubIndex: alfa.id }],
        ['Cedh', 'Carl', 1800, { clubIndex: beta.id }],
        ['Dahl', 'Dora', 1700, { clubIndex: beta.id }],
        ['Ek', 'Erik', 1600, { clubIndex: gamma.id }],
        ['Falk', 'Fia', 1500, { clubIndex: gamma.id }],
      ])
      // Ahl–Berg barred → Ahl–Cedh. Berg–Dahl would leave Ek–Falk (barred) →
      // backtrack: Berg–Ek, then Dahl–Falk. Lower-ranked player gets white.
      const r1 = await provider.rounds.pairNext(t.id)
      expect(await boards(t.id, r1)).toEqual([
        ['Cedh', 'Ahl'],
        ['Ek', 'Berg'],
        ['Falk', 'Dahl'],
      ])
    })
  })

  describe('withdrawn player (WD)', () => {
    it('given a player withdrawn from round 2, when later rounds are paired, then the player is never paired again and standings show "(utgått r2)"', async () => {
      const t = await createTournament()
      await addAll(t.id, [
        ['Ahl', 'Adam', 2000],
        ['Berg', 'Bea', 1900],
        ['Cedh', 'Carl', 1800],
        ['Dahl', 'Dora', 1700],
        ['Ek', 'Erik', 1600],
      ])
      const r1 = await provider.rounds.pairNext(t.id)
      await play(t.id, r1, 'BB')
      const dahl = (await provider.tournamentPlayers.list(t.id)).find((p) => p.lastName === 'Dahl')!
      await provider.tournamentPlayers.update(t.id, dahl.id, { withdrawnFromRound: 2 })

      for (const roundNr of [2, 3]) {
        const round = await provider.rounds.pairNext(t.id)
        const ids = round.games.flatMap((g) => [g.whitePlayer?.id, g.blackPlayer?.id])
        expect(ids, `round ${roundNr}`).not.toContain(dahl.id)
        // 4 active players → two games, no bye.
        expect(round.games, `round ${roundNr}`).toHaveLength(2)
        await play(t.id, round, 'DD')
      }
      for (const round of [1, 3]) {
        const names = (await provider.standings.get(t.id, round)).map((s) => s.name)
        expect(names, `round ${round}`).toContain('Dora Dahl (utgått r2)')
      }
    })
  })

  describe('rating choice (RC)', () => {
    const PLAYERS: Spec[] = [
      ['Ahl', 'Xena', 2000, { ratingQ: 0 }],
      ['Berg', 'Wilma', 1000, { ratingQ: 0 }],
      ['Ceder', 'Yngve', 1500, { ratingQ: 1900 }],
      ['Dahl', 'Zara', 1800, { ratingQ: 1700 }],
    ]

    it('given rating choice QUICK, when round 1 is seeded, then quick ratings decide and unrated players fall back to name order', async () => {
      // QUICK: Ceder 1900, Dahl 1700, Ahl 0, Berg 0 → lots Ceder, Dahl, Ahl, Berg.
      const t = await createTournament({ ratingChoice: 'QUICK' })
      await addAll(t.id, PLAYERS)
      const r1 = await provider.rounds.pairNext(t.id)
      expect(await storedLots(t.id, r1)).toEqual({ Ceder: 1, Dahl: 2, Ahl: 3, Berg: 4 })
      expect(await boards(t.id, r1)).toEqual([
        ['Dahl', 'Ceder'],
        ['Berg', 'Ahl'],
      ])
    })

    it('given rating choice QUICK_THEN_ELO, when round 1 is seeded, then a missing quick rating falls back to ELO', async () => {
      // Ahl 2000 (ELO), Ceder 1900 (quick), Dahl 1700 (quick), Berg 1000 (ELO).
      const t = await createTournament({ ratingChoice: 'QUICK_THEN_ELO' })
      await addAll(t.id, PLAYERS)
      const r1 = await provider.rounds.pairNext(t.id)
      expect(await storedLots(t.id, r1)).toEqual({ Ahl: 1, Ceder: 2, Dahl: 3, Berg: 4 })
      const standings = await provider.standings.get(t.id, 1)
      expect(Object.fromEntries(standings.map((s) => [s.name, s.rating]))).toEqual({
        'Xena Ahl': 2000,
        'Yngve Ceder': 1900,
        'Zara Dahl': 1700,
        'Wilma Berg': 1000,
      })
    })
  })

  describe('player presentation', () => {
    it.each([
      ['FIRST_LAST', 'Adam Ahl'],
      ['LAST_FIRST', 'Ahl Adam'],
    ])('given presentation %s, when standings are read, then the name is "%s"', async (presentation, expected) => {
      const t = await createTournament()
      await addAll(t.id, [
        ['Ahl', 'Adam', 2000],
        ['Berg', 'Bea', 1900],
      ])
      const r1 = await provider.rounds.pairNext(t.id)
      await play(t.id, r1, 'B')
      await provider.settings.update({ playerPresentation: presentation })
      const standings = await provider.standings.get(t.id, 1)
      expect(standings[0].name).toBe(expected)
    })
  })
})
