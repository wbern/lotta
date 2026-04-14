import { DatabaseService } from '../db/database-service'
import { deleteDatabase } from '../db/persistence'
import type { ResultType } from '../types/api'
import { getDatabaseService, setDatabaseService } from './service-provider'

export interface DerbyClub {
  index: number
  club: string
  chess4members: number
}

export interface DerbyPlayer {
  index: number
  lastname: string
  firstname: string
  clubindex: number
  ratingn: number
  ratingi: number
  ratingq: number
  ratingb: number
  ratingk: number
  ratingkq: number
  ratingkb: number
  ssfid: number
  title: string
  sex: string
  federation: string
  fideid: number
  birthdate: string
  playergroup: string
}

export interface DerbyTournament {
  index: number
  tournament: string
  tournamentgroup: string
  pairingsystem: string
  initialpairing: string
  rounds: number
  barredpairing: string
  compensateweakplayerpp: string
  chess4: string
  pointspergame: number
  ratingchoice: string
  showlask: string
  showelo: string
  showgroup: string
  city: string
  startdate: string
  enddate: string
  chiefarbiter: string
  deputyarbiter: string
  timecontrol: string
  federation: string
  resultspage: string | null
  standingspage: string | null
  playerlistpage: string | null
  roundforroundpage: string | null
  clubstandingspage: string | null
}

export interface DerbyTournamentPlayer extends DerbyPlayer {
  tournamentindex: number
  withdrawnfromround: number
  manualtiebreak: number
}

export interface DerbyGame {
  tournament: number
  round: number
  boardnr: number
  whiteplayer: number | null
  blackplayer: number | null
  resulttype: number
  whitescore: number
  blackscore: number
  whiteplayerlotnr: number
  blackplayerlotnr: number
}

export interface DerbyRoundDate {
  tournament: number
  round: number
  rounddate: string | null
}

export interface DerbyTiebreak {
  index: number
  tiebreak: string
  tournamentindex: number
}

export interface DerbySetting {
  setting: string
  value: number
}

export interface DerbyStringSetting {
  setting: string
  value: string
}

export interface DerbyExport {
  clubs: DerbyClub[]
  availablePlayers: DerbyPlayer[]
  tournaments: DerbyTournament[]
  tournamentPlayers: DerbyTournamentPlayer[]
  tournamentGames: DerbyGame[]
  tournamentRoundDates: DerbyRoundDate[]
  tournamentTiebreaks: DerbyTiebreak[]
  settings: DerbySetting[]
  stringSettings: DerbyStringSetting[]
}

export interface MigrationResult {
  clubs: number
  availablePlayers: number
  tournaments: number
  tournamentPlayers: number
  games: number
  tiebreaks: number
  settings: number
  tournamentIdMap: Record<number, number>
}

function derbyBool(val: string): boolean {
  return val === 'Ja' || val === 'true' || val === '1'
}

function resultTypeFromInt(value: number): ResultType {
  const map: Record<number, ResultType> = {
    0: 'NO_RESULT',
    1: 'WHITE_WIN',
    2: 'DRAW',
    3: 'BLACK_WIN',
    4: 'WHITE_WIN_WO',
    5: 'BLACK_WIN_WO',
    6: 'DOUBLE_WO',
    7: 'POSTPONED',
    8: 'CANCELLED',
  }
  return map[value] ?? 'NO_RESULT'
}

export async function importDerbyJson(data: DerbyExport): Promise<MigrationResult> {
  // Create a fresh database (discards existing data)
  const oldService = getDatabaseService()
  oldService.close()
  await deleteDatabase()
  const newService = await DatabaseService.create()
  setDatabaseService(newService)

  const db = newService

  // ID remapping tables
  const clubIdMap: Record<number, number> = {}
  const tournamentIdMap: Record<number, number> = {}
  const playerIdMap: Record<number, number> = {}

  // 1. Import clubs
  for (const c of data.clubs) {
    const created = db.clubs.create({ name: c.club, chess4Members: c.chess4members })
    clubIdMap[c.index] = created.id
  }

  // 2. Import available players
  for (const p of data.availablePlayers) {
    const created = db.availablePlayers.create({
      lastName: p.lastname,
      firstName: p.firstname,
      clubIndex: p.clubindex ? (clubIdMap[p.clubindex] ?? 0) : 0,
      ratingN: p.ratingn,
      ratingI: p.ratingi,
      ratingQ: p.ratingq,
      ratingB: p.ratingb,
      ratingK: p.ratingk,
      ratingKQ: p.ratingkq,
      ratingKB: p.ratingkb,
      ssfId: p.ssfid,
      title: p.title,
      sex: p.sex,
      federation: p.federation,
      fideId: p.fideid,
      birthdate: p.birthdate,
      playerGroup: p.playergroup,
    })
    playerIdMap[p.index] = created.id
  }

  // 3. Import tournaments (collect tiebreaks and round dates per tournament)
  const tiebreaksByTournament: Record<number, string[]> = {}
  for (const tb of data.tournamentTiebreaks) {
    if (!tiebreaksByTournament[tb.tournamentindex]) {
      tiebreaksByTournament[tb.tournamentindex] = []
    }
    tiebreaksByTournament[tb.tournamentindex].push(tb.tiebreak)
  }

  const roundDatesByTournament: Record<number, { round: number; date: string }[]> = {}
  for (const rd of data.tournamentRoundDates) {
    if (rd.rounddate == null) continue
    if (!roundDatesByTournament[rd.tournament]) {
      roundDatesByTournament[rd.tournament] = []
    }
    roundDatesByTournament[rd.tournament].push({ round: rd.round, date: rd.rounddate })
  }

  for (const t of data.tournaments) {
    const created = db.tournaments.create({
      name: t.tournament,
      group: t.tournamentgroup,
      pairingSystem: t.pairingsystem,
      initialPairing: t.initialpairing,
      nrOfRounds: t.rounds,
      barredPairing: derbyBool(t.barredpairing),
      compensateWeakPlayerPP: derbyBool(t.compensateweakplayerpp),
      chess4: derbyBool(t.chess4),
      pointsPerGame: t.pointspergame,
      ratingChoice: t.ratingchoice,
      showELO: derbyBool(t.showelo),
      showGroup: derbyBool(t.showgroup),
      city: t.city || undefined,
      startDate: t.startdate || undefined,
      endDate: t.enddate || undefined,
      chiefArbiter: t.chiefarbiter || undefined,
      deputyArbiter: t.deputyarbiter || undefined,
      timeControl: t.timecontrol || undefined,
      federation: t.federation || undefined,
      selectedTiebreaks: tiebreaksByTournament[t.index],
      roundDates: roundDatesByTournament[t.index],
    })
    tournamentIdMap[t.index] = created.id
  }

  // 4. Import tournament players
  for (const p of data.tournamentPlayers) {
    const tournamentId = tournamentIdMap[p.tournamentindex]
    if (tournamentId == null) continue

    const created = db.tournamentPlayers.add(tournamentId, {
      lastName: p.lastname,
      firstName: p.firstname,
      clubIndex: p.clubindex ? (clubIdMap[p.clubindex] ?? 0) : 0,
      ratingN: p.ratingn,
      ratingI: p.ratingi,
      ratingQ: p.ratingq,
      ratingB: p.ratingb,
      ratingK: p.ratingk,
      ratingKQ: p.ratingkq,
      ratingKB: p.ratingkb,
      ssfId: p.ssfid,
      title: p.title,
      sex: p.sex,
      federation: p.federation,
      fideId: p.fideid,
      birthdate: p.birthdate,
      playerGroup: p.playergroup,
      withdrawnFromRound: p.withdrawnfromround,
      manualTiebreak: p.manualtiebreak,
    })
    playerIdMap[p.index] = created.id
  }

  // 5. Import games
  for (const g of data.tournamentGames) {
    const tournamentId = tournamentIdMap[g.tournament]
    if (tournamentId == null) continue

    const whitePlayerId = g.whiteplayer != null ? (playerIdMap[g.whiteplayer] ?? null) : null
    const blackPlayerId = g.blackplayer != null ? (playerIdMap[g.blackplayer] ?? null) : null

    db.games.insertGame(tournamentId, g.round, g.boardnr, whitePlayerId, blackPlayerId)
    db.games.setResult(tournamentId, g.round, g.boardnr, {
      resultType: resultTypeFromInt(g.resulttype),
      whiteScore: g.whitescore,
      blackScore: g.blackscore,
    })
    db.games.setLotNumbers(tournamentId, g.round, g.boardnr, g.whiteplayerlotnr, g.blackplayerlotnr)
  }

  // 6. Import settings
  let settingsCount = 0
  for (const s of data.settings) {
    db.settings.setInt(s.setting, s.value)
    settingsCount++
  }
  for (const s of data.stringSettings) {
    db.settings.setString(s.setting, s.value)
    settingsCount++
  }

  await db.save()

  return {
    clubs: data.clubs.length,
    availablePlayers: data.availablePlayers.length,
    tournaments: data.tournaments.length,
    tournamentPlayers: data.tournamentPlayers.length,
    games: data.tournamentGames.length,
    tiebreaks: data.tournamentTiebreaks.length,
    settings: settingsCount,
    tournamentIdMap,
  }
}
