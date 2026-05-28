import { describe, expect, it, vi } from 'vitest'
import { nukeAndReload } from './nuke'

describe('nukeAndReload', () => {
  it('unregisters every service worker registration before reloading', async () => {
    const unregister = vi.fn().mockResolvedValue(true)
    const swContainer = {
      getRegistrations: vi.fn().mockResolvedValue([{ unregister }, { unregister }, { unregister }]),
    }
    const reload = vi.fn()

    await nukeAndReload({
      swContainer: swContainer as unknown as ServiceWorkerContainer,
      cacheStorage: null,
      reload,
    })

    expect(unregister).toHaveBeenCalledTimes(3)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('deletes every Cache Storage entry before reloading', async () => {
    const deleteCache = vi.fn().mockResolvedValue(true)
    const cacheStorage = {
      keys: vi.fn().mockResolvedValue(['lotta-precache', 'lotta-rollback-bundles']),
      delete: deleteCache,
    }
    const reload = vi.fn()

    await nukeAndReload({
      swContainer: null,
      cacheStorage: cacheStorage as unknown as CacheStorage,
      reload,
    })

    expect(deleteCache).toHaveBeenCalledWith('lotta-precache')
    expect(deleteCache).toHaveBeenCalledWith('lotta-rollback-bundles')
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
