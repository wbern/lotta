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
})
