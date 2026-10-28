import { MutationCache, QueryClient } from '@tanstack/react-query'
import {
  type DataChangedInvalidation,
  installDataChangedInvalidation,
} from './lib/query-invalidation'

let invalidation: DataChangedInvalidation | null = null

export const queryClient = new QueryClient({
  // A mutation resolves only after the views its write changed have refetched,
  // so `onSuccess` callers (navigate to the new tournament, select the new club)
  // see fresh data — as they did when each hook awaited its own invalidation.
  mutationCache: new MutationCache({
    onSuccess: () => invalidation?.whenRefreshed(),
  }),
  defaultOptions: {
    queries: {
      staleTime: 5000,
      refetchOnWindowFocus: false,
      networkMode: 'always',
    },
    mutations: {
      networkMode: 'always',
    },
  },
})

// Every write refreshes every DB-derived view (ADR-0007). Installed with the
// client itself so no entry point can end up with a cache that never refreshes.
invalidation = installDataChangedInvalidation(queryClient)
