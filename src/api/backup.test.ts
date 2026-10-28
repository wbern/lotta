import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DatabaseService } from '../db/database-service.ts'
import { initDatabase } from '../db/db.ts'
import { deleteDatabase } from '../db/persistence.ts'
import { UndoManager } from '../db/undo-manager.ts'
import { deleteUndoDatabase } from '../db/undo-persistence.ts'
import { getUndoManager, setUndoManager } from '../db/undo-provider.ts'
import {
  downloadBackup,
  downloadEncryptedBackup,
  downloadLegacyBackup,
  EncryptedBackupError,
  restoreBackup,
} from './backup.ts'
import { setBroadcastHook } from './broadcast-hook.ts'
import { getDatabaseService, setDatabaseService } from './service-provider.ts'
import { redoLocal, undoLocal } from './undo.ts'

describe('backup API (local)', () => {
  let service: DatabaseService

  beforeEach(async () => {
    service = await DatabaseService.create()
    setDatabaseService(service)
  })

  afterEach(async () => {
    getDatabaseService().close()
    await deleteDatabase()
  })

  it('downloads backup as a Blob', async () => {
    service.clubs.create({ name: 'SK Lund' })
    service.clubs.create({ name: 'SK Malmö' })

    const blob = await downloadBackup()
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
    expect(blob.type).toBe('application/x-sqlite3')
  })

  it('restores from a backup file', async () => {
    // Create some data
    service.clubs.create({ name: 'SK Lund' })
    const t = service.tournaments.create({
      name: 'Backup Test',
      group: 'A',
      pairingSystem: 'Monrad',
      initialPairing: 'Slumpad',
      nrOfRounds: 7,
      barredPairing: false,
      compensateWeakPlayerPP: false,
      pointsPerGame: 1,
      chess4: false,
      ratingChoice: 'ELO',
      showELO: true,
      showGroup: true,
    })

    // Download backup
    const blob = await downloadBackup()

    // Wipe the database
    service.clubs.delete(service.clubs.list()[0].id)
    service.tournaments.delete(t.id)
    expect(service.clubs.list()).toHaveLength(0)
    expect(service.tournaments.list()).toHaveLength(0)

    // Restore from backup
    const file = new File([blob], 'backup.db', {
      type: 'application/x-sqlite3',
    })
    await restoreBackup(file)

    // Verify data is restored
    const db = getDatabaseService()
    const clubs = db.clubs.list()
    expect(clubs).toHaveLength(1)
    expect(clubs[0].name).toBe('SK Lund')

    const tournaments = db.tournaments.list()
    expect(tournaments).toHaveLength(1)
    expect(tournaments[0].name).toBe('Backup Test')
  })

  it('backup roundtrip preserves tournament players', async () => {
    const club = service.clubs.create({ name: 'SK Norrköping' })
    const t = service.tournaments.create({
      name: 'Player Test',
      group: 'A',
      pairingSystem: 'Monrad',
      initialPairing: 'Slumpad',
      nrOfRounds: 7,
      barredPairing: false,
      compensateWeakPlayerPP: false,
      pointsPerGame: 1,
      chess4: false,
      ratingChoice: 'ELO',
      showELO: true,
      showGroup: true,
    })
    service.tournamentPlayers.add(t.id, {
      lastName: 'Andersson',
      firstName: 'Anna',
      ratingI: 1800,
      clubIndex: club.id,
    })

    // Backup and restore
    const blob = await downloadBackup()
    const file = new File([blob], 'backup.db')
    await restoreBackup(file)

    // Verify
    const db = getDatabaseService()
    const players = db.tournamentPlayers.list(t.id)
    expect(players).toHaveLength(1)
    expect(players[0].lastName).toBe('Andersson')
    expect(players[0].club).toBe('SK Norrköping')
  })

  it('encrypted backup roundtrip preserves data', async () => {
    service.clubs.create({ name: 'SK Uppsala' })

    const blob = await downloadEncryptedBackup('secret123')
    expect(blob.type).toBe('application/octet-stream')

    const file = new File([blob], 'backup.sqlite.enc')
    await restoreBackup(file, 'secret123')

    const db = getDatabaseService()
    const clubs = db.clubs.list()
    expect(clubs).toHaveLength(1)
    expect(clubs[0].name).toBe('SK Uppsala')
  })

  it('throws EncryptedBackupError when restoring encrypted backup without password', async () => {
    service.clubs.create({ name: 'SK Gävle' })

    const blob = await downloadEncryptedBackup('secret')
    const file = new File([blob], 'backup.sqlite.enc')

    await expect(restoreBackup(file)).rejects.toBeInstanceOf(EncryptedBackupError)
  })

  it('throws non-EncryptedBackupError when password is wrong', async () => {
    service.clubs.create({ name: 'SK Gävle' })

    const blob = await downloadEncryptedBackup('correct-password')
    const file = new File([blob], 'backup.sqlite.enc')

    const error = await restoreBackup(file, 'wrong-password').catch((e: unknown) => e)
    expect(error).toBeDefined()
    expect(error).not.toBeInstanceOf(EncryptedBackupError)
  })

  it('legacy backup omits the modern tournamentplayers columns', async () => {
    service.clubs.create({ name: 'SK Lund' })
    const t = service.tournaments.create({
      name: 'Legacy Test',
      group: 'A',
      pairingSystem: 'Monrad',
      initialPairing: 'Slumpad',
      nrOfRounds: 7,
      barredPairing: false,
      compensateWeakPlayerPP: false,
      pointsPerGame: 1,
      chess4: false,
      ratingChoice: 'ELO',
      showELO: true,
      showGroup: true,
    })
    service.tournamentPlayers.add(t.id, { lastName: 'Andersson', firstName: 'Erik' })

    const blob = await downloadLegacyBackup()
    expect(blob.type).toBe('application/x-sqlite3')

    const bytes = new Uint8Array(await blob.arrayBuffer())
    const db = await initDatabase(bytes)
    const cols = db.exec('PRAGMA table_info(tournamentplayers)')
    const names = new Set<string>(cols[0]?.values.map((r) => r[1] as string) ?? [])
    db.close()
    expect(names.has('addedatround')).toBe(false)
    expect(names.has('protectfrombyeindebut')).toBe(false)
    // Sanity: the row data still survives.
    expect(names.has('lastname')).toBe(true)
  })
})

describe('restoreBackup undo history', () => {
  let service: DatabaseService
  let manager: UndoManager

  const clubNames = () =>
    getDatabaseService()
      .clubs.list()
      .map((c) => c.name)

  async function backupFileWithClub(name: string): Promise<File> {
    service.clubs.create({ name })
    const blob = await downloadBackup()
    service.clubs.delete(service.clubs.list().find((c) => c.name === name)!.id)
    return new File([blob], 'lotta-backup-2026-10-28-1430.sqlite')
  }

  beforeEach(async () => {
    await deleteUndoDatabase()
    service = await DatabaseService.create()
    setDatabaseService(service)
    manager = await UndoManager.create()
    setUndoManager(manager)
  })

  afterEach(async () => {
    setBroadcastHook(null)
    getDatabaseService().close()
    await deleteDatabase()
    await deleteUndoDatabase()
  })

  it('given existing data, when a backup is restored, then the history records the state before and after the restore', async () => {
    const file = await backupFileWithClub('SK Restored')
    service.clubs.create({ name: 'SK Before' })
    await manager.captureInitialState()

    await restoreBackup(file)

    const timeline = getUndoManager().getTimeline()
    expect(timeline.map((e) => e.label)).toEqual(['Före återställning', 'Återställ databas'])
    expect(timeline.map((e) => e.detail)).toEqual([file.name, file.name])
    expect(getUndoManager().getState().canUndo).toBe(true)
    expect(getUndoManager().getState().canRedo).toBe(false)
  })

  it('given a restored backup, when the arbiter undoes and redoes, then the pre-restore data comes back and the restore re-applies', async () => {
    const file = await backupFileWithClub('SK Restored')
    service.clubs.create({ name: 'SK Before' })
    await manager.captureInitialState()
    await restoreBackup(file)
    expect(clubNames()).toEqual(['SK Restored'])

    expect(await undoLocal()).toBe(true)
    expect(clubNames()).toEqual(['SK Before'])

    expect(await redoLocal()).toBe(true)
    expect(clubNames()).toEqual(['SK Restored'])
  })

  it('given a corrupt file, when restoring, then the history and the active database are unchanged', async () => {
    service.clubs.create({ name: 'SK Before' })
    await manager.captureInitialState()
    await manager.pushState('Ny klubb', 'SK Before')
    const timelineBefore = getUndoManager().getTimeline()
    const corrupt = new File([new Uint8Array(4096).fill(7)], 'broken.sqlite')

    await expect(restoreBackup(corrupt)).rejects.toThrow()

    expect(getUndoManager().getTimeline()).toEqual(timelineBefore)
    expect(getDatabaseService()).toBe(service)
    expect(clubNames()).toEqual(['SK Before'])
  })

  it('given an encrypted backup, when the password is wrong, then no history entry is added', async () => {
    service.clubs.create({ name: 'SK Before' })
    await manager.captureInitialState()
    const blob = await downloadEncryptedBackup('correct-password')
    const file = new File([blob], 'backup.sqlite.enc')

    await expect(restoreBackup(file, 'wrong-password')).rejects.toThrow()

    expect(getUndoManager().getTimeline()).toHaveLength(0)
    expect(getDatabaseService()).toBe(service)
  })

  it('given a P2P broadcast hook, when a backup is restored, then peers are told the whole database changed', async () => {
    const hook = vi.fn().mockResolvedValue(undefined)
    setBroadcastHook(hook)
    const file = await backupFileWithClub('SK Restored')

    await restoreBackup(file)

    expect(hook).toHaveBeenCalledWith({ kind: 'restore' })
  })
})
