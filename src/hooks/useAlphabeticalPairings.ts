import { useQuery } from '@tanstack/react-query'
import { getRound } from '../api/rounds'
import { listTournamentPlayers } from '../api/tournament-players'
import { getTournament } from '../api/tournaments'
import { buildAlphabeticalPairings } from '../domain/alphabetical-pairings'

/**
 * Alphabetical pairings for the print view of Alfabetisk lottning. Read through
 * the data provider (so a P2P client prints the host's data, not its own local
 * database) and cached under the tournament, so every write refreshes it
 * (ADR-0007).
 */
export function useAlphabeticalPairings(tournamentId: number, roundNr: number | undefined) {
  return useQuery({
    queryKey: ['tournaments', tournamentId, 'alphabetical-print', roundNr],
    queryFn: async () => {
      const [tournament, round, players] = await Promise.all([
        getTournament(tournamentId),
        getRound(tournamentId, roundNr!),
        listTournamentPlayers(tournamentId),
      ])
      return buildAlphabeticalPairings(tournament.name, roundNr!, round.games, players)
    },
    enabled: roundNr != null,
  })
}
