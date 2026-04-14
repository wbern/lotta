import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { subscribeMutationBroadcast } from './mutation-broadcast'

describe('subscribeMutationBroadcast', () => {
  it('calls broadcast when a mutation succeeds', async () => {
    const queryClient = new QueryClient()
    const broadcast = vi.fn()

    subscribeMutationBroadcast(queryClient, broadcast)

    await queryClient
      .getMutationCache()
      .build(queryClient, {
        mutationFn: () => Promise.resolve('ok'),
      })
      .execute(undefined)

    expect(broadcast).toHaveBeenCalledOnce()
  })

  it('does not call broadcast when a mutation fails', async () => {
    const queryClient = new QueryClient()
    const broadcast = vi.fn()

    subscribeMutationBroadcast(queryClient, broadcast)

    try {
      await queryClient
        .getMutationCache()
        .build(queryClient, {
          mutationFn: () => Promise.reject(new Error('fail')),
        })
        .execute(undefined)
    } catch {
      // expected
    }

    expect(broadcast).not.toHaveBeenCalled()
  })

  it('returns an unsubscribe function that stops broadcasting', async () => {
    const queryClient = new QueryClient()
    const broadcast = vi.fn()

    const unsubscribe = subscribeMutationBroadcast(queryClient, broadcast)

    await queryClient
      .getMutationCache()
      .build(queryClient, {
        mutationFn: () => Promise.resolve('ok'),
      })
      .execute(undefined)
    expect(broadcast).toHaveBeenCalledOnce()

    unsubscribe()

    await queryClient
      .getMutationCache()
      .build(queryClient, {
        mutationFn: () => Promise.resolve('ok2'),
      })
      .execute(undefined)
    expect(broadcast).toHaveBeenCalledOnce() // Still 1
  })
})
