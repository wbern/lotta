import type { Database } from 'sql.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { initDatabase } from '../db.ts'
import { createSchema } from '../schema.ts'
import { TournamentPlayerRepository } from './tournament-players.ts'

describe('TournamentPlayerRepository', () => {
  let db: Database
  let tournamentPlayers: TournamentPlayerRepository
  let tournamentId: number

  beforeEach(async () => {
    db = await initDatabase()
    createSchema(db)
    db.run("INSERT INTO clubs (club, chess4members) VALUES ('SK Rockaden', 0)")
    db.run(
      `INSERT INTO tournaments (tournament, tournamentgroup, pairingsystem, initialpairing, rounds, barredpairing, compensateweakplayerpp, chess4, pointspergame, ratingchoice, showelo, showgroup)
       VALUES ('Test', 'A', 'Monrad', 'Slumpad', 7, 'false', 'false', 'false', 1, 'ELO', 'true', 'true')`,
    )
    const idResult = db.exec('SELECT last_insert_rowid()')
    tournamentId = idResult[0].values[0][0] as number
    tournamentPlayers = new TournamentPlayerRepository(db)
  })

  afterEach(() => {
    db.close()
  })

  it('returns empty list when no players exist', () => {
    expect(tournamentPlayers.list(tournamentId)).toEqual([])
  })

  it('adds a player to a tournament and lists it', () => {
    const added = tournamentPlayers.add(tournamentId, {
      lastName: 'Andersson',
      firstName: 'Erik',
      clubIndex: 1,
      ratingN: 1800,
    })

    expect(added.id).toEqual(expect.any(Number))
    expect(added.lastName).toBe('Andersson')
    expect(added.club).toBe('SK Rockaden')
    expect(added.ratingN).toBe(1800)
    expect(added.withdrawnFromRound).toBe(-1)

    const list = tournamentPlayers.list(tournamentId)
    expect(list).toHaveLength(1)
    expect(list[0].lastName).toBe('Andersson')
  })

  it('adds multiple players to a tournament in batch', () => {
    const results = tournamentPlayers.addMany(tournamentId, [
      { lastName: 'Andersson', firstName: 'Erik', clubIndex: 1, ratingN: 1800 },
      { lastName: 'Bergström', firstName: 'Anna', clubIndex: 1, ratingN: 1600 },
    ])

    expect(results).toHaveLength(2)
    expect(results[0].lastName).toBe('Andersson')
    expect(results[1].lastName).toBe('Bergström')

    const list = tournamentPlayers.list(tournamentId)
    expect(list).toHaveLength(2)
  })

  it('removes multiple players from a tournament in batch', () => {
    const p1 = tournamentPlayers.add(tournamentId, { lastName: 'Andersson', firstName: 'Erik' })
    const p2 = tournamentPlayers.add(tournamentId, { lastName: 'Bergström', firstName: 'Anna' })
    tournamentPlayers.add(tournamentId, { lastName: 'Carlsson', firstName: 'Sven' })

    tournamentPlayers.removeMany([p1.id, p2.id])

    const list = tournamentPlayers.list(tournamentId)
    expect(list).toHaveLength(1)
    expect(list[0].lastName).toBe('Carlsson')
  })
})
