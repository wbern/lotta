import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getUndoManager } from '../db/undo-provider'
import type { DataProvider } from './data-provider'
import { createLocalProvider } from './local-data-provider'

describe('unpairLastRound undo history entry', () => {
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

  async function pairedTournament(pairingSystem: 'Berger' | 'Monrad'): Promise<number> {
    const t = await provider.tournaments.create({
      name: `Unpair ${pairingSystem}`,
      group: 'A',
      pairingSystem,
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
    for (const [lastName, ratingI] of [
      ['Andersson', 1500],
      ['Björk', 1400],
      ['Carlsson', 1300],
      ['Dahl', 1200],
    ] as const) {
      await provider.tournamentPlayers.add(t.id, { lastName, firstName: 'X', ratingI })
    }
    // Berger pairs every round up front; Monrad pairs one round at a time.
    await provider.rounds.pairNext(t.id)
    return t.id
  }

  function lastEntry() {
    const timeline = getUndoManager().getTimeline()
    return timeline[timeline.length - 1]
  }

  it('given a Berger tournament, when the pairing is undone, then the history says all rounds were removed', async () => {
    const tid = await pairedTournament('Berger')
    expect((await provider.rounds.list(tid)).length).toBeGreaterThan(1)

    await provider.rounds.unpairLast(tid)

    expect(await provider.rounds.list(tid)).toEqual([])
    expect(lastEntry().label).toBe('Ångra lottning')
    expect(lastEntry().detail).toBe('Alla ronder')
  })

  it('given a Monrad tournament with round 1 paired, when the pairing is undone, then the history names round 1', async () => {
    const tid = await pairedTournament('Monrad')

    await provider.rounds.unpairLast(tid)

    expect((await provider.rounds.list(tid)).map((r) => r.roundNr)).toEqual([])
    expect(lastEntry().label).toBe('Ångra lottning')
    expect(lastEntry().detail).toBe('Rond 1')
  })
})
