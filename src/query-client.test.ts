/**
 * The app's QueryClient wires ADR-0007: a write refreshes every DB-derived
 * query, and a mutation resolves only once that refresh is done — so per-call
 * onSuccess handlers (select the new tournament, pick the new club) read fresh
 * data, as they did when each hook awaited its own targeted invalidation.
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
  it('given a mounted clubs list, when a club is added through a mutation, then the list is fresh by the time the mutation resolves', async () => {
    // A read slower than the write's own bookkeeping (e.g. an RPC to the host).
    const slowListClubs = async () => {
      await new Promise((r) => setTimeout(r, 50))
      return listClubs()
    }
    const clubs = new QueryObserver(queryClient, { queryKey: ['clubs'], queryFn: slowListClubs })
    const unsubscribe = clubs.subscribe(() => {})
    await expect.poll(() => clubs.getCurrentResult().data).toEqual([])

    const mutation = new MutationObserver(queryClient, {
      mutationFn: (name: string) => addClub({ name }),
    })
    await mutation.mutate('SK Ny')

    expect(clubs.getCurrentResult().data?.map((c) => c.name)).toEqual(['SK Ny'])
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
