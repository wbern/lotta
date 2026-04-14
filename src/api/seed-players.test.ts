import type { Database } from 'sql.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { initDatabase } from '../db/db'
import { AvailablePlayerRepository } from '../db/repositories/available-players'
import { ClubRepository } from '../db/repositories/clubs'
import { createSchema } from '../db/schema'
import { generateClubNames, generateFakePlayers, seedFakeClubs } from './seed-players'

describe('generateClubNames', () => {
  it('generates the requested number of unique club names', () => {
    const names = generateClubNames(5)

    expect(names).toHaveLength(5)
    expect(new Set(names).size).toBe(5)
  })

  it('generates names with at least two words', () => {
    const names = generateClubNames(3)

    for (const name of names) {
      const words = name.split(' ')
      expect(words.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('caps output at the maximum number of unique combinations', () => {
    const names = generateClubNames(9999)

    expect(names.length).toBeLessThanOrEqual(6 * 16 * 20)
    expect(new Set(names).size).toBe(names.length)
  })
})

describe('seedFakeClubs', () => {
  let db: Database
  let clubs: ClubRepository

  beforeEach(async () => {
    db = await initDatabase()
    createSchema(db)
    clubs = new ClubRepository(db)
  })

  afterEach(() => {
    db.close()
  })

  it('creates the requested number of clubs in the database', () => {
    const created = seedFakeClubs(4, clubs)

    expect(created).toHaveLength(4)
    expect(clubs.list()).toHaveLength(4)
    for (const club of created) {
      expect(club.id).toBeGreaterThan(0)
      expect(club.name.length).toBeGreaterThan(0)
    }
  })
})

describe('generateFakePlayers', () => {
  let db: Database
  let clubs: ClubRepository
  let players: AvailablePlayerRepository

  beforeEach(async () => {
    db = await initDatabase()
    createSchema(db)
    clubs = new ClubRepository(db)
    players = new AvailablePlayerRepository(db)
  })

  afterEach(() => {
    db.close()
  })

  it('distributes players evenly across provided club IDs', () => {
    const club1 = clubs.create({ name: 'SK Rockaden' })
    const club2 = clubs.create({ name: 'SS Tornet' })
    const club3 = clubs.create({ name: 'SF Gambit' })
    const clubIds = [club1.id, club2.id, club3.id]

    const created = generateFakePlayers(9, clubIds, players)

    expect(created).toHaveLength(9)
    const byClub = new Map<number, number>()
    for (const p of created) {
      byClub.set(p.clubIndex, (byClub.get(p.clubIndex) ?? 0) + 1)
    }
    expect(byClub.get(club1.id)).toBe(3)
    expect(byClub.get(club2.id)).toBe(3)
    expect(byClub.get(club3.id)).toBe(3)
  })

  it('distributes remainder players across clubs when count is not divisible', () => {
    const club1 = clubs.create({ name: 'SK Rockaden' })
    const club2 = clubs.create({ name: 'SS Tornet' })
    const clubIds = [club1.id, club2.id]

    const created = generateFakePlayers(7, clubIds, players)

    expect(created).toHaveLength(7)
    const byClub = new Map<number, number>()
    for (const p of created) {
      byClub.set(p.clubIndex, (byClub.get(p.clubIndex) ?? 0) + 1)
    }
    expect(byClub.get(club1.id)).toBe(4)
    expect(byClub.get(club2.id)).toBe(3)
  })

  it('creates players with clubIndex 0 when no clubs provided', () => {
    const created = generateFakePlayers(3, [], players)

    expect(created).toHaveLength(3)
    for (const p of created) {
      expect(p.clubIndex).toBe(0)
    }
  })
})
