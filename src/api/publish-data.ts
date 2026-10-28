import { buildAlphabeticalPairings } from '../domain/alphabetical-pairings'
import type {
  AlphabeticalPairingsPublishInput,
  PairingsPublishInput,
  StandingsPublishInput,
} from '../domain/html-publisher'
import { getDatabaseService } from './service-provider'
import { getStandings } from './standings'

/** Build pairings input from DB. Returns null if tournament or round not found. */
export function buildPairingsInput(
  tournamentId: number,
  roundNr: number,
): PairingsPublishInput | null {
  const db = getDatabaseService()
  const tournament = db.tournaments.get(tournamentId)
  if (!tournament) return null

  const roundData = db.games.getRound(tournamentId, roundNr)
  if (!roundData) return null

  return {
    tournamentName: tournament.name,
    roundNr,
    games: roundData.games.map((g) => ({
      boardNr: g.boardNr,
      whiteName: g.whitePlayer?.name ?? null,
      blackName: g.blackPlayer?.name ?? null,
      resultDisplay: g.resultDisplay,
      currentResult: g.resultType !== 'NO_RESULT' ? g.resultType : undefined,
    })),
  }
}

/** Build alphabetical pairings input from DB. Returns null if tournament or round not found. */
export function buildAlphabeticalPairingsInput(
  tournamentId: number,
  roundNr: number,
): AlphabeticalPairingsPublishInput | null {
  const db = getDatabaseService()
  const tournament = db.tournaments.get(tournamentId)
  if (!tournament) return null

  const roundData = db.games.getRound(tournamentId, roundNr)
  if (!roundData) return null

  return buildAlphabeticalPairings(
    tournament.name,
    roundNr,
    roundData.games,
    db.tournamentPlayers.list(tournamentId),
  )
}

/** Build standings input from DB. Returns null if tournament not found. */
export async function buildStandingsInput(
  tournamentId: number,
  roundNr: number,
): Promise<StandingsPublishInput | null> {
  const db = getDatabaseService()
  const tournament = db.tournaments.get(tournamentId)
  if (!tournament) return null

  const standings = await getStandings(tournamentId, roundNr)

  return {
    tournamentName: tournament.name,
    roundNr,
    showELO: tournament.showELO,
    tiebreakNames: tournament.selectedTiebreaks,
    standings: standings.map((s) => ({
      place: s.place,
      name: s.name,
      club: s.club,
      rating: s.rating,
      scoreDisplay: s.scoreDisplay,
      tiebreaks: s.tiebreaks,
    })),
  }
}
