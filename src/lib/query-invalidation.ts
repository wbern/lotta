import type { QueryClient } from '@tanstack/react-query'
import { subscribeDataChanged } from './data-changed-bus'

/**
 * Queries whose data does not come from the tournament database opt out of the
 * data-changed refetch with `meta: { source: 'network' }` (e.g. versions.json).
 */
declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: { source?: 'network' }
  }
}

/**
 * Refetch every DB-derived query whenever the data changes (ADR-0007).
 *
 * Signals are coalesced per tick: a burst of writes (or a write plus the host's
 * echo) costs one invalidation. Background refetches keep the previous data, so
 * views do not flash a loading state. Returns the unsubscribe function.
 */
export function installDataChangedInvalidation(queryClient: QueryClient): () => void {
  let scheduled = false
  return subscribeDataChanged(() => {
    if (scheduled) return
    scheduled = true
    queueMicrotask(() => {
      scheduled = false
      void queryClient.invalidateQueries({
        predicate: (query) => query.meta?.source !== 'network',
      })
    })
  })
}
