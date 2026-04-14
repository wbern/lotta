import type { Database } from 'sql.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { initDatabase } from '../db.ts'
import { createSchema } from '../schema.ts'
import { SettingsRepository } from './settings.ts'

describe('SettingsRepository', () => {
  let db: Database
  let settings: SettingsRepository

  beforeEach(async () => {
    db = await initDatabase()
    createSchema(db)
    settings = new SettingsRepository(db)
  })

  afterEach(() => {
    db.close()
  })

  it('returns default settings when no rows exist', () => {
    const result = settings.get()
    expect(result).toEqual({
      playerPresentation: 'FIRST_LAST',
      maxPointsImmediately: false,
      searchForUpdate: false,
      nrOfRows: 20,
    })
  })

  it('updates and persists settings', () => {
    const updated = settings.update({
      nrOfRows: 50,
      maxPointsImmediately: true,
      playerPresentation: 'Förnamn Efternamn',
    })

    expect(updated.nrOfRows).toBe(50)
    expect(updated.maxPointsImmediately).toBe(true)
    expect(updated.playerPresentation).toBe('Förnamn Efternamn')
    expect(updated.searchForUpdate).toBe(false)

    const reloaded = settings.get()
    expect(reloaded.nrOfRows).toBe(50)
    expect(reloaded.maxPointsImmediately).toBe(true)
  })
})
