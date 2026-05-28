const PRIMARY_DB_NAME = 'lotta-chess'
const VERSIONED_PREFIX = 'lotta-chess-v'
const STORE_NAME = 'database'
const KEY = 'main'

function openExisting(name: string): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    const req = indexedDB.open(name)
    req.onupgradeneeded = () => {
      req.transaction?.abort()
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => resolve(null)
    req.onblocked = () => resolve(null)
  })
}

function readKey(db: IDBDatabase): Promise<Uint8Array | null> {
  return new Promise((resolve) => {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.close()
      resolve(null)
      return
    }
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(KEY)
    req.onsuccess = () => {
      db.close()
      const value = req.result
      resolve(value instanceof Uint8Array ? value : null)
    }
    req.onerror = () => {
      db.close()
      resolve(null)
    }
  })
}

async function listLottaDatabaseNames(): Promise<string[]> {
  if (typeof indexedDB.databases !== 'function') return [PRIMARY_DB_NAME]
  try {
    const all = await indexedDB.databases()
    return all
      .map((d) => d.name)
      .filter((n): n is string => typeof n === 'string')
      .filter((n) => n === PRIMARY_DB_NAME || n.startsWith(VERSIONED_PREFIX))
  } catch {
    return [PRIMARY_DB_NAME]
  }
}

export async function readBackupBytes(): Promise<Uint8Array | null> {
  const names = await listLottaDatabaseNames()
  const ordered = [
    ...names.filter((n) => n === PRIMARY_DB_NAME),
    ...names.filter((n) => n !== PRIMARY_DB_NAME),
  ]
  for (const name of ordered) {
    const db = await openExisting(name)
    if (!db) continue
    const bytes = await readKey(db)
    if (bytes) return bytes
  }
  return null
}
