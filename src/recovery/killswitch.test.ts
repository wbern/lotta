import { describe, expect, it, vi } from 'vitest'
import { runKillswitchIfRequested } from './killswitch'

function buildDeps(overrides: Partial<Parameters<typeof runKillswitchIfRequested>[0]> = {}) {
  return {
    location: { search: '', pathname: '/', hash: '' },
    swContainer: null,
    cacheStorage: null,
    reload: vi.fn(),
    replaceUrl: vi.fn(),
    ...overrides,
  }
}

describe('runKillswitchIfRequested', () => {
  it('does nothing when the reset=1 query param is absent', async () => {
    const deps = buildDeps({ location: { search: '?other=foo', pathname: '/', hash: '' } })

    await runKillswitchIfRequested(deps)

    expect(deps.reload).not.toHaveBeenCalled()
    expect(deps.replaceUrl).not.toHaveBeenCalled()
  })

  it('when reset=1 is present: unregisters SWs, clears caches, replaces the URL without the param, then reloads', async () => {
    const unregister = vi.fn().mockResolvedValue(true)
    const swContainer = {
      getRegistrations: vi.fn().mockResolvedValue([{ unregister }, { unregister }]),
    }
    const deleteCache = vi.fn().mockResolvedValue(true)
    const cacheStorage = {
      keys: vi.fn().mockResolvedValue(['lotta-precache-v1', 'workbox-runtime']),
      delete: deleteCache,
    }
    const deps = buildDeps({
      location: { search: '?reset=1', pathname: '/foo', hash: '#bar' },
      swContainer: swContainer as unknown as ServiceWorkerContainer,
      cacheStorage: cacheStorage as unknown as CacheStorage,
    })

    await runKillswitchIfRequested(deps)

    expect(unregister).toHaveBeenCalledTimes(2)
    expect(deleteCache).toHaveBeenCalledWith('lotta-precache-v1')
    expect(deleteCache).toHaveBeenCalledWith('workbox-runtime')
    expect(deps.replaceUrl).toHaveBeenCalledWith('/foo#bar')
    expect(deps.reload).toHaveBeenCalledTimes(1)
  })
})
