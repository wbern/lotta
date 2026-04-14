import type { Database } from 'sql.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { initDatabase } from '../db.ts'
import { createSchema } from '../schema.ts'
import { TournamentRepository } from './tournaments.ts'

describe('TournamentRepository', () => {
  let db: Database
  let tournaments: TournamentRepository

  beforeEach(async () => {
    db = await initDatabase()
    createSchema(db)
    tournaments = new TournamentRepository(db)
  })

  afterEach(() => {
    db.close()
  })

  it('returns empty list when no tournaments exist', () => {
    expect(tournaments.list()).toEqual([])
  })

  it('creates a tournament and lists it', () => {
    const created = tournaments.create({
      name: 'Höstturneringen',
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

    expect(created.id).toEqual(expect.any(Number))
    expect(created.name).toBe('Höstturneringen')
    expect(created.pairingSystem).toBe('Monrad')

    const list = tournaments.list()
    expect(list).toHaveLength(1)
    expect(list[0].name).toBe('Höstturneringen')
    expect(list[0].group).toBe('A')
    expect(list[0].pairingSystem).toBe('Monrad')
    expect(list[0].nrOfRounds).toBe(7)
    expect(list[0].roundsPlayed).toBe(0)
    expect(list[0].playerCount).toBe(0)
    expect(list[0].finished).toBe(false)
  })

  it('updates a tournament', () => {
    const created = tournaments.create({
      name: 'Höstturneringen',
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

    const updated = tournaments.update(created.id, {
      name: 'Vårturneringen',
      group: 'B',
      pairingSystem: 'Monrad',
      initialPairing: 'Slumpad',
      nrOfRounds: 9,
      barredPairing: false,
      compensateWeakPlayerPP: false,
      pointsPerGame: 1,
      chess4: false,
      ratingChoice: 'ELO',
      showELO: true,
      showGroup: true,
      city: 'Göteborg',
    })

    expect(updated.name).toBe('Vårturneringen')
    expect(updated.group).toBe('B')
    expect(updated.nrOfRounds).toBe(9)
    expect(updated.city).toBe('Göteborg')
  })

  it('deletes a tournament and its related data', () => {
    const created = tournaments.create({
      name: 'Höstturneringen',
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
      selectedTiebreaks: ['Buchholz', 'Berger'],
    })

    tournaments.delete(created.id)

    expect(tournaments.list()).toEqual([])
    expect(tournaments.get(created.id)).toBeNull()
  })
})
