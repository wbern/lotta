export interface CacheInfo {
  name: string
  entryCount: number
}

export interface StorageInfo {
  quota?: number
  usage?: number
  usageDetails?: Record<string, number>
}

export interface Diagnostics {
  version: string
  commit: string
  userAgent: string
  timestamp: string
  swCount: number
  swScopes: string[]
  caches: CacheInfo[]
  storage: StorageInfo | null
}

interface GatherDeps {
  version: string
  commit: string
  userAgent: string
  now: () => Date
  swContainer: ServiceWorkerContainer | null
  cacheStorage: CacheStorage | null
  storageManager: StorageManager | null
}

async function listSwScopes(container: ServiceWorkerContainer | null): Promise<string[]> {
  if (!container) return []
  try {
    const regs = await container.getRegistrations()
    return regs.map((r) => r.scope)
  } catch {
    return []
  }
}

async function listCaches(storage: CacheStorage | null): Promise<CacheInfo[]> {
  if (!storage) return []
  try {
    const names = await storage.keys()
    return await Promise.all(
      names.map(async (name) => {
        try {
          const cache = await storage.open(name)
          const keys = await cache.keys()
          return { name, entryCount: keys.length }
        } catch {
          return { name, entryCount: 0 }
        }
      }),
    )
  } catch {
    return []
  }
}

async function readStorage(manager: StorageManager | null): Promise<StorageInfo | null> {
  if (!manager) return null
  try {
    const estimate = await manager.estimate()
    return estimate
  } catch {
    return null
  }
}

export async function gatherDiagnostics(deps: GatherDeps): Promise<Diagnostics> {
  const [swScopes, caches, storage] = await Promise.all([
    listSwScopes(deps.swContainer),
    listCaches(deps.cacheStorage),
    readStorage(deps.storageManager),
  ])
  return {
    version: deps.version,
    commit: deps.commit,
    userAgent: deps.userAgent,
    timestamp: deps.now().toISOString(),
    swCount: swScopes.length,
    swScopes,
    caches,
    storage,
  }
}
