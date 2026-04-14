import type { Database } from 'sql.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { initDatabase } from '../db.ts'
import { createSchema } from '../schema.ts'
import { GameRepository } from './games.ts'

describe('GameRepository', () => {
  let db: Database
  let games: GameRepository
  let tournamentId: number
  let whitePlayerId: number
  let blackPlayerId: number

  beforeEach(async () => {
    db = await initDatabase()
    createSchema(db)
    db.run("INSERT INTO clubs (club, chess4members) VALUES ('SK Rockaden', 0)")
    db.run(
      `INSERT INTO tournaments (tournament, tournamentgroup, pairingsystem, initialpairing, rounds, barredpairing, compensateweakplayerpp, chess4, pointspergame, ratingchoice, showelo, showgroup)
       VALUES ('Test', 'A', 'Monrad', 'Slumpad', 7, 'false', 'false', 'false', 1, 'ELO', 'true', 'true')`,
    )
    tournamentId = db.exec('SELECT last_insert_rowid()')[0].values[0][0] as number

    db.run(
      `INSERT INTO tournamentplayers (lastname, firstname, clubindex, ratingn, ratingi, ratingq, ratingb, ratingk, ratingkq, ratingkb, title, sex, federation, fideid, ssfid, birthdate, playergroup, tournamentindex, withdrawnfromround, manualtiebreak)
       VALUES ('Andersson', 'Erik', 1, 1800, 0, 0, 0, 0, 0, 0, '', NULL, '', 0, 0, NULL, '', ?, -1, 0)`,
      [tournamentId],
    )
    whitePlayerId = db.exec('SELECT last_insert_rowid()')[0].values[0][0] as number

    db.run(
      `INSERT INTO tournamentplayers (lastname, firstname, clubindex, ratingn, ratingi, ratingq, ratingb, ratingk, ratingkq, ratingkb, title, sex, federation, fideid, ssfid, birthdate, playergroup, tournamentindex, withdrawnfromround, manualtiebreak)
       VALUES ('Björk', 'Anna', 1, 1600, 0, 0, 0, 0, 0, 0, '', NULL, '', 0, 0, NULL, '', ?, -1, 0)`,
      [tournamentId],
    )
    blackPlayerId = db.exec('SELECT last_insert_rowid()')[0].values[0][0] as number

    games = new GameRepository(db)
  })

  afterEach(() => {
    db.close()
  })

  it('returns empty rounds list when no games exist', () => {
    expect(games.listRounds(tournamentId)).toEqual([])
  })

  it('retrieves a round with games and result display', () => {
    db.run(
      `INSERT INTO tournamentgames (tournament, round, boardnr, whiteplayer, blackplayer, resulttype, whitescore, blackscore, whiteplayerlotnr, blackplayerlotnr)
       VALUES (?, 1, 1, ?, ?, 1, 1.0, 0.0, 1, 2)`,
      [tournamentId, whitePlayerId, blackPlayerId],
    )

    const round = games.getRound(tournamentId, 1)
    expect(round).not.toBeNull()
    expect(round!.roundNr).toBe(1)
    expect(round!.hasAllResults).toBe(true)
    expect(round!.gameCount).toBe(1)

    const game = round!.games[0]
    expect(game.resultType).toBe('WHITE_WIN')
    expect(game.resultDisplay).toBe('1-0')
    expect(game.whitePlayer!.name).toBe('Erik Andersson')
    expect(game.blackPlayer!.name).toBe('Anna Björk')
  })

  it('sets a result on an existing game', () => {
    db.run(
      `INSERT INTO tournamentgames (tournament, round, boardnr, whiteplayer, blackplayer, resulttype, whitescore, blackscore, whiteplayerlotnr, blackplayerlotnr)
       VALUES (?, 1, 1, ?, ?, 0, 0.0, 0.0, 1, 2)`,
      [tournamentId, whitePlayerId, blackPlayerId],
    )

    const updated = games.setResult(tournamentId, 1, 1, {
      resultType: 'DRAW',
    })

    expect(updated.resultType).toBe('DRAW')
    expect(updated.whiteScore).toBe(0.5)
    expect(updated.blackScore).toBe(0.5)
    expect(updated.resultDisplay).toBe('½-½')
  })

  it('deletes multiple games in batch', () => {
    games.insertGame(tournamentId, 1, 1, whitePlayerId, blackPlayerId)
    games.insertGame(tournamentId, 1, 2, blackPlayerId, whitePlayerId)
    games.insertGame(tournamentId, 1, 3, whitePlayerId, blackPlayerId)

    games.deleteGames(tournamentId, 1, [1, 3])

    const round = games.getRound(tournamentId, 1)
    expect(round!.games).toHaveLength(1)
    expect(round!.games[0].boardNr).toBe(2)
  })

  it('chess4 tournament with pointsPerGame=4 stores 3/1 default for WHITE_WIN', () => {
    db.run(
      `INSERT INTO tournaments (tournament, tournamentgroup, pairingsystem, initialpairing, rounds, barredpairing, compensateweakplayerpp, chess4, pointspergame, ratingchoice, showelo, showgroup)
       VALUES ('Schack4an', 'A', 'Monrad', 'Slumpad', 3, 'false', 'false', 'true', 4, 'ELO', 'false', 'false')`,
    )
    const chess4TournamentId = db.exec('SELECT last_insert_rowid()')[0].values[0][0] as number

    db.run(
      `INSERT INTO tournamentplayers (lastname, firstname, clubindex, ratingn, ratingi, ratingq, ratingb, ratingk, ratingkq, ratingkb, title, sex, federation, fideid, ssfid, birthdate, playergroup, tournamentindex, withdrawnfromround, manualtiebreak)
       VALUES ('Pupil', 'Alice', 1, 1000, 0, 0, 0, 0, 0, 0, '', NULL, '', 0, 0, NULL, '', ?, -1, 0)`,
      [chess4TournamentId],
    )
    const aliceId = db.exec('SELECT last_insert_rowid()')[0].values[0][0] as number

    db.run(
      `INSERT INTO tournamentplayers (lastname, firstname, clubindex, ratingn, ratingi, ratingq, ratingb, ratingk, ratingkq, ratingkb, title, sex, federation, fideid, ssfid, birthdate, playergroup, tournamentindex, withdrawnfromround, manualtiebreak)
       VALUES ('Pupil', 'Bob', 1, 900, 0, 0, 0, 0, 0, 0, '', NULL, '', 0, 0, NULL, '', ?, -1, 0)`,
      [chess4TournamentId],
    )
    const bobId = db.exec('SELECT last_insert_rowid()')[0].values[0][0] as number

    games.insertGame(chess4TournamentId, 1, 1, aliceId, bobId)

    const whiteWin = games.setResult(chess4TournamentId, 1, 1, { resultType: 'WHITE_WIN' })
    expect(whiteWin.whiteScore).toBe(3)
    expect(whiteWin.blackScore).toBe(1)
    expect(whiteWin.resultDisplay).toBe('3-1')

    const draw = games.setResult(chess4TournamentId, 1, 1, { resultType: 'DRAW' })
    expect(draw.whiteScore).toBe(2)
    expect(draw.blackScore).toBe(2)
    expect(draw.resultDisplay).toBe('2-2')

    const blackWin = games.setResult(chess4TournamentId, 1, 1, { resultType: 'BLACK_WIN' })
    expect(blackWin.whiteScore).toBe(1)
    expect(blackWin.blackScore).toBe(3)
    expect(blackWin.resultDisplay).toBe('1-3')
  })

  it('non-chess4 pointsPerGame=2 (Skollags-DM) stores 2-0/1-1/0-2 defaults', () => {
    db.run(
      `INSERT INTO tournaments (tournament, tournamentgroup, pairingsystem, initialpairing, rounds, barredpairing, compensateweakplayerpp, chess4, pointspergame, ratingchoice, showelo, showgroup)
       VALUES ('Skollags-DM', 'A', 'Monrad', 'Slumpad', 5, 'false', 'false', 'false', 2, 'ELO', 'true', 'false')`,
    )
    const skollagsId = db.exec('SELECT last_insert_rowid()')[0].values[0][0] as number

    db.run(
      `INSERT INTO tournamentplayers (lastname, firstname, clubindex, ratingn, ratingi, ratingq, ratingb, ratingk, ratingkq, ratingkb, title, sex, federation, fideid, ssfid, birthdate, playergroup, tournamentindex, withdrawnfromround, manualtiebreak)
       VALUES ('Elev', 'Cecilia', 1, 1200, 0, 0, 0, 0, 0, 0, '', NULL, '', 0, 0, NULL, '', ?, -1, 0)`,
      [skollagsId],
    )
    const ceciliaId = db.exec('SELECT last_insert_rowid()')[0].values[0][0] as number

    db.run(
      `INSERT INTO tournamentplayers (lastname, firstname, clubindex, ratingn, ratingi, ratingq, ratingb, ratingk, ratingkq, ratingkb, title, sex, federation, fideid, ssfid, birthdate, playergroup, tournamentindex, withdrawnfromround, manualtiebreak)
       VALUES ('Elev', 'David', 1, 1100, 0, 0, 0, 0, 0, 0, '', NULL, '', 0, 0, NULL, '', ?, -1, 0)`,
      [skollagsId],
    )
    const davidId = db.exec('SELECT last_insert_rowid()')[0].values[0][0] as number

    games.insertGame(skollagsId, 1, 1, ceciliaId, davidId)

    const whiteWin = games.setResult(skollagsId, 1, 1, { resultType: 'WHITE_WIN' })
    expect(whiteWin.whiteScore).toBe(2)
    expect(whiteWin.blackScore).toBe(0)
    expect(whiteWin.resultDisplay).toBe('2-0')

    const draw = games.setResult(skollagsId, 1, 1, { resultType: 'DRAW' })
    expect(draw.whiteScore).toBe(1)
    expect(draw.blackScore).toBe(1)
    expect(draw.resultDisplay).toBe('1-1')

    const blackWin = games.setResult(skollagsId, 1, 1, { resultType: 'BLACK_WIN' })
    expect(blackWin.whiteScore).toBe(0)
    expect(blackWin.blackScore).toBe(2)
    expect(blackWin.resultDisplay).toBe('0-2')
  })
})
