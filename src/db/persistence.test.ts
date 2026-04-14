import { beforeEach, describe, expect, it } from 'vitest'
import { deleteDatabase, loadDatabase, saveDatabase } from './persistence.ts'

describe('database persistence', () => {
  beforeEach(async () => {
    await deleteDatabase()
  })

  it('returns null when no saved database exists', async () => {
    const data = await loadDatabase()
    expect(data).toBeNull()
  })

  it('saves and loads database data', async () => {
    const testData = new Uint8Array([1, 2, 3, 4, 5])
    await saveDatabase(testData)

    const loaded = await loadDatabase()
    expect(loaded).not.toBeNull()
    expect(Array.from(loaded!)).toEqual([1, 2, 3, 4, 5])
  })
})
