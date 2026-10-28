import { DatabaseService } from '../db/database-service'
import { stripModernColumns } from '../db/legacy-export'
import { getUndoManager } from '../db/undo-provider'
import { decryptData, encryptData, isEncryptedBackup } from '../domain/backup-encryption'
import { dispatchBroadcast } from './broadcast-hook'
import { getDatabaseService, setDatabaseService } from './service-provider'

export class EncryptedBackupError extends Error {
  constructor() {
    super('ENCRYPTED')
    this.name = 'EncryptedBackupError'
  }
}

export async function downloadBackup(): Promise<Blob> {
  const data = getDatabaseService().export()
  return new Blob([data.buffer as ArrayBuffer], { type: 'application/x-sqlite3' })
}

export async function downloadLegacyBackup(): Promise<Blob> {
  const data = getDatabaseService().export()
  const stripped = await stripModernColumns(data)
  return new Blob([stripped.buffer as ArrayBuffer], { type: 'application/x-sqlite3' })
}

export async function downloadEncryptedBackup(
  password: string,
  legacyCompat = false,
): Promise<Blob> {
  const raw = getDatabaseService().export()
  const data = legacyCompat ? await stripModernColumns(raw) : raw
  const encrypted = await encryptData(data, password)
  return new Blob([encrypted.buffer as ArrayBuffer], { type: 'application/octet-stream' })
}

export async function restoreBackup(file: File, password?: string): Promise<void> {
  const arrayBuffer = await file.arrayBuffer()
  let data: Uint8Array = new Uint8Array(arrayBuffer)

  if (isEncryptedBackup(data)) {
    if (!password) {
      throw new EncryptedBackupError()
    }
    data = await decryptData(data, password)
  }

  // Parse the file BEFORE touching the live database or the undo history:
  // a corrupt file must leave everything exactly as it was.
  const newService = await DatabaseService.createFromData(data)

  // Snapshot the current data first so the restore can be undone.
  await pushUndoState('Före återställning', file.name)

  const oldService = getDatabaseService()
  oldService.close()
  setDatabaseService(newService)
  await newService.save()

  await pushUndoState('Återställ databas', file.name)

  void dispatchBroadcast({ kind: 'restore' }).catch((e) =>
    console.warn('P2P broadcast failed after backup restore:', e),
  )
}

// Like withSave: a failing undo snapshot (e.g. storage quota) must not block the restore.
async function pushUndoState(label: string, detail: string): Promise<void> {
  try {
    await getUndoManager().pushState(label, detail)
  } catch (e) {
    console.error('Undo snapshot failed:', e)
  }
}
