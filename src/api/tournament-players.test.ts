import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DataProvider } from './data-provider'
import { PROVIDERS } from './test-providers'

describe.each(PROVIDERS)('tournament-players API (%s)', (_name, factory) => {
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

  it('adds, updates, and removes a tournament player', async () => {
    const added = await provider.tournamentPlayers.add(tournamentId, {
      lastName: 'Andersson',
      firstName: 'Erik',
    })
    expect(added.lastName).toBe('Andersson')

    const list = await provider.tournamentPlayers.list(tournamentId)
    expect(list).toHaveLength(1)

    const updated = await provider.tournamentPlayers.update(tournamentId, added.id, {
      ratingN: 1900,
    })
    expect(updated.ratingN).toBe(1900)

    await provider.tournamentPlayers.remove(tournamentId, added.id)
    const afterRemove = await provider.tournamentPlayers.list(tournamentId)
    expect(afterRemove).toEqual([])
  })

  it('adds multiple tournament players in batch', async () => {
    const results = await provider.tournamentPlayers.addMany(tournamentId, [
      { lastName: 'Nilsson', firstName: 'Karl' },
      { lastName: 'Lindqvist', firstName: 'Maja' },
    ])

    expect(results).toHaveLength(2)
    expect(results[0].lastName).toBe('Nilsson')
    expect(results[1].lastName).toBe('Lindqvist')

    const afterAdd = await provider.tournamentPlayers.list(tournamentId)
    expect(afterAdd).toHaveLength(2)
  })

  it('round-trips addedAtRound and protectFromByeInDebut over the data-provider wire', async () => {
    // Default add: protectFromByeInDebut defaults to true, addedAtRound to 0.
    const defaultAdd = await provider.tournamentPlayers.add(tournamentId, {
      lastName: 'Default',
      firstName: 'D',
    })
    expect(defaultAdd.addedAtRound).toBe(0)
    expect(defaultAdd.protectFromByeInDebut).toBe(true)

    // Opt-out add: caller explicitly disables protection at insert time.
    const optOut = await provider.tournamentPlayers.add(tournamentId, {
      lastName: 'OptOut',
      firstName: 'O',
      protectFromByeInDebut: false,
    })
    expect(optOut.protectFromByeInDebut).toBe(false)

    // List preserves both fields per row.
    const list = await provider.tournamentPlayers.list(tournamentId)
    const fromList = (id: number) => list.find((p) => p.id === id)
    expect(fromList(defaultAdd.id)?.protectFromByeInDebut).toBe(true)
    expect(fromList(optOut.id)?.protectFromByeInDebut).toBe(false)
    expect(fromList(defaultAdd.id)?.addedAtRound).toBe(0)
    expect(fromList(optOut.id)?.addedAtRound).toBe(0)

    // Update can flip protectFromByeInDebut.
    const flipped = await provider.tournamentPlayers.update(tournamentId, defaultAdd.id, {
      protectFromByeInDebut: false,
    })
    expect(flipped.protectFromByeInDebut).toBe(false)
  })

  it('removes multiple tournament players in batch', async () => {
    const p1 = await provider.tournamentPlayers.add(tournamentId, {
      lastName: 'A',
      firstName: 'X',
    })
    const p2 = await provider.tournamentPlayers.add(tournamentId, {
      lastName: 'B',
      firstName: 'Y',
    })
    await provider.tournamentPlayers.add(tournamentId, { lastName: 'C', firstName: 'Z' })

    await provider.tournamentPlayers.removeMany(tournamentId, [p1.id, p2.id])

    const list = await provider.tournamentPlayers.list(tournamentId)
    expect(list).toHaveLength(1)
    expect(list[0].lastName).toBe('C')
  })
})
