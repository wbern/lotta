import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/settings'
import type { SettingsDto } from '../types/api'

const settingsKeys = {
  all: ['settings'] as const,
}

export function useSettings() {
  return useQuery({
    queryKey: settingsKeys.all,
    queryFn: api.getSettings,
  })
}

export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: Partial<SettingsDto>) => api.updateSettings(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: settingsKeys.all }),
  })
}
