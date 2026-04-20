import { describe, expect, it } from 'vitest'
import { dbName } from './db-name'

describe('dbName', () => {
  it('returns the base name unchanged when no rollback version is set', () => {
    expect(dbName('lotta-chess', null)).toBe('lotta-chess')
  })

  it('appends a versioned suffix when a rollback version is set', () => {
    expect(dbName('lotta-chess', '1.2.3')).toBe('lotta-chess-v1.2.3')
  })
})
