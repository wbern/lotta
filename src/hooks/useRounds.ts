import { useMutation, useQuery } from '@tanstack/react-query'
import * as api from '../api/rounds'

const roundKeys = {
  list: (tournamentId: number) => ['tournaments', tournamentId, 'rounds'] as const,
  detail: (tournamentId: number, roundNr: number) =>
    ['tournaments', tournamentId, 'rounds', roundNr] as const,
}

export function useRounds(tournamentId: number | undefined) {
  return useQuery({
    queryKey: roundKeys.list(tournamentId!),
    queryFn: () => api.listRounds(tournamentId!),
    enabled: tournamentId != null,
  })
}

export function useRound(tournamentId: number | undefined, roundNr: number | undefined) {
  return useQuery({
    queryKey: roundKeys.detail(tournamentId!, roundNr!),
    queryFn: () => api.getRound(tournamentId!, roundNr!),
    enabled: tournamentId != null && roundNr != null,
  })
}

export function usePairNextRound(tournamentId: number | undefined) {
  return useMutation({
    mutationFn: () => {
      if (tournamentId == null) throw new Error('No tournament selected')
      return api.pairNextRound(tournamentId)
    },
  })
}

export function useUnpairLastRound(tournamentId: number | undefined) {
  return useMutation({
    mutationFn: () => {
      if (tournamentId == null) throw new Error('No tournament selected')
      return api.unpairLastRound(tournamentId)
    },
  })
}
