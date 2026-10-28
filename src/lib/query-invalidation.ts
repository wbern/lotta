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

export interface DataChangedInvalidation {
  uninstall: () => void
  /**
   * Resolves once the refresh triggered by the latest data change has finished
   * (immediately when none is pending). Awaited by the global MutationCache so a
   * mutation still resolves after the views it affected are up to date.
   */
  whenRefreshed: () => Promise<void>
}

/**
 * Refetch every DB-derived query whenever the data changes (ADR-0007).
 *
 * Signals are coalesced per tick: a burst of writes (or a write plus the host's
 * echo) costs one invalidation. Background refetches keep the previous data, so
 * views do not flash a loading state.
 */
export function installDataChangedInvalidation(queryClient: QueryClient): DataChangedInvalidation {
  let scheduled = false
  let latest: Promise<void> = Promise.resolve()

  const uninstall = subscribeDataChanged(() => {
    if (scheduled) return
    scheduled = true
    latest = new Promise<void>((resolve) => {
      queueMicrotask(() => {
        scheduled = false
        queryClient
          .invalidateQueries({ predicate: (query) => query.meta?.source !== 'network' })
          .then(resolve, resolve)
      })
    })
  })

  return { uninstall, whenRefreshed: () => latest }
}
