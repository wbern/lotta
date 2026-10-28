import { useMutation, useQuery } from '@tanstack/react-query'
import * as api from '../api/players'
import type { PlayerDto } from '../types/api'

const playerPoolKeys = {
  all: ['players'] as const,
}

export function usePoolPlayers() {
  return useQuery({
    queryKey: playerPoolKeys.all,
    queryFn: api.listPoolPlayers,
  })
}

export function useAddPoolPlayer() {
  return useMutation({
    mutationFn: (dto: Partial<PlayerDto>) => api.addPoolPlayer(dto),
  })
}

export function useUpdatePoolPlayer() {
  return useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: Partial<PlayerDto> }) =>
      api.updatePoolPlayer(id, dto),
  })
}

export function useDeletePoolPlayers() {
  return useMutation({
    mutationFn: (ids: number[]) => api.deletePoolPlayers(ids),
  })
}
