import type { SettingsDto } from '../types/api'
import { getDatabaseService, withSave } from './service-provider'

export async function getSettings(): Promise<SettingsDto> {
  return getDatabaseService().settings.get()
}

export async function updateSettings(dto: Partial<SettingsDto>): Promise<SettingsDto> {
  return withSave(
    () => getDatabaseService().settings.update(dto),
    'Uppdatera inställningar',
    'Inställningar',
  )
}
