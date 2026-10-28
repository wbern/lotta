import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getUndoManager } from '../db/undo-provider'
import type { DataProvider } from './data-provider'
import { createLocalProvider } from './local-data-provider'

describe('result entry history (Redigera → Historik)', () => {
  let provider: DataProvider
  let teardown: () => Promise<void>

  beforeEach(async () => {
    const setup = await createLocalProvider()
    provider = setup.provider
    teardown = setup.teardown
  })

  afterEach(async () => {
    await teardown()
  })

  // Berger pairs every round at once, so round 2 exists while round 1 is "current":
  // the history must say which round a result belongs to, or a correction in an
  // earlier round looks like an entry in the latest one.
  async function bergerTournament(): Promise<number> {
    const t = await provider.tournaments.create({
      name: 'Historik',
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
      showGroup: false,
    })
    for (const [lastName, ratingI] of [
      ['Andersson', 1500],
      ['Björk', 1400],
      ['Carlsson', 1300],
      ['Dahl', 1200],
    ] as const) {
      await provider.tournamentPlayers.add(t.id, { lastName, firstName: 'X', ratingI })
    }
    await provider.rounds.pairNext(t.id)
    return t.id
  }

  function lastEntry() {
    const timeline = getUndoManager().getTimeline()
    return timeline[timeline.length - 1]
  }

  it('given round 2 board 1, when a result is entered, then the history entry names round and board', async () => {
    const tid = await bergerTournament()

    await provider.results.set(tid, 2, 1, { resultType: 'WHITE_WIN' })

    expect(lastEntry().label).toBe('Ange resultat')
    expect(lastEntry().detail).toBe('Rond 2, Bord 1: 1-0')
  })

  it('given an existing result, when it is corrected with an expected prior value, then the history entry names round and board', async () => {
    const tid = await bergerTournament()
    await provider.results.set(tid, 3, 2, { resultType: 'WHITE_WIN' })

    await provider.results.set(tid, 3, 2, { resultType: 'BLACK_WIN', expectedPrior: 'WHITE_WIN' })

    expect(lastEntry().detail).toBe('Rond 3, Bord 2: 0-1')
  })
})
