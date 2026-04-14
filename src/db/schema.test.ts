import type { Database } from 'sql.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { initDatabase } from './db.ts'
import { createSchema } from './schema.ts'

describe('database schema', () => {
  let db: Database

  beforeEach(async () => {
    db = await initDatabase()
  })

  afterEach(() => {
    db.close()
  })

  it('creates all 9 tables', () => {
    createSchema(db)

    const result = db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    const tables = result[0].values.map((row) => row[0])

    expect(tables).toEqual([
      'availableplayers',
      'clubs',
      'settings',
      'stringsettings',
      'tournamentgames',
      'tournamentplayers',
      'tournamentrounddates',
      'tournaments',
      'tournamenttiebreaks',
    ])
  })

  it('enforces foreign keys on tournamentplayers', () => {
    createSchema(db)

    expect(() => {
      db.run(
        `INSERT INTO tournamentplayers (lastname, firstname, tournamentindex) VALUES ('Test', 'Player', 999)`,
      )
    }).toThrow()
  })
})
