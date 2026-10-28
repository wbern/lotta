import type { Database } from 'sql.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { initDatabase } from './db.ts'
import { createSchema, migrateSchema } from './schema.ts'

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

  it('given tournaments saved by an older version with Swedish rating-choice labels, when the schema is migrated, then they are rewritten to the internal codes', () => {
    createSchema(db)
    const labels = ['ELO', 'Snabb-ELO', 'Blixt-ELO', 'Snabb-ELO annars ELO', 'Blixt-ELO annars ELO']
    for (const [i, label] of labels.entries()) {
      db.run(
        `INSERT INTO tournaments (tournament, tournamentgroup, pairingsystem, initialpairing, rounds, barredpairing, compensateweakplayerpp, chess4, pointspergame, ratingchoice, showelo, showgroup)
         VALUES (?, 'A', 'Monrad', 'Slumpad', 5, 'false', 'false', 'false', 1, ?, 'true', 'true')`,
        [`T${i}`, label],
      )
    }

    migrateSchema(db)

    const rows = db.exec('SELECT tournament, ratingchoice FROM tournaments ORDER BY tournament')[0]
      .values
    expect(rows).toEqual([
      ['T0', 'ELO'],
      ['T1', 'QUICK'],
      ['T2', 'BLITZ'],
      ['T3', 'QUICK_THEN_ELO'],
      ['T4', 'BLITZ_THEN_ELO'],
    ])
  })
})
