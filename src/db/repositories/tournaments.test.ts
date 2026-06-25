import type { Database } from 'sql.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { calculateScores } from '../../domain/scoring.ts'
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

  it('falls back to chess4-derived maxPointsForWin for rows that predate the column (ADR-0006)', () => {
    // A chess4 tournament from an older app version stored no maxpointsforwin —
    // creating one without the field leaves the column NULL, exactly like a
    // migrated legacy row.
    const created = tournaments.create({
      name: 'Gammal Schack4an',
      group: 'A',
      pairingSystem: 'Monrad',
      initialPairing: 'Slumpad',
      nrOfRounds: 7,
      barredPairing: false,
      compensateWeakPlayerPP: false,
      pointsPerGame: 4,
      chess4: true,
      ratingChoice: 'ELO',
      showELO: false,
      showGroup: false,
    })
    db.run('UPDATE tournaments SET maxpointsforwin = NULL WHERE "index" = ?', [created.id])

    const loaded = tournaments.get(created.id)
    expect(loaded).not.toBeNull()
    // Fallback: chess4 ? ppg-1 : ppg = 3, i.e. 3-2-1 scoring, unchanged.
    expect(loaded?.maxPointsForWin).toBe(3)
    expect(
      calculateScores('WHITE_WIN', loaded as { pointsPerGame: number; maxPointsForWin: number }),
    ).toEqual({ whiteScore: 3, blackScore: 1 })
    expect(
      calculateScores('DRAW', loaded as { pointsPerGame: number; maxPointsForWin: number }),
    ).toEqual({ whiteScore: 2, blackScore: 2 })

    // A standard (non-chess4) NULL row falls back to winner-takes-all.
    const std = tournaments.create({
      name: 'Gammal Standard',
      group: 'B',
      pairingSystem: 'Monrad',
      initialPairing: 'Slumpad',
      nrOfRounds: 7,
      barredPairing: false,
      compensateWeakPlayerPP: false,
      pointsPerGame: 1,
      chess4: false,
      ratingChoice: 'ELO',
      showELO: true,
      showGroup: false,
    })
    db.run('UPDATE tournaments SET maxpointsforwin = NULL WHERE "index" = ?', [std.id])
    expect(tournaments.get(std.id)?.maxPointsForWin).toBe(1)
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

  it('exposes hasRecordedResults=false for an empty tournament', () => {
    const created = tournaments.create({
      name: 'Empty',
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

    const fetched = tournaments.get(created.id)
    expect(fetched!.hasRecordedResults).toBe(false)
  })

  it('reports hasRecordedResults=true once any game has a non-NO_RESULT outcome', () => {
    const created = tournaments.create({
      name: 'Has results',
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

    // Paired round (resulttype=0 NO_RESULT) should NOT count as recorded
    db.run(
      `INSERT INTO tournamentgames (tournament, round, boardnr, whiteplayer, blackplayer, resulttype, whitescore, blackscore, whiteplayerlotnr, blackplayerlotnr)
       VALUES (?, 1, 1, NULL, NULL, 0, 0.0, 0.0, 1, 2)`,
      [created.id],
    )
    expect(tournaments.get(created.id)!.hasRecordedResults).toBe(false)

    // Record a WHITE_WIN (resulttype=1)
    db.run(
      `UPDATE tournamentgames SET resulttype = 1, whitescore = 1.0, blackscore = 0.0
       WHERE tournament = ? AND round = 1 AND boardnr = 1`,
      [created.id],
    )
    expect(tournaments.get(created.id)!.hasRecordedResults).toBe(true)
  })

  it('blocks scoring-system change once any result is recorded', () => {
    const created = tournaments.create({
      name: 'Locked',
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

    db.run(
      `INSERT INTO tournamentgames (tournament, round, boardnr, whiteplayer, blackplayer, resulttype, whitescore, blackscore, whiteplayerlotnr, blackplayerlotnr)
       VALUES (?, 1, 1, NULL, NULL, 1, 1.0, 0.0, 1, 2)`,
      [created.id],
    )

    // Changing pointsPerGame while results exist: rejected
    expect(() =>
      tournaments.update(created.id, {
        name: 'Locked',
        group: 'A',
        pairingSystem: 'Monrad',
        initialPairing: 'Slumpad',
        nrOfRounds: 7,
        barredPairing: false,
        compensateWeakPlayerPP: false,
        pointsPerGame: 4,
        chess4: true,
        ratingChoice: 'ELO',
        showELO: true,
        showGroup: true,
      }),
    ).toThrow(/poängsystem/i)

    // Non-scoring edits on the same locked tournament remain allowed
    const updated = tournaments.update(created.id, {
      name: 'Renamed',
      group: 'A',
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
    })
    expect(updated.name).toBe('Renamed')
    expect(updated.nrOfRounds).toBe(9)
  })

  it('blocks scoring-system change once round 1 is paired (seeded, no results yet)', () => {
    const created = tournaments.create({
      name: 'Locked',
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

    // Paired but no result recorded yet — `seeded` state
    db.run(
      `INSERT INTO tournamentgames (tournament, round, boardnr, whiteplayer, blackplayer, resulttype, whitescore, blackscore, whiteplayerlotnr, blackplayerlotnr)
       VALUES (?, 1, 1, NULL, NULL, 0, 0.0, 0.0, 1, 2)`,
      [created.id],
    )

    expect(() =>
      tournaments.update(created.id, {
        name: 'Locked',
        group: 'A',
        pairingSystem: 'Monrad',
        initialPairing: 'Slumpad',
        nrOfRounds: 7,
        barredPairing: false,
        compensateWeakPlayerPP: false,
        pointsPerGame: 4,
        chess4: true,
        ratingChoice: 'ELO',
        showELO: true,
        showGroup: true,
      }),
    ).toThrow(/poängsystem/i)
  })

  it('blocks pairingSystem change once round 1 is paired', () => {
    const created = tournaments.create({
      name: 'Locked',
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

    db.run(
      `INSERT INTO tournamentgames (tournament, round, boardnr, whiteplayer, blackplayer, resulttype, whitescore, blackscore, whiteplayerlotnr, blackplayerlotnr)
       VALUES (?, 1, 1, NULL, NULL, 0, 0.0, 0.0, 1, 2)`,
      [created.id],
    )

    expect(() =>
      tournaments.update(created.id, {
        name: 'Locked',
        group: 'A',
        pairingSystem: 'Berger',
        initialPairing: 'Slumpad',
        nrOfRounds: 7,
        barredPairing: false,
        compensateWeakPlayerPP: false,
        pointsPerGame: 1,
        chess4: false,
        ratingChoice: 'ELO',
        showELO: true,
        showGroup: true,
      }),
    ).toThrow(/lottningssystem/i)
  })

  it('blocks barredPairing change once round 1 is paired', () => {
    const created = tournaments.create({
      name: 'Locked',
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

    db.run(
      `INSERT INTO tournamentgames (tournament, round, boardnr, whiteplayer, blackplayer, resulttype, whitescore, blackscore, whiteplayerlotnr, blackplayerlotnr)
       VALUES (?, 1, 1, NULL, NULL, 0, 0.0, 0.0, 1, 2)`,
      [created.id],
    )

    expect(() =>
      tournaments.update(created.id, {
        name: 'Locked',
        group: 'A',
        pairingSystem: 'Monrad',
        initialPairing: 'Slumpad',
        nrOfRounds: 7,
        barredPairing: true,
        compensateWeakPlayerPP: false,
        pointsPerGame: 1,
        chess4: false,
        ratingChoice: 'ELO',
        showELO: true,
        showGroup: true,
      }),
    ).toThrow(/lottningsregler/i)
  })

  it('blocks compensateWeakPlayerPP change once round 1 is paired', () => {
    const created = tournaments.create({
      name: 'Locked',
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

    db.run(
      `INSERT INTO tournamentgames (tournament, round, boardnr, whiteplayer, blackplayer, resulttype, whitescore, blackscore, whiteplayerlotnr, blackplayerlotnr)
       VALUES (?, 1, 1, NULL, NULL, 0, 0.0, 0.0, 1, 2)`,
      [created.id],
    )

    expect(() =>
      tournaments.update(created.id, {
        name: 'Locked',
        group: 'A',
        pairingSystem: 'Monrad',
        initialPairing: 'Slumpad',
        nrOfRounds: 7,
        barredPairing: false,
        compensateWeakPlayerPP: true,
        pointsPerGame: 1,
        chess4: false,
        ratingChoice: 'ELO',
        showELO: true,
        showGroup: true,
      }),
    ).toThrow(/kompensation/i)
  })

  it('blocks ratingChoice change once round 1 is paired', () => {
    const created = tournaments.create({
      name: 'Locked',
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

    db.run(
      `INSERT INTO tournamentgames (tournament, round, boardnr, whiteplayer, blackplayer, resulttype, whitescore, blackscore, whiteplayerlotnr, blackplayerlotnr)
       VALUES (?, 1, 1, NULL, NULL, 0, 0.0, 0.0, 1, 2)`,
      [created.id],
    )

    expect(() =>
      tournaments.update(created.id, {
        name: 'Locked',
        group: 'A',
        pairingSystem: 'Monrad',
        initialPairing: 'Slumpad',
        nrOfRounds: 7,
        barredPairing: false,
        compensateWeakPlayerPP: false,
        pointsPerGame: 1,
        chess4: false,
        ratingChoice: 'Snabb-ELO',
        showELO: true,
        showGroup: true,
      }),
    ).toThrow(/rating/i)
  })

  it('blocks selectedTiebreaks change once round 1 is paired', () => {
    const created = tournaments.create({
      name: 'Locked',
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

    db.run(
      `INSERT INTO tournamentgames (tournament, round, boardnr, whiteplayer, blackplayer, resulttype, whitescore, blackscore, whiteplayerlotnr, blackplayerlotnr)
       VALUES (?, 1, 1, NULL, NULL, 0, 0.0, 0.0, 1, 2)`,
      [created.id],
    )

    expect(() =>
      tournaments.update(created.id, {
        name: 'Locked',
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
        selectedTiebreaks: ['Berger', 'Buchholz'],
      }),
    ).toThrow(/särskiljning|tiebreak/i)
  })

  it('blocks reducing nrOfRounds below roundsPlayed', () => {
    const created = tournaments.create({
      name: 'Locked',
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

    // Two rounds paired
    db.run(
      `INSERT INTO tournamentgames (tournament, round, boardnr, whiteplayer, blackplayer, resulttype, whitescore, blackscore, whiteplayerlotnr, blackplayerlotnr)
       VALUES (?, 1, 1, NULL, NULL, 0, 0.0, 0.0, 1, 2),
              (?, 2, 1, NULL, NULL, 0, 0.0, 0.0, 1, 2)`,
      [created.id, created.id],
    )

    expect(() =>
      tournaments.update(created.id, {
        name: 'Locked',
        group: 'A',
        pairingSystem: 'Monrad',
        initialPairing: 'Slumpad',
        nrOfRounds: 1,
        barredPairing: false,
        compensateWeakPlayerPP: false,
        pointsPerGame: 1,
        chess4: false,
        ratingChoice: 'ELO',
        showELO: true,
        showGroup: true,
      }),
    ).toThrow(/antal ronder/i)
  })

  it('allows increasing nrOfRounds after round 1 is paired', () => {
    const created = tournaments.create({
      name: 'Locked',
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

    db.run(
      `INSERT INTO tournamentgames (tournament, round, boardnr, whiteplayer, blackplayer, resulttype, whitescore, blackscore, whiteplayerlotnr, blackplayerlotnr)
       VALUES (?, 1, 1, NULL, NULL, 0, 0.0, 0.0, 1, 2)`,
      [created.id],
    )

    const updated = tournaments.update(created.id, {
      name: 'Locked',
      group: 'A',
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
    })
    expect(updated.nrOfRounds).toBe(9)
  })

  it('blocks initialPairing change once round 1 is paired', () => {
    const created = tournaments.create({
      name: 'Locked',
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

    db.run(
      `INSERT INTO tournamentgames (tournament, round, boardnr, whiteplayer, blackplayer, resulttype, whitescore, blackscore, whiteplayerlotnr, blackplayerlotnr)
       VALUES (?, 1, 1, NULL, NULL, 0, 0.0, 0.0, 1, 2)`,
      [created.id],
    )

    expect(() =>
      tournaments.update(created.id, {
        name: 'Locked',
        group: 'A',
        pairingSystem: 'Monrad',
        initialPairing: 'Rating',
        nrOfRounds: 7,
        barredPairing: false,
        compensateWeakPlayerPP: false,
        pointsPerGame: 1,
        chess4: false,
        ratingChoice: 'ELO',
        showELO: true,
        showGroup: true,
      }),
    ).toThrow(/startlottning/i)
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
