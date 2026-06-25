/**
 * Shared failure surface for the write path (ADR-0001).
 *
 * Every database write ends at DatabaseService.save() -> saveDatabase() ->
 * IndexedDB put(). When that rejects (blocked storage / out of quota), save()
 * emits here and re-throws. A single UI subscriber turns the event into a toast,
 * so no failed write is ever silent — regardless of which call site triggered it
 * (React Query mutation, imperative withSave, undo/redo, restore).
 */

type SaveErrorListener = (error: unknown) => void

const listeners = new Set<SaveErrorListener>()

export function subscribeSaveError(listener: SaveErrorListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function emitSaveError(error: unknown): void {
  for (const listener of listeners) listener(error)
}
