import type { Database } from 'sql.js'
import type { SettingsDto } from '../../types/api.ts'

const DEFAULTS: SettingsDto = {
  playerPresentation: 'FIRST_LAST',
  maxPointsImmediately: false,
  searchForUpdate: false,
  nrOfRows: 20,
}

export class SettingsRepository {
  private db: Database
  constructor(db: Database) {
    this.db = db
  }

  get(): SettingsDto {
    const intSettings = this.db.exec('SELECT setting, value FROM settings')
    const strSettings = this.db.exec('SELECT setting, value FROM stringsettings')

    const map = new Map<string, string | number | null>()
    if (intSettings.length > 0) {
      for (const row of intSettings[0].values) {
        map.set(row[0] as string, row[1] as number)
      }
    }
    if (strSettings.length > 0) {
      for (const row of strSettings[0].values) {
        map.set(row[0] as string, row[1] as string)
      }
    }

    return {
      playerPresentation: (map.get('playerPresentation') as string) ?? DEFAULTS.playerPresentation,
      maxPointsImmediately:
        map.get('maxPointsImmediately') === 1 ? true : DEFAULTS.maxPointsImmediately,
      searchForUpdate: map.get('searchForUpdate') === 1 ? true : DEFAULTS.searchForUpdate,
      nrOfRows: (map.get('nrOfRows') as number) ?? DEFAULTS.nrOfRows,
    }
  }

  update(dto: Partial<SettingsDto>): SettingsDto {
    if (dto.nrOfRows !== undefined) {
      this.setInt('nrOfRows', dto.nrOfRows)
    }
    if (dto.maxPointsImmediately !== undefined) {
      this.setInt('maxPointsImmediately', dto.maxPointsImmediately ? 1 : 0)
    }
    if (dto.searchForUpdate !== undefined) {
      this.setInt('searchForUpdate', dto.searchForUpdate ? 1 : 0)
    }
    if (dto.playerPresentation !== undefined) {
      this.setString('playerPresentation', dto.playerPresentation)
    }
    return this.get()
  }

  setInt(setting: string, value: number): void {
    this.db.run(
      'INSERT INTO settings (setting, value) VALUES (?, ?) ON CONFLICT(setting) DO UPDATE SET value = ?',
      [setting, value, value],
    )
  }

  setString(setting: string, value: string): void {
    this.db.run(
      'INSERT INTO stringsettings (setting, value) VALUES (?, ?) ON CONFLICT(setting) DO UPDATE SET value = ?',
      [setting, value, value],
    )
  }
}
