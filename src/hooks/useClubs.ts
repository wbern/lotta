import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: Partial<ClubDto>) => api.addClub(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: clubKeys.all }),
  })
}

export function useRenameClub() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: Partial<ClubDto> }) => api.renameClub(id, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: clubKeys.all }),
  })
}

export function useDeleteClub() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.deleteClub(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: clubKeys.all }),
  })
}
