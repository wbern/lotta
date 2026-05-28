import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { readBackupBytes } from './backup'

async function seedDatabase(name: string, bytes: Uint8Array): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const open = indexedDB.open(name, 1)
    open.onupgradeneeded = () => {
      open.result.createObjectStore('database')
    }
    open.onsuccess = () => {
      const db = open.result
      const tx = db.transaction('database', 'readwrite')
      tx.objectStore('database').put(bytes, 'main')
      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      tx.onerror = () => {
        db.close()
        reject(tx.error)
      }
    }
    open.onerror = () => reject(open.error)
  })
}

afterEach(async () => {
  for (const name of ['lotta-chess', 'lotta-chess-v1.0.0', 'lotta-chess-v9.9.9']) {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase(name)
      req.onsuccess = () => resolve()
      req.onerror = () => resolve()
      req.onblocked = () => resolve()
    })
  }
})

describe('readBackupBytes', () => {
  it('returns the SQLite bytes from the unversioned lotta-chess DB', async () => {
    const expected = new Uint8Array([0x53, 0x51, 0x4c, 0x69, 0x74, 0x65])
    await seedDatabase('lotta-chess', expected)

    const result = await readBackupBytes()

    expect(result).toEqual(expected)
  })

  it('returns null when no lotta-chess database exists', async () => {
    const result = await readBackupBytes()
    expect(result).toBeNull()
  })

  it('falls back to a versioned lotta-chess-v* DB when the unversioned one is missing', async () => {
    const expected = new Uint8Array([1, 2, 3, 4])
    await seedDatabase('lotta-chess-v1.0.0', expected)

    const result = await readBackupBytes()

    expect(result).toEqual(expected)
  })
})
