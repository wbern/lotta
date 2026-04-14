import type { QueryClient } from '@tanstack/react-query'

export function subscribeMutationBroadcast(
  queryClient: QueryClient,
  broadcast: () => void,
): () => void {
  return queryClient.getMutationCache().subscribe((event) => {
    if (event.type === 'updated' && event.mutation.state.status === 'success') {
      broadcast()
    }
  })
}
