const DB_NAME = 'lotta-undo'
const SNAPSHOTS_STORE = 'snapshots'
const AUDIT_STORE = 'audit'

interface StoredSnapshot {
  data: Uint8Array
  timestamp: number
}

export interface StoredAuditEntry {
  label: string
  detail: string
  timestamp: number
  snapshotIndex: number
}

function openUndoIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      db.createObjectStore(SNAPSHOTS_STORE, { autoIncrement: true })
      const auditStore = db.createObjectStore(AUDIT_STORE, { autoIncrement: true })
      auditStore.createIndex('snapshotIndex', 'snapshotIndex', { unique: false })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveSnapshot(snapshot: StoredSnapshot): Promise<number> {
  const db = await openUndoIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SNAPSHOTS_STORE, 'readwrite')
    const request = tx.objectStore(SNAPSHOTS_STORE).add(snapshot)
    request.onsuccess = () => {
      db.close()
      resolve(request.result as number)
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
  })
}

export async function loadSnapshot(index: number): Promise<StoredSnapshot | null> {
  const db = await openUndoIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SNAPSHOTS_STORE, 'readonly')
    const request = tx.objectStore(SNAPSHOTS_STORE).get(index)
    request.onsuccess = () => {
      db.close()
      resolve(request.result ?? null)
    }
    request.onerror = () => {
      db.close()
      reject(request.error)
    }
  })
}

export async function loadAllSnapshotKeys(): Promise<number[]> {
  const db = await openUndoIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SNAPSHOTS_STORE, 'readonly')
    const request = tx.objectStore(SNAPSHOTS_STORE).getAllKeys()
    request.onsuccess = () => {
      db.close()
      resolve(request.result as number[])
    }
    request.onerror = () => {
      db.close()
      reject(request.error)
    }
  })
}

export async function deleteSnapshotsAfter(index: number): Promise<void> {
  const db = await openUndoIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SNAPSHOTS_STORE, 'readwrite')
    const store = tx.objectStore(SNAPSHOTS_STORE)
    const range = IDBKeyRange.lowerBound(index, true)
    store.delete(range)
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
  })
}

export async function deleteSnapshotsBefore(index: number): Promise<void> {
  const db = await openUndoIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SNAPSHOTS_STORE, 'readwrite')
    const store = tx.objectStore(SNAPSHOTS_STORE)
    const range = IDBKeyRange.upperBound(index, true)
    store.delete(range)
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
  })
}

export async function saveAuditEntry(entry: StoredAuditEntry): Promise<number> {
  const db = await openUndoIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AUDIT_STORE, 'readwrite')
    const request = tx.objectStore(AUDIT_STORE).add(entry)
    request.onsuccess = () => {
      db.close()
      resolve(request.result as number)
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
  })
}

export async function loadAllAuditEntries(): Promise<(StoredAuditEntry & { index: number })[]> {
  const db = await openUndoIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AUDIT_STORE, 'readonly')
    const store = tx.objectStore(AUDIT_STORE)
    const request = store.openCursor()
    const entries: (StoredAuditEntry & { index: number })[] = []
    request.onsuccess = () => {
      const cursor = request.result
      if (cursor) {
        entries.push({ ...cursor.value, index: cursor.key as number })
        cursor.continue()
      } else {
        db.close()
        resolve(entries)
      }
    }
    request.onerror = () => {
      db.close()
      reject(request.error)
    }
  })
}

export async function deleteAuditEntriesAfter(snapshotIndex: number): Promise<void> {
  const db = await openUndoIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AUDIT_STORE, 'readwrite')
    const store = tx.objectStore(AUDIT_STORE)
    const idx = store.index('snapshotIndex')
    const range = IDBKeyRange.lowerBound(snapshotIndex, true)
    const request = idx.openCursor(range)
    request.onsuccess = () => {
      const cursor = request.result
      if (cursor) {
        cursor.delete()
        cursor.continue()
      }
    }
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
  })
}

export async function deleteAuditEntriesBefore(snapshotIndex: number): Promise<void> {
  const db = await openUndoIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AUDIT_STORE, 'readwrite')
    const store = tx.objectStore(AUDIT_STORE)
    const idx = store.index('snapshotIndex')
    const range = IDBKeyRange.upperBound(snapshotIndex, true)
    const request = idx.openCursor(range)
    request.onsuccess = () => {
      const cursor = request.result
      if (cursor) {
        cursor.delete()
        cursor.continue()
      }
    }
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
  })
}

export async function saveSnapshotWithAudit(
  snapshot: StoredSnapshot,
  entry: Omit<StoredAuditEntry, 'snapshotIndex'>,
): Promise<number> {
  const db = await openUndoIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction([SNAPSHOTS_STORE, AUDIT_STORE], 'readwrite')
    const snapshotReq = tx.objectStore(SNAPSHOTS_STORE).add(snapshot)
    snapshotReq.onsuccess = () => {
      const key = snapshotReq.result as number
      tx.objectStore(AUDIT_STORE).add({ ...entry, snapshotIndex: key })
    }
    tx.oncomplete = () => {
      db.close()
      resolve(snapshotReq.result as number)
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
  })
}

export async function truncateAfter(snapshotIndex: number): Promise<void> {
  const db = await openUndoIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction([SNAPSHOTS_STORE, AUDIT_STORE], 'readwrite')
    tx.objectStore(SNAPSHOTS_STORE).delete(IDBKeyRange.lowerBound(snapshotIndex, true))
    const idx = tx.objectStore(AUDIT_STORE).index('snapshotIndex')
    const request = idx.openCursor(IDBKeyRange.lowerBound(snapshotIndex, true))
    request.onsuccess = () => {
      const cursor = request.result
      if (cursor) {
        cursor.delete()
        cursor.continue()
      }
    }
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
  })
}

export async function truncateBefore(snapshotIndex: number): Promise<void> {
  const db = await openUndoIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction([SNAPSHOTS_STORE, AUDIT_STORE], 'readwrite')
    tx.objectStore(SNAPSHOTS_STORE).delete(IDBKeyRange.upperBound(snapshotIndex, true))
    const idx = tx.objectStore(AUDIT_STORE).index('snapshotIndex')
    const request = idx.openCursor(IDBKeyRange.upperBound(snapshotIndex, true))
    request.onsuccess = () => {
      const cursor = request.result
      if (cursor) {
        cursor.delete()
        cursor.continue()
      }
    }
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
  })
}

export async function clearUndoData(): Promise<void> {
  const db = await openUndoIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction([SNAPSHOTS_STORE, AUDIT_STORE], 'readwrite')
    tx.objectStore(SNAPSHOTS_STORE).clear()
    tx.objectStore(AUDIT_STORE).clear()
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
  })
}

export async function deleteUndoDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}
