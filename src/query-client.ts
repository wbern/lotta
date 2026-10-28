import { QueryClient } from '@tanstack/react-query'
import { installDataChangedInvalidation } from './lib/query-invalidation'

export const queryClient = new QueryClient({
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
// Mutations do not wait for that refresh: one failing query (retrying with
// backoff) would otherwise hold every serialized result entry behind it.
installDataChangedInvalidation(queryClient)
