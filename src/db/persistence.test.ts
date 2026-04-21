import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

describe('database persistence across a rollback switch', () => {
  // Re-import persistence.ts twice with different __ROLLBACK_VERSION__ globals
  // to simulate the real scenario: user is on mainline (/), clicks "Byt till
  // v1.0.0", the browser navigates to /v/1.0.0/ and loads a rollback bundle.
  // IndexedDB itself is origin-scoped, so the only thing keeping the rollback
  // view from seeing (and trampling) live mainline data is the dbName()
  // namespacing applied at module load.
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('a rollback build does not see mainline data (RollbackDialog copy holds)', async () => {
    vi.stubGlobal('__ROLLBACK_VERSION__', null)
    vi.resetModules()
    const mainline = await import('./persistence.ts')
    await mainline.deleteDatabase()
    await mainline.saveDatabase(new Uint8Array([42, 43, 44]))

    vi.stubGlobal('__ROLLBACK_VERSION__', '1.0.0')
    vi.resetModules()
    const rollback = await import('./persistence.ts')
    await rollback.deleteDatabase()
    const seen = await rollback.loadDatabase()

    expect(seen).toBeNull()
  })
})
