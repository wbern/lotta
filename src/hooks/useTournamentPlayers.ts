import { useMutation, useQuery } from '@tanstack/react-query'
import * as api from '../api/tournament-players'
import type { PlayerDto } from '../types/api'

const tournamentPlayerKeys = {
  list: (tournamentId: number) => ['tournaments', tournamentId, 'players'] as const,
}

export function useTournamentPlayers(tournamentId: number | undefined) {
  return useQuery({
    queryKey: tournamentPlayerKeys.list(tournamentId!),
    queryFn: () => api.listTournamentPlayers(tournamentId!),
    enabled: tournamentId != null,
  })
}

export function useAddTournamentPlayer(tournamentId: number) {
  return useMutation({
    mutationFn: (dto: Partial<PlayerDto>) => api.addTournamentPlayer(tournamentId, dto),
  })
}

export function useAddTournamentPlayers(tournamentId: number) {
  return useMutation({
    mutationFn: (dtos: Partial<PlayerDto>[]) => api.addTournamentPlayers(tournamentId, dtos),
  })
}

export function useUpdateTournamentPlayer(tournamentId: number) {
  return useMutation({
    mutationFn: ({ playerId, dto }: { playerId: number; dto: Partial<PlayerDto> }) =>
      api.updateTournamentPlayer(tournamentId, playerId, dto),
  })
}

export function useRemoveTournamentPlayers(tournamentId: number) {
  return useMutation({
    mutationFn: (playerIds: number[]) => api.removeTournamentPlayers(tournamentId, playerIds),
  })
}
