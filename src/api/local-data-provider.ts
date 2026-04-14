import { DatabaseService } from '../db/database-service'
import { deleteDatabase } from '../db/persistence'
import type { DataProvider, DataProviderSetup } from './data-provider'
import { setResult } from './results'
import { getRound, listRounds, pairNextRound, unpairLastRound } from './rounds'
import { setDatabaseService } from './service-provider'
import { getStandings } from './standings'
import {
  addTournamentPlayer,
  addTournamentPlayers,
  listTournamentPlayers,
  removeTournamentPlayer,
  removeTournamentPlayers,
  updateTournamentPlayer,
} from './tournament-players'
import { createTournament, getTournament, listTournaments } from './tournaments'

export function getLocalProvider(): DataProvider {
  return {
    tournaments: {
      list: () => listTournaments(),
      get: (id) => getTournament(id),
      create: (req) => createTournament(req),
    },
    tournamentPlayers: {
      list: (tid) => listTournamentPlayers(tid),
      add: (tid, dto) => addTournamentPlayer(tid, dto),
      addMany: (tid, dtos) => addTournamentPlayers(tid, dtos),
      update: (tid, pid, dto) => updateTournamentPlayer(tid, pid, dto),
      remove: (tid, pid) => removeTournamentPlayer(tid, pid),
      removeMany: (tid, pids) => removeTournamentPlayers(tid, pids),
    },
    rounds: {
      list: (tid) => listRounds(tid),
      get: (tid, roundNr) => getRound(tid, roundNr),
      pairNext: (tid) => pairNextRound(tid),
      unpairLast: (tid) => unpairLastRound(tid),
    },
    results: {
      set: (tid, roundNr, boardNr, req) => setResult(tid, roundNr, boardNr, req),
    },
    standings: {
      get: (tid, round) => getStandings(tid, round),
    },
  }
}

export async function createLocalProvider(): Promise<DataProviderSetup> {
  const service = await DatabaseService.create()
  setDatabaseService(service)

  return {
    provider: getLocalProvider(),
    teardown: async () => {
      service.close()
      await deleteDatabase()
    },
  }
}
