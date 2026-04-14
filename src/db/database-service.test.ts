import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DatabaseService } from './database-service.ts'
import { deleteDatabase } from './persistence.ts'

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
})
