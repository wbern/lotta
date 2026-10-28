/**
 * "Data changed" signal for the read side (ADR-0007).
 *
 * Every local write ends at DatabaseService.save(), which emits here; a P2P
 * client emits when the host tells it the shared data changed. One subscriber
 * (installDataChangedInvalidation) turns the signal into a refetch of every
 * DB-derived query, so a writer never has to know which views read its data.
 * Mirrors save-error-bus.ts (ADR-0001), the failure surface of the same path.
 */

type DataChangedListener = () => void

const listeners = new Set<DataChangedListener>()

export function subscribeDataChanged(listener: DataChangedListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function emitDataChanged(): void {
  for (const listener of listeners) {
    // The emitter is the persistence layer: a broken reader must never turn a
    // successful save into a rejected write.
    try {
      listener()
    } catch (e) {
      console.error('data-changed listener failed:', e)
    }
  }
}
