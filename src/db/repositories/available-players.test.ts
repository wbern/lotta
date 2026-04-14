import type { Database } from 'sql.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { initDatabase } from '../db.ts'
import { createSchema } from '../schema.ts'
import { AvailablePlayerRepository } from './available-players.ts'

describe('AvailablePlayerRepository', () => {
  let db: Database
  let players: AvailablePlayerRepository

  beforeEach(async () => {
    db = await initDatabase()
    createSchema(db)
    db.run("INSERT INTO clubs (club, chess4members) VALUES ('SK Rockaden', 0)")
    players = new AvailablePlayerRepository(db)
  })

  afterEach(() => {
    db.close()
  })

  it('returns empty list when no players exist', () => {
    expect(players.list()).toEqual([])
  })

  it('creates a player and lists it', () => {
    const created = players.create({
      lastName: 'Carlsen',
      firstName: 'Magnus',
      clubIndex: 1,
      ratingN: 2850,
    })

    expect(created.id).toEqual(expect.any(Number))
    expect(created.lastName).toBe('Carlsen')
    expect(created.firstName).toBe('Magnus')
    expect(created.club).toBe('SK Rockaden')
    expect(created.clubIndex).toBe(1)
    expect(created.ratingN).toBe(2850)

    const list = players.list()
    expect(list).toHaveLength(1)
    expect(list[0].lastName).toBe('Carlsen')
    expect(list[0].club).toBe('SK Rockaden')
  })

  it('updates a player', () => {
    const created = players.create({
      lastName: 'Carlsen',
      firstName: 'Magnus',
      clubIndex: 1,
      ratingN: 2850,
    })

    const updated = players.update(created.id, {
      ratingN: 2860,
      firstName: 'M.',
    })

    expect(updated.ratingN).toBe(2860)
    expect(updated.firstName).toBe('M.')
    expect(updated.lastName).toBe('Carlsen')
  })

  it('deletes multiple players in batch', () => {
    const p1 = players.create({ lastName: 'A', firstName: 'X' })
    const p2 = players.create({ lastName: 'B', firstName: 'Y' })
    players.create({ lastName: 'C', firstName: 'Z' })

    players.deleteMany([p1.id, p2.id])

    const list = players.list()
    expect(list).toHaveLength(1)
    expect(list[0].lastName).toBe('C')
  })
})
