import type { Database } from 'sql.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { initDatabase } from '../db.ts'
import { createSchema } from '../schema.ts'
import { ClubRepository } from './clubs.ts'

describe('ClubRepository', () => {
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

  it('returns empty list when no clubs exist', () => {
    const result = clubs.list()
    expect(result).toEqual([])
  })

  it('creates a club and returns it with an id', () => {
    const created = clubs.create({ name: 'SK Rockaden' })

    expect(created.id).toEqual(expect.any(Number))
    expect(created.name).toBe('SK Rockaden')

    const all = clubs.list()
    expect(all).toHaveLength(1)
    expect(all[0].name).toBe('SK Rockaden')
  })

  it('defaults chess4Members to 20 when not provided', () => {
    const created = clubs.create({ name: 'SK Rockaden' })

    expect(created.chess4Members).toBe(20)
    expect(clubs.list()[0].chess4Members).toBe(20)
  })

  it('updates a club name and chess4 members', () => {
    const created = clubs.create({ name: 'SK Rockaden' })

    const updated = clubs.update(created.id, {
      name: 'SK Rockaden Göteborg',
      chess4Members: 12,
    })

    expect(updated.name).toBe('SK Rockaden Göteborg')
    expect(updated.chess4Members).toBe(12)

    const all = clubs.list()
    expect(all[0].name).toBe('SK Rockaden Göteborg')
  })

  it('deletes a club', () => {
    const created = clubs.create({ name: 'SK Rockaden' })

    clubs.delete(created.id)

    expect(clubs.list()).toEqual([])
  })
})
