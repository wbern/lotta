import { describe, expect, it, vi } from 'vitest'
import { gatherDiagnostics } from './diagnostics'

function buildDeps(overrides: Partial<Parameters<typeof gatherDiagnostics>[0]> = {}) {
  return {
    version: 'v1.2.3',
    commit: 'abc1234',
    userAgent: 'Mozilla/5.0',
    now: () => new Date('2026-05-28T10:00:00Z'),
    swContainer: null,
    cacheStorage: null,
    storageManager: null,
    ...overrides,
  }
}

describe('gatherDiagnostics', () => {
  it('returns version, commit, userAgent and timestamp without browser APIs', async () => {
    const result = await gatherDiagnostics(buildDeps())

    expect(result.version).toBe('v1.2.3')
    expect(result.commit).toBe('abc1234')
    expect(result.userAgent).toBe('Mozilla/5.0')
    expect(result.timestamp).toBe('2026-05-28T10:00:00.000Z')
  })

  it('reports zero service workers when swContainer is missing', async () => {
    const result = await gatherDiagnostics(buildDeps({ swContainer: null }))

    expect(result.swCount).toBe(0)
    expect(result.swScopes).toEqual([])
  })

  it('lists service worker scopes when swContainer.getRegistrations returns regs', async () => {
    const swContainer = {
      getRegistrations: vi
        .fn()
        .mockResolvedValue([{ scope: 'https://lotta.app/' }, { scope: 'https://lotta.app/sub/' }]),
    } as unknown as ServiceWorkerContainer

    const result = await gatherDiagnostics(buildDeps({ swContainer }))

    expect(result.swCount).toBe(2)
    expect(result.swScopes).toEqual(['https://lotta.app/', 'https://lotta.app/sub/'])
  })

  it('lists cache names with entry counts when cacheStorage is available', async () => {
    const cacheAKeys = vi.fn().mockResolvedValue([{}, {}, {}])
    const cacheBKeys = vi.fn().mockResolvedValue([{}])
    const cacheStorage = {
      keys: vi.fn().mockResolvedValue(['cache-a', 'cache-b']),
      open: vi.fn((name: string) =>
        Promise.resolve({ keys: name === 'cache-a' ? cacheAKeys : cacheBKeys }),
      ),
    } as unknown as CacheStorage

    const result = await gatherDiagnostics(buildDeps({ cacheStorage }))

    expect(result.caches).toEqual([
      { name: 'cache-a', entryCount: 3 },
      { name: 'cache-b', entryCount: 1 },
    ])
  })

  it('reports storage estimate when storageManager is available', async () => {
    const storageManager = {
      estimate: vi.fn().mockResolvedValue({ quota: 1000, usage: 200 }),
    } as unknown as StorageManager

    const result = await gatherDiagnostics(buildDeps({ storageManager }))

    expect(result.storage).toEqual({ quota: 1000, usage: 200 })
  })

  it('returns null storage estimate gracefully when the API throws', async () => {
    const storageManager = {
      estimate: vi.fn().mockRejectedValue(new Error('SecurityError')),
    } as unknown as StorageManager

    const result = await gatherDiagnostics(buildDeps({ storageManager }))

    expect(result.storage).toBeNull()
  })
})
