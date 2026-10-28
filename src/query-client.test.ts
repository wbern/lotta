/**
 * The app's QueryClient wires ADR-0007: a write refreshes every mounted
 * DB-derived query without any per-site invalidation — and a mutation does not
 * wait for that refresh, so one failing query cannot hold up result entry.
 */
import { MutationObserver, QueryObserver } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setLocalProviderFactory } from './api/active-provider'
import { addClub, listClubs } from './api/clubs'
import { getLocalProvider } from './api/local-data-provider'
import { getDatabaseService, setDatabaseService } from './api/service-provider'
import { DatabaseService } from './db/database-service'
import { deleteDatabase } from './db/persistence'
import { UndoManager } from './db/undo-manager'
import { deleteUndoDatabase } from './db/undo-persistence'
import { setUndoManager } from './db/undo-provider'
import { queryClient } from './query-client'

beforeEach(async () => {
  await deleteDatabase()
  await deleteUndoDatabase()
  setDatabaseService(await DatabaseService.create())
  const manager = await UndoManager.create()
  setUndoManager(manager)
  await manager.captureInitialState()
  setLocalProviderFactory(() => getLocalProvider())
})

afterEach(async () => {
  queryClient.clear()
  getDatabaseService().close()
  await deleteDatabase()
  await deleteUndoDatabase()
})

describe('queryClient', () => {
  it('given a mounted clubs list, when a club is added through a mutation, then the list refetches with it', async () => {
    const clubs = new QueryObserver(queryClient, { queryKey: ['clubs'], queryFn: listClubs })
    const unsubscribe = clubs.subscribe(() => {})
    await expect.poll(() => clubs.getCurrentResult().data).toEqual([])

    const mutation = new MutationObserver(queryClient, {
      mutationFn: (name: string) => addClub({ name }),
    })
    await mutation.mutate('SK Ny')

    await expect.poll(() => clubs.getCurrentResult().data?.map((c) => c.name)).toEqual(['SK Ny'])
    unsubscribe()
  })

  // Found by the P2P tier: a referee's grant cannot read the player pool, so
  // that (long-mounted) query fails and retries with backoff after every write.
  // When mutations awaited the refresh, each serialized result entry waited
  // seconds behind it and most of a round's results never got entered.
  it('given a mounted query that keeps failing, when a mutation writes, then it resolves without waiting for the retries', async () => {
    const failing = new QueryObserver(queryClient, {
      queryKey: ['players'],
      queryFn: () => Promise.reject(new Error('Permission denied: poolPlayers.list')),
      retry: 3,
      retryDelay: 1000,
    })
    const unsubscribe = failing.subscribe(() => {})
    const mutation = new MutationObserver(queryClient, {
      mutationFn: (name: string) => addClub({ name }),
    })

    const outcome = await Promise.race([
      mutation.mutate('SK Ny').then(() => 'resolved'),
      new Promise((r) => setTimeout(() => r('still waiting'), 500)),
    ])

    expect(outcome).toBe('resolved')
    unsubscribe()
  })
})

describe('queryClient defaults', () => {
  it('queries default to networkMode "always" so navigator.onLine cannot pause them', () => {
    const defaults = queryClient.getDefaultOptions()
    expect(defaults.queries?.networkMode).toBe('always')
  })

  it('mutations default to networkMode "always" so writes never silently queue', () => {
    const defaults = queryClient.getDefaultOptions()
    expect(defaults.mutations?.networkMode).toBe('always')
  })
})
