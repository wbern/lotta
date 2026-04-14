import type { UndoManager } from './undo-manager.ts'

let instance: UndoManager | null = null

export function setUndoManager(manager: UndoManager): void {
  instance = manager
}

export function getUndoManager(): UndoManager {
  if (!instance) {
    throw new Error('UndoManager not initialized. Call setUndoManager() first.')
  }
  return instance
}
