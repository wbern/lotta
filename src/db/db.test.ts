import { describe, expect, it } from 'vitest'
import { initDatabase } from './db.ts'

describe('database initialization', () => {
  it('creates a database with foreign keys enabled', async () => {
    const db = await initDatabase()

    const result = db.exec('PRAGMA foreign_keys')
    expect(result[0].values[0][0]).toBe(1)

    db.close()
  })
})
