import { getUndoManager } from '../db/undo-provider'
import * as clubs from './clubs'
import * as players from './players'
import * as publish from './publish'
import * as results from './results'
import * as rounds from './rounds'
import * as settings from './settings'
import * as standings from './standings'
import * as tournamentPlayers from './tournament-players'
import * as tournaments from './tournaments'
import * as undoApi from './undo'

export const lottaApi = {
  // Clubs
  listClubs: clubs.listClubs,
  addClub: clubs.addClub,
  renameClub: clubs.renameClub,
  deleteClub: clubs.deleteClub,

  // Tournaments
  listTournaments: tournaments.listTournaments,
  getTournament: tournaments.getTournament,
  createTournament: tournaments.createTournament,
  updateTournament: tournaments.updateTournament,
  deleteTournament: tournaments.deleteTournament,
  exportTournamentPlayers: tournaments.exportTournamentPlayers,
  exportLiveChess: tournaments.exportLiveChess,
  importPlayers: tournaments.importPlayers,

  // Tournament Players
  listTournamentPlayers: tournamentPlayers.listTournamentPlayers,
  addTournamentPlayer: tournamentPlayers.addTournamentPlayer,
  updateTournamentPlayer: tournamentPlayers.updateTournamentPlayer,
  removeTournamentPlayer: tournamentPlayers.removeTournamentPlayer,

  // Available Players (pool)
  listPoolPlayers: players.listPoolPlayers,
  addPoolPlayer: players.addPoolPlayer,
  updatePoolPlayer: players.updatePoolPlayer,
  deletePoolPlayer: players.deletePoolPlayer,

  // Rounds
  listRounds: rounds.listRounds,
  getRound: rounds.getRound,
  pairNextRound: rounds.pairNextRound,
  unpairLastRound: rounds.unpairLastRound,

  // Results
  setResult: results.setResult,
  deleteGame: results.deleteGame,
  addGame: results.addGame,
  updateGame: results.updateGame,

  // Standings
  getStandings: standings.getStandings,
  getClubStandings: standings.getClubStandings,
  getChess4Standings: standings.getChess4Standings,

  // Settings
  getSettings: settings.getSettings,
  updateSettings: settings.updateSettings,

  // Publish
  publishHtml: publish.publishHtml,

  // Undo/Redo
  undo: undoApi.undo,
  redo: undoApi.redo,
  restoreToPoint: undoApi.restoreToPoint,
  getUndoState: () => getUndoManager().getState(),
  getTimeline: () => getUndoManager().getTimeline(),
  getCurrentSnapshotIndex: () => getUndoManager().getCurrentSnapshotIndex(),
  clearUndo: () => getUndoManager().clear(),
  captureInitialUndoState: () => getUndoManager().captureInitialState(),
}
