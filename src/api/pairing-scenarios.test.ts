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
})
