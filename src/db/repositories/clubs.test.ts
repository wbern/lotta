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

  describe('delete when the club is in use', () => {
    const IN_USE = 'Klubben används av spelare och kan inte tas bort.'

    function insertTournament(): number {
      db.run(
        `INSERT INTO tournaments (tournament, tournamentgroup, pairingsystem, initialpairing, rounds, barredpairing, compensateweakplayerpp, chess4, pointspergame, ratingchoice, showelo, showgroup)
         VALUES ('Test', 'A', 'Monrad', 'Slumpad', 7, 'false', 'false', 'false', 1, 'ELO', 'true', 'true')`,
      )
      return db.exec('SELECT last_insert_rowid()')[0].values[0][0] as number
    }

    it('given a club with a tournament player, when it is deleted, then it throws a Swedish message and the club remains', () => {
      const club = clubs.create({ name: 'SK Rockaden' })
      const tid = insertTournament()
      db.run(
        'INSERT INTO tournamentplayers (lastname, firstname, clubindex, tournamentindex) VALUES (?, ?, ?, ?)',
        ['Andersson', 'Erik', club.id, tid],
      )

      expect(() => clubs.delete(club.id)).toThrow(IN_USE)
      expect(clubs.list().map((c) => c.id)).toEqual([club.id])
    })

    it('given a club with a pool player, when it is deleted, then it throws a Swedish message and the club remains', () => {
      const club = clubs.create({ name: 'SK Rockaden' })
      db.run('INSERT INTO availableplayers (lastname, firstname, clubindex) VALUES (?, ?, ?)', [
        'Berg',
        'Anna',
        club.id,
      ])

      expect(() => clubs.delete(club.id)).toThrow(IN_USE)
      expect(clubs.list().map((c) => c.id)).toEqual([club.id])
    })

    it('given a club without members while another club has players, when it is deleted, then only that club is removed', () => {
      const used = clubs.create({ name: 'SK Rockaden' })
      const empty = clubs.create({ name: 'Tom Klubb' })
      db.run('INSERT INTO availableplayers (lastname, firstname, clubindex) VALUES (?, ?, ?)', [
        'Berg',
        'Anna',
        used.id,
      ])

      clubs.delete(empty.id)

      expect(clubs.list().map((c) => c.id)).toEqual([used.id])
    })
  })
})
