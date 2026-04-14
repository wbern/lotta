import { DatabaseService } from '../db/database-service'
import { getUndoManager } from '../db/undo-provider'
import { getDatabaseService, setDatabaseService } from './service-provider'

async function restoreFromSnapshot(data: Uint8Array): Promise<void> {
  const oldService = getDatabaseService()
  oldService.close()

  const newService = await DatabaseService.createFromData(data)
  setDatabaseService(newService)
  await newService.save()
}

export async function undo(): Promise<boolean> {
  const snapshot = await getUndoManager().undo()
  if (!snapshot) return false
  await restoreFromSnapshot(snapshot)
  return true
}

export async function redo(): Promise<boolean> {
  const snapshot = await getUndoManager().redo()
  if (!snapshot) return false
  await restoreFromSnapshot(snapshot)
  return true
}

export async function restoreToPoint(snapshotIndex: number): Promise<boolean> {
  const snapshot = await getUndoManager().restoreToSnapshot(snapshotIndex)
  if (!snapshot) return false
  await restoreFromSnapshot(snapshot)
  return true
}
