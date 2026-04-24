import type { DatabaseService } from '../db/database-service.ts'
import { getUndoManager } from '../db/undo-provider.ts'
import { type BroadcastAffects, dispatchBroadcast } from './broadcast-hook.ts'
import { getCurrentActor } from './peer-actor.ts'

let instance: DatabaseService | null = null

export function setDatabaseService(service: DatabaseService): void {
  instance = service
}

export function getDatabaseService(): DatabaseService {
  if (!instance) {
    throw new Error('DatabaseService not initialized. Call setDatabaseService() first.')
  }
  return instance
}

function withActor(detail: string): string {
  const actor = getCurrentActor()
  if (!actor) return detail
  if (!detail) return actor
  return `${detail} · ${actor}`
}

export async function withSave<T>(
  fn: () => T,
  label: string,
  detail: string | ((result: T) => string),
  affects?: BroadcastAffects | ((result: T) => BroadcastAffects),
): Promise<T> {
  const result = fn()
  await getDatabaseService().save()
  const resolvedDetail = typeof detail === 'function' ? detail(result) : detail
  try {
    await getUndoManager().pushState(label, withActor(resolvedDetail))
  } catch (e) {
    console.error('Undo snapshot failed:', e)
  }
  if (affects) {
    const resolved = typeof affects === 'function' ? affects(result) : affects
    void dispatchBroadcast(resolved).catch((e) => console.warn('P2P broadcast failed:', e))
  }
  return result
}
