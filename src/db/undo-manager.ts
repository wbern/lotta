import { getDatabaseService } from '../api/service-provider.ts'
import {
  clearUndoData,
  loadAllAuditEntries,
  loadAllSnapshotKeys,
  loadSnapshot,
  type StoredAuditEntry,
  saveSnapshot,
  saveSnapshotWithAudit,
  truncateAfter,
  truncateBefore,
} from './undo-persistence.ts'

export interface AuditEntry extends StoredAuditEntry {
  index: number
}

export interface UndoState {
  canUndo: boolean
  canRedo: boolean
  undoLabel: string | null
  redoLabel: string | null
}

const MAX_SNAPSHOTS = 50

export class UndoManager {
  private snapshotKeys: number[] = []
  private auditEntries: AuditEntry[] = []
  private currentPosition = -1
  private listeners: Set<() => void> = new Set()

  // Cached values for useSyncExternalStore (must be referentially stable)
  private cachedState: UndoState = {
    canUndo: false,
    canRedo: false,
    undoLabel: null,
    redoLabel: null,
  }
  private cachedTimeline: AuditEntry[] = []

  private constructor() {}

  static async create(): Promise<UndoManager> {
    const manager = new UndoManager()
    const keys = await loadAllSnapshotKeys()
    const entries = await loadAllAuditEntries()
    manager.snapshotKeys = keys
    manager.auditEntries = entries
    manager.currentPosition = keys.length - 1
    manager.rebuildCaches()
    return manager
  }

  async captureInitialState(): Promise<void> {
    if (this.snapshotKeys.length > 0) return
    const data = getDatabaseService().export()
    const key = await saveSnapshot({ data, timestamp: Date.now() })
    this.snapshotKeys.push(key)
    this.currentPosition = 0
    this.notify()
  }

  async pushState(label: string, detail: string): Promise<void> {
    // If we're not at the end (user did undo then made a new mutation),
    // truncate everything after current position
    if (this.currentPosition < this.snapshotKeys.length - 1) {
      const lastKeptKey = this.snapshotKeys[this.currentPosition]
      await truncateAfter(lastKeptKey)
      this.snapshotKeys = this.snapshotKeys.slice(0, this.currentPosition + 1)
      this.auditEntries = this.auditEntries.filter((e) => e.snapshotIndex <= lastKeptKey)
    }

    const data = getDatabaseService().export()
    const timestamp = Date.now()
    const key = await saveSnapshotWithAudit({ data, timestamp }, { label, detail, timestamp })

    this.snapshotKeys.push(key)
    this.auditEntries.push({
      index:
        this.auditEntries.length > 0 ? Math.max(...this.auditEntries.map((e) => e.index)) + 1 : 1,
      label,
      detail,
      timestamp,
      snapshotIndex: key,
    })
    this.currentPosition = this.snapshotKeys.length - 1

    // Enforce cap
    while (this.snapshotKeys.length > MAX_SNAPSHOTS) {
      const oldestKey = this.snapshotKeys[0]
      await truncateBefore(this.snapshotKeys[1])
      this.snapshotKeys.shift()
      this.auditEntries = this.auditEntries.filter((e) => e.snapshotIndex !== oldestKey)
      this.currentPosition--
    }

    this.notify()
  }

  async undo(): Promise<Uint8Array | null> {
    if (this.currentPosition <= 0) return null
    this.currentPosition--
    const key = this.snapshotKeys[this.currentPosition]
    const stored = await loadSnapshot(key)
    if (!stored) return null
    this.notify()
    return stored.data
  }

  async redo(): Promise<Uint8Array | null> {
    if (this.currentPosition >= this.snapshotKeys.length - 1) return null
    this.currentPosition++
    const key = this.snapshotKeys[this.currentPosition]
    const stored = await loadSnapshot(key)
    if (!stored) return null
    this.notify()
    return stored.data
  }

  async restoreToSnapshot(snapshotIndex: number): Promise<Uint8Array | null> {
    const position = this.snapshotKeys.indexOf(snapshotIndex)
    if (position === -1) return null
    const stored = await loadSnapshot(snapshotIndex)
    if (!stored) return null
    this.currentPosition = position
    this.notify()
    return stored.data
  }

  getState(): UndoState {
    return this.cachedState
  }

  getTimeline(): AuditEntry[] {
    return this.cachedTimeline
  }

  getCurrentSnapshotIndex(): number {
    if (this.currentPosition < 0) return -1
    return this.snapshotKeys[this.currentPosition]
  }

  async clear(): Promise<void> {
    await clearUndoData()
    this.snapshotKeys = []
    this.auditEntries = []
    this.currentPosition = -1
    this.notify()
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private rebuildCaches(): void {
    const canUndo = this.currentPosition > 0
    const canRedo = this.currentPosition < this.snapshotKeys.length - 1

    const undoLabel = canUndo
      ? (this.auditEntries.find((e) => e.snapshotIndex === this.snapshotKeys[this.currentPosition])
          ?.label ?? null)
      : null

    const redoLabel = canRedo
      ? (this.auditEntries.find(
          (e) => e.snapshotIndex === this.snapshotKeys[this.currentPosition + 1],
        )?.label ?? null)
      : null

    this.cachedState = { canUndo, canRedo, undoLabel, redoLabel }
    this.cachedTimeline = [...this.auditEntries]
  }

  private notify(): void {
    this.rebuildCaches()
    for (const listener of this.listeners) {
      listener()
    }
  }
}
