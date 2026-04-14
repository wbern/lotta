import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/tournament-players'
import type { PlayerDto } from '../types/api'
import { tournamentKeys } from './useTournaments'

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
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: Partial<PlayerDto>) => api.addTournamentPlayer(tournamentId, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tournamentPlayerKeys.list(tournamentId) })
      qc.invalidateQueries({ queryKey: tournamentKeys.detail(tournamentId) })
    },
  })
}

export function useAddTournamentPlayers(tournamentId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dtos: Partial<PlayerDto>[]) => api.addTournamentPlayers(tournamentId, dtos),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tournamentPlayerKeys.list(tournamentId) })
      qc.invalidateQueries({ queryKey: tournamentKeys.detail(tournamentId) })
    },
  })
}

export function useUpdateTournamentPlayer(tournamentId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ playerId, dto }: { playerId: number; dto: Partial<PlayerDto> }) =>
      api.updateTournamentPlayer(tournamentId, playerId, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tournamentPlayerKeys.list(tournamentId) })
    },
  })
}

export function useRemoveTournamentPlayers(tournamentId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (playerIds: number[]) => api.removeTournamentPlayers(tournamentId, playerIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tournamentPlayerKeys.list(tournamentId) })
      qc.invalidateQueries({ queryKey: tournamentKeys.detail(tournamentId) })
    },
  })
}
