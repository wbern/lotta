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
// Errors already surfaced by the save-error toast, so flow-specific handlers
// that toast a rejection's message don't show the same failure twice.
const announced = new WeakSet<object>()

export function subscribeSaveError(listener: SaveErrorListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function emitSaveError(error: unknown): void {
  if (typeof error === 'object' && error !== null) announced.add(error)
  for (const listener of listeners) listener(error)
}

/**
 * Message for a flow-specific error toast on a rejected action, or null when the
 * rejection is a save failure the shared save-error toast already reported.
 */
export function actionErrorMessage(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && announced.has(error)) return null
  return error instanceof Error ? error.message : String(error)
}
