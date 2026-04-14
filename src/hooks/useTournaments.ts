import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/tournaments'
import type { CreateTournamentRequest } from '../types/api'

export const tournamentKeys = {
  all: ['tournaments'] as const,
  detail: (id: number) => ['tournaments', id] as const,
}

export function useTournaments() {
  return useQuery({
    queryKey: tournamentKeys.all,
    queryFn: api.listTournaments,
  })
}

export function useTournament(id: number | undefined) {
  return useQuery({
    queryKey: tournamentKeys.detail(id!),
    queryFn: () => api.getTournament(id!),
    enabled: id != null,
  })
}

export function useCreateTournament() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (req: CreateTournamentRequest) => api.createTournament(req),
    onSuccess: () => qc.invalidateQueries({ queryKey: tournamentKeys.all }),
  })
}

export function useUpdateTournament() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, req }: { id: number; req: CreateTournamentRequest }) =>
      api.updateTournament(id, req),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: tournamentKeys.all })
      qc.invalidateQueries({ queryKey: tournamentKeys.detail(vars.id) })
    },
  })
}

export function useDeleteTournament() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.deleteTournament(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: tournamentKeys.all }),
  })
}
