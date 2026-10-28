import { useMutation, useQuery } from '@tanstack/react-query'
import * as api from '../api/clubs'
import type { ClubDto } from '../types/api'

const clubKeys = {
  all: ['clubs'] as const,
}

export function useClubs() {
  return useQuery({
    queryKey: clubKeys.all,
    queryFn: api.listClubs,
  })
}

export function useAddClub() {
  return useMutation({
    mutationFn: (dto: Partial<ClubDto>) => api.addClub(dto),
  })
}

export function useRenameClub() {
  return useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: Partial<ClubDto> }) => api.renameClub(id, dto),
  })
}

export function useDeleteClub() {
  return useMutation({
    mutationFn: (id: number) => api.deleteClub(id),
  })
}
