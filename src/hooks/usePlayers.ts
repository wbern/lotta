import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: Partial<PlayerDto>) => api.addPoolPlayer(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: playerPoolKeys.all }),
  })
}

export function useUpdatePoolPlayer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: Partial<PlayerDto> }) =>
      api.updatePoolPlayer(id, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: playerPoolKeys.all }),
  })
}

export function useDeletePoolPlayers() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: number[]) => api.deletePoolPlayers(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: playerPoolKeys.all }),
  })
}
