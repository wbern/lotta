import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DataProvider } from './data-provider'
import { PROVIDERS } from './test-providers'

describe.each(PROVIDERS)('standings API (%s)', (_name, factory) => {
  let provider: DataProvider
  let teardown: () => Promise<void>
  let tournamentId: number

  beforeEach(async () => {
    const setup = await factory()
    provider = setup.provider
    teardown = setup.teardown
    const t = await provider.tournaments.create({
      name: 'Utgått',
      group: 'A',
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
    tournamentId = t.id
  })

  afterEach(async () => {
    await teardown()
  })

  async function playRound(roundNr: number) {
    const round = await provider.rounds.pairNext(tournamentId)
    for (const g of round.games) {
      if (g.whitePlayer && g.blackPlayer) {
        await provider.results.set(tournamentId, roundNr, g.boardNr, { resultType: 'DRAW' })
      }
    }
  }

  async function setUpWithdrawnFromRound3() {
    for (const [lastName, firstName, ratingI] of [
      ['Åberg', 'Siv', 1500],
      ['Berg', 'Bo', 1400],
      ['Carlsson', 'Cilla', 1300],
      ['Dahl', 'Dan', 1200],
      ['Ek', 'Eva', 1100],
      ['Falk', 'Filip', 1000],
    ] as [string, string, number][]) {
      await provider.tournamentPlayers.add(tournamentId, { lastName, firstName, ratingI })
    }
    await playRound(1)
    await playRound(2)
    const siv = (await provider.tournamentPlayers.list(tournamentId)).find(
      (p) => p.lastName === 'Åberg',
    )!
    await provider.tournamentPlayers.update(tournamentId, siv.id, { withdrawnFromRound: 3 })
    await playRound(3)
    await playRound(4)
  }

  it('given a player withdrawn from round 3, when standings are viewed for round 2 and round 4, then both show "(utgått r3)"', async () => {
    await setUpWithdrawnFromRound3()
    for (const round of [2, 4]) {
      const names = (await provider.standings.get(tournamentId, round)).map((s) => s.name)
      expect(names, `round ${round}`).toContain('Siv Åberg (utgått r3)')
    }
  })

  it('given players who are not withdrawn, when standings are viewed, then their names have no suffix', async () => {
    await setUpWithdrawnFromRound3()
    const names = (await provider.standings.get(tournamentId, 4)).map((s) => s.name)
    expect(names).toEqual(
      expect.arrayContaining(['Bo Berg', 'Cilla Carlsson', 'Dan Dahl', 'Eva Ek', 'Filip Falk']),
    )
    expect(names.filter((n) => n.includes('utgått'))).toEqual(['Siv Åberg (utgått r3)'])
  })

  it('given presentation LAST_FIRST, when standings are viewed, then the suffix follows the last-first name', async () => {
    await setUpWithdrawnFromRound3()
    await provider.settings.update({ playerPresentation: 'LAST_FIRST' })
    const names = (await provider.standings.get(tournamentId, 4)).map((s) => s.name)
    expect(names).toContain('Åberg Siv (utgått r3)')
  })
})
