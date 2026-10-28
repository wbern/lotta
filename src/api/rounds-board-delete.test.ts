import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DataProvider } from './data-provider'
import { PROVIDERS } from './test-providers'

describe.each(PROVIDERS)('deleting the last board of an earlier round (%s)', (_name, factory) => {
  let provider: DataProvider
  let teardown: () => Promise<void>
  let tid: number

  beforeEach(async () => {
    const setup = await factory()
    provider = setup.provider
    teardown = setup.teardown
    const t = await provider.tournaments.create({
      name: 'Rondlucka',
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
      showGroup: true,
    })
    tid = t.id
    for (const [lastName, ratingI] of [
      ['Andersson', 1500],
      ['Björk', 1400],
      ['Carlsson', 1300],
      ['Dahl', 1200],
    ] as const) {
      await provider.tournamentPlayers.add(tid, { lastName, firstName: 'X', ratingI })
    }
    for (const roundNr of [1, 2]) {
      const round = await provider.rounds.pairNext(tid)
      expect(round.roundNr).toBe(roundNr)
      for (const g of round.games) {
        await provider.results.set(tid, roundNr, g.boardNr, { resultType: 'DRAW' })
      }
    }
  })

  afterEach(async () => {
    await teardown()
  })

  it('given rounds 1 and 2, when all boards of round 1 are deleted, then it is refused and the next pairing still creates round 3', async () => {
    const round1 = await provider.rounds.get(tid, 1)
    const boardNrs = round1.games.map((g) => g.boardNr)

    await expect(provider.results.deleteGames(tid, 1, boardNrs)).rejects.toThrow(
      'Det går inte att ta bort det sista bordet i rond 1 eftersom senare ronder finns.',
    )

    expect((await provider.rounds.list(tid)).map((r) => r.roundNr)).toEqual([1, 2])
    const round3 = await provider.rounds.pairNext(tid)
    expect(round3.roundNr).toBe(3)
  })
})
