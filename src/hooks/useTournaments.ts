import { useMutation, useQuery } from '@tanstack/react-query'
import * as api from '../api/tournaments'
import type { CreateTournamentRequest } from '../types/api'

const tournamentKeys = {
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
  return useMutation({
    mutationFn: (req: CreateTournamentRequest) => api.createTournament(req),
  })
}

export function useUpdateTournament() {
  return useMutation({
    mutationFn: ({ id, req }: { id: number; req: CreateTournamentRequest }) =>
      api.updateTournament(id, req),
  })
}

export function useDeleteTournament() {
  return useMutation({
    mutationFn: (id: number) => api.deleteTournament(id),
  })
}
