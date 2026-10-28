import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { subscribeDataChanged } from '../lib/data-changed-bus.ts'
import { subscribeSaveError } from '../lib/save-error-bus.ts'
import { DatabaseService } from './database-service.ts'
import { deleteDatabase } from './persistence.ts'

const failNextSave = vi.hoisted(() => ({ value: false }))
vi.mock('./persistence.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./persistence.ts')>()
  return {
    ...actual,
    saveDatabase: async (data: Uint8Array) => {
      if (failNextSave.value) {
        failNextSave.value = false
        throw new Error('QuotaExceededError')
      }
      return actual.saveDatabase(data)
    },
  }
})

describe('DatabaseService', () => {
  let service: DatabaseService

  beforeEach(async () => {
    await deleteDatabase()
  })

  afterEach(() => {
    service?.close()
  })

  it('initializes and provides repository access', async () => {
    service = await DatabaseService.create()

    expect(service.clubs).toBeDefined()
    expect(service.tournaments).toBeDefined()
    expect(service.settings).toBeDefined()
    expect(service.availablePlayers).toBeDefined()
    expect(service.tournamentPlayers).toBeDefined()
    expect(service.games).toBeDefined()

    const clubs = service.clubs.list()
    expect(clubs).toEqual([])
  })

  it('persists data and restores on reload', async () => {
    service = await DatabaseService.create()
    service.clubs.create({ name: 'SK Rockaden' })
    await service.save()
    service.close()

    service = await DatabaseService.create()
    const clubs = service.clubs.list()
    expect(clubs).toHaveLength(1)
    expect(clubs[0].name).toBe('SK Rockaden')
  })

  it('exports database as Uint8Array and restores from it', async () => {
    service = await DatabaseService.create()
    service.clubs.create({ name: 'SK Rockaden' })

    const exported = service.export()
    expect(exported).toBeInstanceOf(Uint8Array)
    expect(exported.length).toBeGreaterThan(0)
    service.close()

    service = await DatabaseService.createFromData(exported)
    const clubs = service.clubs.list()
    expect(clubs).toHaveLength(1)
    expect(clubs[0].name).toBe('SK Rockaden')
  })

  describe('data-changed signal (ADR-0007)', () => {
    it('given a write, when it is saved, then readers are told the data changed', async () => {
      service = await DatabaseService.create()
      const listener = vi.fn()
      const unsubscribe = subscribeDataChanged(listener)
      service.clubs.create({ name: 'SK Rockaden' })

      await service.save()

      expect(listener).toHaveBeenCalledTimes(1)
      unsubscribe()
    })

    it('given persisting fails, when saved, then the save still rejects with a save error and readers are still told the in-memory data changed', async () => {
      service = await DatabaseService.create()
      const changed = vi.fn()
      const saveError = vi.fn()
      const unsubChanged = subscribeDataChanged(changed)
      const unsubError = subscribeSaveError(saveError)
      service.clubs.create({ name: 'SK Rockaden' })
      failNextSave.value = true

      await expect(service.save()).rejects.toThrow('QuotaExceededError')

      expect(saveError).toHaveBeenCalledTimes(1)
      expect(changed).toHaveBeenCalledTimes(1)
      unsubChanged()
      unsubError()
    })
  })
})
