import { formatPlayerName, type NamePresentation } from '../db/format-name'
import type {
  Chess4StandingsPublishInput,
  ClubStandingsPublishInput,
  CrossTablePublishInput,
  CrossTableRoundCell,
  PlayerListPublishInput,
} from '../domain/html-publisher'
import {
  publishAlphabeticalPairings,
  publishChess4Standings,
  publishClubStandings,
  publishCrossTable,
  publishPairings,
  publishPlayerList,
  publishStandings,
} from '../domain/html-publisher'
import { getPlayerRating } from '../domain/ratings'
import { crossTableResultText, formatScore } from '../domain/scoring'
import { publishFilename } from '../lib/filenames'
import {
  buildAlphabeticalPairingsInput,
  buildPairingsInput,
  buildStandingsInput,
} from './publish-data'
import { getDatabaseService } from './service-provider'
import { getChess4Standings, getClubStandings, getStandings } from './standings'

function htmlBlob(html: string): Blob {
  return new Blob([html], { type: 'text/html; charset=UTF-8' })
}

/** The round a page renders: the requested one, or the latest when none is given. */
function requestedOrLatestRound(tournamentId: number, round?: number): number {
  return round ?? getDatabaseService().games.listRounds(tournamentId).length
}

function resolveRound(tournamentId: number, round?: number): number {
  const roundCount = getDatabaseService().games.listRounds(tournamentId).length
  const roundNr = round ?? roundCount
  if (roundNr < 1 || roundNr > roundCount) {
    throw new Error('No rounds available')
  }
  return roundNr
}

export async function publishPairingsHtml(tournamentId: number, round?: number): Promise<Blob> {
  const roundNr = resolveRound(tournamentId, round)
  const input = buildPairingsInput(tournamentId, roundNr)
  if (!input) throw new Error(`Tournament ${tournamentId} or round ${roundNr} not found`)
  return htmlBlob(publishPairings(input))
}

interface AlphabeticalPublishOptions {
  groupByClass?: boolean
  columns?: number
  compact?: boolean
  hideOpponentLastName?: boolean
}

async function publishAlphabeticalPairingsHtml(
  tournamentId: number,
  round: number | undefined,
  options: AlphabeticalPublishOptions,
): Promise<Blob> {
  const roundNr = resolveRound(tournamentId, round)
  const input = buildAlphabeticalPairingsInput(tournamentId, roundNr)
  if (!input) throw new Error(`Tournament ${tournamentId} or round ${roundNr} not found`)
  return htmlBlob(publishAlphabeticalPairings({ ...input, ...options }))
}

function parseAlphabeticalOptions(query: string): AlphabeticalPublishOptions {
  const params = new URLSearchParams(query)
  const options: AlphabeticalPublishOptions = {}
  const columns = params.get('columns')
  if (columns != null) {
    const n = Number(columns)
    if (Number.isFinite(n)) options.columns = n
  }
  const groupByClass = params.get('groupByClass')
  if (groupByClass != null) options.groupByClass = groupByClass === '1'
  const compact = params.get('compact')
  if (compact != null) options.compact = compact === '1'
  const hideOppLast = params.get('hideOppLast')
  if (hideOppLast != null) options.hideOpponentLastName = hideOppLast === '1'
  return options
}

export async function publishStandingsHtml(tournamentId: number, round?: number): Promise<Blob> {
  const roundNr = requestedOrLatestRound(tournamentId, round)
  if (roundNr < 1) throw new Error('No rounds available')

  const input = await buildStandingsInput(tournamentId, roundNr)
  if (!input) throw new Error(`Tournament ${tournamentId} not found`)
  return htmlBlob(publishStandings(input))
}

export async function publishPlayerListHtml(tournamentId: number): Promise<Blob> {
  const db = getDatabaseService()
  const tournament = db.tournaments.get(tournamentId)
  if (!tournament) throw new Error(`Tournament ${tournamentId} not found`)

  const settings = db.settings.get()
  const presentation: NamePresentation =
    settings.playerPresentation === 'LAST_FIRST' ? 'LAST_FIRST' : 'FIRST_LAST'

  const players = db.tournamentPlayers.list(tournamentId)

  const input: PlayerListPublishInput = {
    tournamentName: tournament.name,
    players: players.map((p) => ({
      name: formatPlayerName(p.firstName, p.lastName, presentation),
      club: p.club,
      rating: getPlayerRating(p, tournament.ratingChoice),
    })),
  }

  return htmlBlob(publishPlayerList(input))
}

export async function publishClubStandingsHtml(
  tournamentId: number,
  round?: number,
): Promise<Blob> {
  const db = getDatabaseService()
  const tournament = db.tournaments.get(tournamentId)
  if (!tournament) throw new Error(`Tournament ${tournamentId} not found`)

  const roundNr = requestedOrLatestRound(tournamentId, round)
  if (roundNr < 1) throw new Error('No rounds available')

  const standings = await getClubStandings(tournamentId, roundNr)

  const input: ClubStandingsPublishInput = {
    tournamentName: tournament.name,
    roundNr,
    standings: standings.map((s) => ({
      place: s.place,
      club: s.club,
      scoreDisplay: formatScore(s.score),
    })),
  }

  return htmlBlob(publishClubStandings(input))
}

async function publishChess4StandingsHtml(tournamentId: number, round?: number): Promise<Blob> {
  const db = getDatabaseService()
  const tournament = db.tournaments.get(tournamentId)
  if (!tournament) throw new Error(`Tournament ${tournamentId} not found`)

  const roundNr = requestedOrLatestRound(tournamentId, round)
  if (roundNr < 1) throw new Error('No rounds available')

  const standings = await getChess4Standings(tournamentId, roundNr)

  const input: Chess4StandingsPublishInput = {
    tournamentName: tournament.name,
    roundNr,
    standings: standings.map((s) => ({
      place: s.place,
      club: s.club,
      playerCount: s.playerCount,
      chess4Members: s.chess4Members,
      score: s.score,
    })),
  }

  return htmlBlob(publishChess4Standings(input))
}

export async function publishCrossTableHtml(tournamentId: number): Promise<Blob> {
  const db = getDatabaseService()
  const tournament = db.tournaments.get(tournamentId)
  if (!tournament) throw new Error(`Tournament ${tournamentId} not found`)

  const rounds = db.games.listRounds(tournamentId)
  if (rounds.length === 0) throw new Error('No rounds available')

  // Java HTMLRounds: rows in standings order after the last paired round,
  // numbered by row (unique), and opponents referenced by that row number.
  const standings = await getStandings(tournamentId, rounds.length)
  const rowByPlayerId = new Map<number, number>()
  standings.forEach((s, i) => rowByPlayerId.set(s.playerId, i + 1))

  const roundCount = Math.max(tournament.nrOfRounds, rounds.length)

  const players: CrossTablePublishInput['players'] = standings.map((s, i) => {
    const cells: (CrossTableRoundCell | null)[] = []
    for (let roundNr = 1; roundNr <= roundCount; roundNr++) {
      const round = rounds.find((r) => r.roundNr === roundNr)
      const game = round?.games.find(
        (g) => g.whitePlayer?.id === s.playerId || g.blackPlayer?.id === s.playerId,
      )
      if (!game) {
        cells.push(null)
        continue
      }
      const isWhite = game.whitePlayer?.id === s.playerId
      const opponentId = isWhite ? game.blackPlayer?.id : game.whitePlayer?.id
      const isBye = opponentId == null
      const ownScore = isWhite ? game.whiteScore : game.blackScore
      cells.push({
        opponentPlace: isBye ? null : (rowByPlayerId.get(opponentId) ?? null),
        color: isWhite ? 'v' : 's',
        result: crossTableResultText(game.resultType, isWhite ? 'white' : 'black', isBye, ownScore),
      })
    }
    return {
      place: i + 1,
      name: s.name,
      playerGroup: s.playerGroup,
      rating: s.rating,
      rounds: cells,
      scoreDisplay: s.scoreDisplay,
      tiebreaks: s.tiebreaks,
    }
  })

  const input: CrossTablePublishInput = {
    tournamentName: tournament.name,
    roundCount,
    showGroup: tournament.showGroup,
    showELO: tournament.showELO,
    tiebreakNames: tournament.selectedTiebreaks,
    players,
  }

  return htmlBlob(publishCrossTable(input))
}

export async function publishHtml(
  tournamentId: number,
  what: string,
  round?: number,
): Promise<Blob> {
  const [baseName, query = ''] = what.split('?')

  switch (baseName) {
    case 'pairings':
      return publishPairingsHtml(tournamentId, round)
    case 'standings':
      return publishStandingsHtml(tournamentId, round)
    case 'players':
      return publishPlayerListHtml(tournamentId)
    case 'club-standings':
      return publishClubStandingsHtml(tournamentId, round)
    case 'chess4-standings':
      return publishChess4StandingsHtml(tournamentId, round)
    case 'cross-table':
      return publishCrossTableHtml(tournamentId)
    case 'alphabetical':
      return publishAlphabeticalPairingsHtml(tournamentId, round, parseAlphabeticalOptions(query))
    default:
      throw new Error(`Unknown publish type: ${what}`)
  }
}

/**
 * Render a page and name the download after the round actually rendered,
 * so "Ställning" without a round picks the same N as the page content.
 */
export async function publishFile(
  tournamentId: number,
  what: string,
  round?: number,
): Promise<{ blob: Blob; filename: string }> {
  const roundNr = requestedOrLatestRound(tournamentId, round)
  const blob = await publishHtml(tournamentId, what, round)
  const tournament = getDatabaseService().tournaments.get(tournamentId)
  if (!tournament) throw new Error(`Tournament ${tournamentId} not found`)
  return { blob, filename: publishFilename(tournament, what, roundNr) }
}
