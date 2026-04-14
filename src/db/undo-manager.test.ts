import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getDatabaseService, setDatabaseService } from '../api/service-provider.ts'
import { DatabaseService } from './database-service.ts'
import { deleteDatabase } from './persistence.ts'
import { UndoManager } from './undo-manager.ts'
import { deleteUndoDatabase } from './undo-persistence.ts'

describe('UndoManager', () => {
  let service: DatabaseService
  let manager: UndoManager

  beforeEach(async () => {
    await deleteDatabase()
    await deleteUndoDatabase()
    service = await DatabaseService.create()
    setDatabaseService(service)
    manager = await UndoManager.create()
  })

  afterEach(() => {
    service?.close()
  })

  async function restoreSnapshot(data: Uint8Array) {
    service.close()
    service = await DatabaseService.createFromData(data)
    setDatabaseService(service)
    await service.save()
  }

  it('starts with empty state', () => {
    const state = manager.getState()
    expect(state.canUndo).toBe(false)
    expect(state.canRedo).toBe(false)
    expect(state.undoLabel).toBeNull()
    expect(state.redoLabel).toBeNull()
  })

  it('captures initial state', async () => {
    await manager.captureInitialState()
    const state = manager.getState()
    expect(state.canUndo).toBe(false)
    expect(state.canRedo).toBe(false)
  })

  it('captures initial state only once', async () => {
    await manager.captureInitialState()
    await manager.captureInitialState()
    expect(manager.getTimeline()).toHaveLength(0)
  })

  it('enables undo after a mutation', async () => {
    await manager.captureInitialState()

    getDatabaseService().clubs.create({ name: 'SK Rockaden' })
    await getDatabaseService().save()
    await manager.pushState('Ny klubb', 'SK Rockaden')

    const state = manager.getState()
    expect(state.canUndo).toBe(true)
    expect(state.canRedo).toBe(false)
    expect(state.undoLabel).toBe('Ny klubb')
  })

  it('undoes a mutation', async () => {
    await manager.captureInitialState()

    getDatabaseService().clubs.create({ name: 'SK Rockaden' })
    await getDatabaseService().save()
    await manager.pushState('Ny klubb', 'SK Rockaden')

    expect(getDatabaseService().clubs.list()).toHaveLength(1)

    const snapshot = await manager.undo()
    expect(snapshot).not.toBeNull()
    await restoreSnapshot(snapshot!)

    expect(getDatabaseService().clubs.list()).toHaveLength(0)
    expect(manager.getState().canUndo).toBe(false)
    expect(manager.getState().canRedo).toBe(true)
    expect(manager.getState().redoLabel).toBe('Ny klubb')
  })

  it('redoes after undo', async () => {
    await manager.captureInitialState()

    getDatabaseService().clubs.create({ name: 'SK Rockaden' })
    await getDatabaseService().save()
    await manager.pushState('Ny klubb', 'SK Rockaden')

    const undoSnapshot = await manager.undo()
    await restoreSnapshot(undoSnapshot!)

    const redoSnapshot = await manager.redo()
    expect(redoSnapshot).not.toBeNull()
    await restoreSnapshot(redoSnapshot!)

    expect(getDatabaseService().clubs.list()).toHaveLength(1)
    expect(getDatabaseService().clubs.list()[0].name).toBe('SK Rockaden')
  })

  it('truncates redo history on new mutation after undo', async () => {
    await manager.captureInitialState()

    getDatabaseService().clubs.create({ name: 'Klubb A' })
    await getDatabaseService().save()
    await manager.pushState('Klubb A', 'Klubb A')

    getDatabaseService().clubs.create({ name: 'Klubb B' })
    await getDatabaseService().save()
    await manager.pushState('Klubb B', 'Klubb B')

    // Undo to before Klubb B
    const snapshot = await manager.undo()
    await restoreSnapshot(snapshot!)
    expect(manager.getState().canRedo).toBe(true)

    // New mutation replaces redo history
    getDatabaseService().clubs.create({ name: 'Klubb C' })
    await getDatabaseService().save()
    await manager.pushState('Klubb C', 'Klubb C')

    expect(manager.getState().canRedo).toBe(false)
    const timeline = manager.getTimeline()
    expect(timeline.map((e) => e.label)).toEqual(['Klubb A', 'Klubb C'])
  })

  it('enforces max snapshot cap', async () => {
    await manager.captureInitialState()

    // Create 55 mutations to exceed the 50 cap
    for (let i = 0; i < 55; i++) {
      getDatabaseService().clubs.create({ name: `Club ${i}` })
      await getDatabaseService().save()
      await manager.pushState(`Club ${i}`, `Club ${i}`)
    }

    const timeline = manager.getTimeline()
    // 50 max snapshots total = initial + 49 mutations (initial has no audit entry)
    // Actually: cap is 50 snapshots. We have initial (1) + 55 mutations (55) = 56 → trimmed to 50.
    // The oldest 6 are removed, so we have 49 audit entries remaining (initial has none).
    expect(timeline.length).toBeLessThanOrEqual(50)
  })

  it('handles multiple undo steps', async () => {
    await manager.captureInitialState()

    getDatabaseService().clubs.create({ name: 'A' })
    await getDatabaseService().save()
    await manager.pushState('Add A', 'A')

    getDatabaseService().clubs.create({ name: 'B' })
    await getDatabaseService().save()
    await manager.pushState('Add B', 'B')

    getDatabaseService().clubs.create({ name: 'C' })
    await getDatabaseService().save()
    await manager.pushState('Add C', 'C')

    // Undo C
    const s1 = await manager.undo()
    await restoreSnapshot(s1!)
    expect(getDatabaseService().clubs.list()).toHaveLength(2)

    // Undo B
    const s2 = await manager.undo()
    await restoreSnapshot(s2!)
    expect(getDatabaseService().clubs.list()).toHaveLength(1)

    // Undo A → back to initial
    const s3 = await manager.undo()
    await restoreSnapshot(s3!)
    expect(getDatabaseService().clubs.list()).toHaveLength(0)

    // Can't undo further
    expect(await manager.undo()).toBeNull()
  })

  it('restores to a specific snapshot', async () => {
    await manager.captureInitialState()

    getDatabaseService().clubs.create({ name: 'A' })
    await getDatabaseService().save()
    await manager.pushState('Add A', 'A')

    getDatabaseService().clubs.create({ name: 'B' })
    await getDatabaseService().save()
    await manager.pushState('Add B', 'B')

    // Restore to the first mutation (Add A)
    const timeline = manager.getTimeline()
    const firstEntry = timeline[0]
    const snapshot = await manager.restoreToSnapshot(firstEntry.snapshotIndex)
    expect(snapshot).not.toBeNull()
    await restoreSnapshot(snapshot!)

    expect(getDatabaseService().clubs.list()).toHaveLength(1)
    expect(getDatabaseService().clubs.list()[0].name).toBe('A')
  })

  it('clears all history', async () => {
    await manager.captureInitialState()

    getDatabaseService().clubs.create({ name: 'Test' })
    await getDatabaseService().save()
    await manager.pushState('Test', 'test detail')

    await manager.clear()

    expect(manager.getState().canUndo).toBe(false)
    expect(manager.getState().canRedo).toBe(false)
    expect(manager.getTimeline()).toHaveLength(0)
  })

  it('notifies subscribers on state changes', async () => {
    let notifyCount = 0
    manager.subscribe(() => notifyCount++)

    await manager.captureInitialState()
    expect(notifyCount).toBe(1)

    getDatabaseService().clubs.create({ name: 'Test' })
    await getDatabaseService().save()
    await manager.pushState('Test', 'test detail')
    expect(notifyCount).toBe(2)

    await manager.undo()
    expect(notifyCount).toBe(3)
  })

  it('unsubscribes correctly', async () => {
    let notifyCount = 0
    const unsubscribe = manager.subscribe(() => notifyCount++)

    await manager.captureInitialState()
    expect(notifyCount).toBe(1)

    unsubscribe()

    getDatabaseService().clubs.create({ name: 'Test' })
    await getDatabaseService().save()
    await manager.pushState('Test', 'test detail')
    expect(notifyCount).toBe(1) // no further notifications
  })

  it('persists state across UndoManager instances', async () => {
    await manager.captureInitialState()

    getDatabaseService().clubs.create({ name: 'Persisted' })
    await getDatabaseService().save()
    await manager.pushState('Persisted club', 'Persisted')

    // Create a new UndoManager instance (simulates page reload)
    const manager2 = await UndoManager.create()
    const state = manager2.getState()
    expect(state.canUndo).toBe(true)
    expect(state.undoLabel).toBe('Persisted club')

    const timeline = manager2.getTimeline()
    expect(timeline).toHaveLength(1)
    expect(timeline[0].label).toBe('Persisted club')
  })
})
