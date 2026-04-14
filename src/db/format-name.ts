import type { Database } from 'sql.js'

export type NamePresentation = 'FIRST_LAST' | 'LAST_FIRST'

export function getPlayerPresentation(db: Database): NamePresentation {
  const result = db.exec("SELECT value FROM stringsettings WHERE setting = 'playerPresentation'")
  if (result.length > 0 && result[0].values.length > 0) {
    const val = result[0].values[0][0] as string
    if (val === 'LAST_FIRST') return 'LAST_FIRST'
  }
  return 'FIRST_LAST'
}

export function formatPlayerName(
  firstName: string,
  lastName: string,
  presentation: NamePresentation,
): string {
  if (presentation === 'LAST_FIRST') {
    return `${lastName} ${firstName}`.trim()
  }
  return `${firstName} ${lastName}`.trim()
}
