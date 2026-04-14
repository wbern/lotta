import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DatabaseService } from '../db/database-service.ts'
import { deleteDatabase } from '../db/persistence.ts'
import type { DerbyExport, MigrationResult } from './migration.ts'
import { importDerbyJson } from './migration.ts'
import { getDatabaseService, setDatabaseService } from './service-provider.ts'

describe('Derby migration', () => {
  beforeEach(async () => {
    const service = await DatabaseService.create()
    setDatabaseService(service)
  })

  afterEach(async () => {
    getDatabaseService().close()
    await deleteDatabase()
  })

  it('imports clubs from Derby JSON', async () => {
    const data: DerbyExport = {
      clubs: [
        { index: 1, club: 'SK Rockaden', chess4members: 5 },
        { index: 2, club: 'Lunds ASK', chess4members: 0 },
      ],
      availablePlayers: [],
      tournaments: [],
      tournamentPlayers: [],
      tournamentGames: [],
      tournamentRoundDates: [],
      tournamentTiebreaks: [],
      settings: [],
      stringSettings: [],
    }

    const result: MigrationResult = await importDerbyJson(data)
    expect(result.clubs).toBe(2)

    const db = getDatabaseService()
    const clubs = db.clubs.list()
    expect(clubs).toHaveLength(2)
    expect(clubs[0].name).toBe('Lunds ASK')
    expect(clubs[1].name).toBe('SK Rockaden')
  })

  it('imports available players with club references', async () => {
    const data: DerbyExport = {
      clubs: [{ index: 10, club: 'SK Rockaden', chess4members: 3 }],
      availablePlayers: [
        {
          index: 1,
          lastname: 'Karlsson',
          firstname: 'Magnus',
          clubindex: 10,
          ratingn: 1800,
          ratingi: 0,
          ratingq: 0,
          ratingb: 0,
          ratingk: 0,
          ratingkq: 0,
          ratingkb: 0,
          ssfid: 12345,
          title: '',
          sex: 'M',
          federation: 'SWE',
          fideid: 0,
          birthdate: '1990-01-01',
          playergroup: '',
        },
      ],
      tournaments: [],
      tournamentPlayers: [],
      tournamentGames: [],
      tournamentRoundDates: [],
      tournamentTiebreaks: [],
      settings: [],
      stringSettings: [],
    }

    const result = await importDerbyJson(data)
    expect(result.availablePlayers).toBe(1)

    const db = getDatabaseService()
    const players = db.availablePlayers.list()
    expect(players).toHaveLength(1)
    expect(players[0].lastName).toBe('Karlsson')
    expect(players[0].firstName).toBe('Magnus')
    expect(players[0].ratingN).toBe(1800)
  })

  it('imports tournaments with all fields', async () => {
    const data: DerbyExport = {
      clubs: [],
      availablePlayers: [],
      tournaments: [
        {
          index: 1,
          tournament: 'Sommar-KM 2024',
          tournamentgroup: 'A',
          pairingsystem: 'Monrad',
          initialpairing: 'Lottning',
          rounds: 7,
          barredpairing: 'Ja',
          compensateweakplayerpp: 'Nej',
          chess4: 'Nej',
          pointspergame: 1,
          ratingchoice: 'National',
          showlask: 'Nej',
          showelo: 'Ja',
          showgroup: 'Nej',
          city: 'Lund',
          startdate: '2024-06-01',
          enddate: '2024-08-31',
          chiefarbiter: 'John Doe',
          deputyarbiter: '',
          timecontrol: '90+30',
          federation: 'SWE',
          resultspage: null,
          standingspage: null,
          playerlistpage: null,
          roundforroundpage: null,
          clubstandingspage: null,
        },
      ],
      tournamentPlayers: [],
      tournamentGames: [],
      tournamentRoundDates: [],
      tournamentTiebreaks: [],
      settings: [],
      stringSettings: [],
    }

    const result = await importDerbyJson(data)
    expect(result.tournaments).toBe(1)

    const db = getDatabaseService()
    const tournaments = db.tournaments.list()
    expect(tournaments).toHaveLength(1)
    expect(tournaments[0].name).toBe('Sommar-KM 2024')
  })

  it('imports tournament players and games with remapped IDs', async () => {
    const data: DerbyExport = {
      clubs: [{ index: 100, club: 'Testklubben', chess4members: 0 }],
      availablePlayers: [],
      tournaments: [
        {
          index: 50,
          tournament: 'Test',
          tournamentgroup: '',
          pairingsystem: 'Monrad',
          initialpairing: 'Lottning',
          rounds: 5,
          barredpairing: 'Nej',
          compensateweakplayerpp: 'Nej',
          chess4: 'Nej',
          pointspergame: 1,
          ratingchoice: 'National',
          showlask: 'Nej',
          showelo: 'Ja',
          showgroup: 'Nej',
          city: '',
          startdate: '',
          enddate: '',
          chiefarbiter: '',
          deputyarbiter: '',
          timecontrol: '',
          federation: '',
          resultspage: null,
          standingspage: null,
          playerlistpage: null,
          roundforroundpage: null,
          clubstandingspage: null,
        },
      ],
      tournamentPlayers: [
        {
          index: 200,
          lastname: 'Svensson',
          firstname: 'Anna',
          clubindex: 100,
          ratingn: 1500,
          ratingi: 0,
          ratingq: 0,
          ratingb: 0,
          ratingk: 0,
          ratingkq: 0,
          ratingkb: 0,
          ssfid: 0,
          title: '',
          sex: 'F',
          federation: '',
          fideid: 0,
          birthdate: '',
          playergroup: '',
          tournamentindex: 50,
          withdrawnfromround: -1,
          manualtiebreak: 0,
        },
        {
          index: 201,
          lastname: 'Johansson',
          firstname: 'Erik',
          clubindex: 100,
          ratingn: 1600,
          ratingi: 0,
          ratingq: 0,
          ratingb: 0,
          ratingk: 0,
          ratingkq: 0,
          ratingkb: 0,
          ssfid: 0,
          title: '',
          sex: 'M',
          federation: '',
          fideid: 0,
          birthdate: '',
          playergroup: '',
          tournamentindex: 50,
          withdrawnfromround: -1,
          manualtiebreak: 0,
        },
      ],
      tournamentGames: [
        {
          tournament: 50,
          round: 1,
          boardnr: 1,
          whiteplayer: 200,
          blackplayer: 201,
          resulttype: 1,
          whitescore: 1,
          blackscore: 0,
          whiteplayerlotnr: 1,
          blackplayerlotnr: 2,
        },
      ],
      tournamentRoundDates: [],
      tournamentTiebreaks: [{ index: 1, tiebreak: 'Buchholz', tournamentindex: 50 }],
      settings: [],
      stringSettings: [],
    }

    const result = await importDerbyJson(data)
    expect(result.tournaments).toBe(1)
    expect(result.tournamentPlayers).toBe(2)
    expect(result.games).toBe(1)
    expect(result.tiebreaks).toBe(1)

    const db = getDatabaseService()
    const rounds = db.games.listRounds(result.tournamentIdMap[50])
    expect(rounds).toHaveLength(1)
    const roundData = db.games.getRound(result.tournamentIdMap[50], 1)
    expect(roundData).not.toBeNull()
    expect(roundData!.games).toHaveLength(1)
    expect(roundData!.games[0].whitePlayer).not.toBeNull()
    expect(roundData!.games[0].blackPlayer).not.toBeNull()
  })

  it('imports settings', async () => {
    const data: DerbyExport = {
      clubs: [],
      availablePlayers: [],
      tournaments: [],
      tournamentPlayers: [],
      tournamentGames: [],
      tournamentRoundDates: [],
      tournamentTiebreaks: [],
      settings: [
        { setting: 'maxPointsImmediately', value: 1 },
        { setting: 'nrOfRows', value: 25 },
      ],
      stringSettings: [{ setting: 'playerPresentation', value: 'Förnamn Efternamn' }],
    }

    const result = await importDerbyJson(data)
    expect(result.settings).toBe(3)

    const db = getDatabaseService()
    const settings = db.settings.get()
    expect(settings.maxPointsImmediately).toBe(true)
    expect(settings.nrOfRows).toBe(25)
    expect(settings.playerPresentation).toBe('Förnamn Efternamn')
  })

  it('clears existing data before import', async () => {
    // Add some data first
    getDatabaseService().clubs.create({ name: 'Existing Club' })
    await getDatabaseService().save()

    const data: DerbyExport = {
      clubs: [{ index: 1, club: 'New Club', chess4members: 0 }],
      availablePlayers: [],
      tournaments: [],
      tournamentPlayers: [],
      tournamentGames: [],
      tournamentRoundDates: [],
      tournamentTiebreaks: [],
      settings: [],
      stringSettings: [],
    }

    await importDerbyJson(data)
    const db = getDatabaseService()
    const clubs = db.clubs.list()
    expect(clubs).toHaveLength(1)
    expect(clubs[0].name).toBe('New Club')
  })
})
