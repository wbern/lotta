import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearUndoData,
  deleteAuditEntriesAfter,
  deleteAuditEntriesBefore,
  deleteSnapshotsAfter,
  deleteSnapshotsBefore,
  deleteUndoDatabase,
  loadAllAuditEntries,
  loadAllSnapshotKeys,
  loadSnapshot,
  saveAuditEntry,
  saveSnapshot,
  saveSnapshotWithAudit,
  truncateAfter,
  truncateBefore,
} from './undo-persistence.ts'

describe('undo persistence', () => {
  beforeEach(async () => {
    await deleteUndoDatabase()
  })

  describe('snapshots', () => {
    it('saves and loads a snapshot', async () => {
      const data = new Uint8Array([10, 20, 30])
      const key = await saveSnapshot({ data, timestamp: 1000 })
      expect(key).toBeGreaterThan(0)

      const loaded = await loadSnapshot(key)
      expect(loaded).not.toBeNull()
      expect(Array.from(loaded!.data)).toEqual([10, 20, 30])
      expect(loaded!.timestamp).toBe(1000)
    })

    it('returns null for missing snapshot', async () => {
      const loaded = await loadSnapshot(999)
      expect(loaded).toBeNull()
    })

    it('loads all snapshot keys in order', async () => {
      const k1 = await saveSnapshot({ data: new Uint8Array([1]), timestamp: 1 })
      const k2 = await saveSnapshot({ data: new Uint8Array([2]), timestamp: 2 })
      const k3 = await saveSnapshot({ data: new Uint8Array([3]), timestamp: 3 })

      const keys = await loadAllSnapshotKeys()
      expect(keys).toEqual([k1, k2, k3])
    })

    it('deletes snapshots after a given key', async () => {
      const k1 = await saveSnapshot({ data: new Uint8Array([1]), timestamp: 1 })
      const k2 = await saveSnapshot({ data: new Uint8Array([2]), timestamp: 2 })
      await saveSnapshot({ data: new Uint8Array([3]), timestamp: 3 })

      await deleteSnapshotsAfter(k2)

      const keys = await loadAllSnapshotKeys()
      expect(keys).toEqual([k1, k2])
    })

    it('deletes snapshots before a given key', async () => {
      await saveSnapshot({ data: new Uint8Array([1]), timestamp: 1 })
      const k2 = await saveSnapshot({ data: new Uint8Array([2]), timestamp: 2 })
      const k3 = await saveSnapshot({ data: new Uint8Array([3]), timestamp: 3 })

      await deleteSnapshotsBefore(k2)

      const keys = await loadAllSnapshotKeys()
      expect(keys).toEqual([k2, k3])
    })
  })

  describe('audit entries', () => {
    it('saves and loads audit entries', async () => {
      await saveAuditEntry({
        label: 'Ny klubb',
        detail: 'SK Rockaden',
        timestamp: 1000,
        snapshotIndex: 1,
      })
      await saveAuditEntry({
        label: 'Lotta rond',
        detail: 'Rond 1',
        timestamp: 2000,
        snapshotIndex: 2,
      })

      const entries = await loadAllAuditEntries()
      expect(entries).toHaveLength(2)
      expect(entries[0].label).toBe('Ny klubb')
      expect(entries[0].snapshotIndex).toBe(1)
      expect(entries[1].label).toBe('Lotta rond')
      expect(entries[1].snapshotIndex).toBe(2)
    })

    it('deletes audit entries after a snapshot index', async () => {
      await saveAuditEntry({ label: 'A', detail: '', timestamp: 1, snapshotIndex: 1 })
      await saveAuditEntry({ label: 'B', detail: '', timestamp: 2, snapshotIndex: 2 })
      await saveAuditEntry({ label: 'C', detail: '', timestamp: 3, snapshotIndex: 3 })

      await deleteAuditEntriesAfter(2)

      const entries = await loadAllAuditEntries()
      expect(entries).toHaveLength(2)
      expect(entries.map((e) => e.label)).toEqual(['A', 'B'])
    })

    it('deletes audit entries before a snapshot index', async () => {
      await saveAuditEntry({ label: 'A', detail: '', timestamp: 1, snapshotIndex: 1 })
      await saveAuditEntry({ label: 'B', detail: '', timestamp: 2, snapshotIndex: 2 })
      await saveAuditEntry({ label: 'C', detail: '', timestamp: 3, snapshotIndex: 3 })

      await deleteAuditEntriesBefore(2)

      const entries = await loadAllAuditEntries()
      expect(entries).toHaveLength(2)
      expect(entries.map((e) => e.label)).toEqual(['B', 'C'])
    })
  })

  describe('saveSnapshotWithAudit', () => {
    it('atomically saves snapshot and audit entry', async () => {
      const key = await saveSnapshotWithAudit(
        { data: new Uint8Array([10, 20]), timestamp: 1000 },
        { label: 'Ny klubb', detail: 'SK Rockaden', timestamp: 1000 },
      )
      expect(key).toBeGreaterThan(0)

      const snapshot = await loadSnapshot(key)
      expect(snapshot).not.toBeNull()
      expect(Array.from(snapshot!.data)).toEqual([10, 20])

      const entries = await loadAllAuditEntries()
      expect(entries).toHaveLength(1)
      expect(entries[0].label).toBe('Ny klubb')
      expect(entries[0].detail).toBe('SK Rockaden')
      expect(entries[0].snapshotIndex).toBe(key)
    })
  })

  describe('truncateAfter', () => {
    it('atomically deletes snapshots and audit entries after index', async () => {
      const k1 = await saveSnapshotWithAudit(
        { data: new Uint8Array([1]), timestamp: 1 },
        { label: 'A', detail: 'a', timestamp: 1 },
      )
      const k2 = await saveSnapshotWithAudit(
        { data: new Uint8Array([2]), timestamp: 2 },
        { label: 'B', detail: 'b', timestamp: 2 },
      )
      await saveSnapshotWithAudit(
        { data: new Uint8Array([3]), timestamp: 3 },
        { label: 'C', detail: 'c', timestamp: 3 },
      )

      await truncateAfter(k2)

      const keys = await loadAllSnapshotKeys()
      expect(keys).toEqual([k1, k2])

      const entries = await loadAllAuditEntries()
      expect(entries).toHaveLength(2)
      expect(entries.map((e) => e.label)).toEqual(['A', 'B'])
    })
  })

  describe('truncateBefore', () => {
    it('atomically deletes snapshots and audit entries before index', async () => {
      await saveSnapshotWithAudit(
        { data: new Uint8Array([1]), timestamp: 1 },
        { label: 'A', detail: 'a', timestamp: 1 },
      )
      const k2 = await saveSnapshotWithAudit(
        { data: new Uint8Array([2]), timestamp: 2 },
        { label: 'B', detail: 'b', timestamp: 2 },
      )
      const k3 = await saveSnapshotWithAudit(
        { data: new Uint8Array([3]), timestamp: 3 },
        { label: 'C', detail: 'c', timestamp: 3 },
      )

      await truncateBefore(k2)

      const keys = await loadAllSnapshotKeys()
      expect(keys).toEqual([k2, k3])

      const entries = await loadAllAuditEntries()
      expect(entries).toHaveLength(2)
      expect(entries.map((e) => e.label)).toEqual(['B', 'C'])
    })
  })

  describe('clearUndoData', () => {
    it('removes all snapshots and audit entries', async () => {
      await saveSnapshot({ data: new Uint8Array([1]), timestamp: 1 })
      await saveAuditEntry({ label: 'test', detail: '', timestamp: 1, snapshotIndex: 1 })

      await clearUndoData()

      const keys = await loadAllSnapshotKeys()
      const entries = await loadAllAuditEntries()
      expect(keys).toHaveLength(0)
      expect(entries).toHaveLength(0)
    })
  })
})
