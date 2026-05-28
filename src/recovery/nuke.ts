interface SwDeps {
  swContainer: ServiceWorkerContainer | null
}

interface CacheDeps {
  cacheStorage: CacheStorage | null
}

interface NukeDeps extends SwDeps, CacheDeps {
  reload: () => void
}

export async function unregisterSWs(deps: SwDeps): Promise<void> {
  if (!deps.swContainer) return
  const registrations = await deps.swContainer.getRegistrations()
  await Promise.all(registrations.map((r) => r.unregister()))
}

export async function clearCaches(deps: CacheDeps): Promise<void> {
  if (!deps.cacheStorage) return
  const keys = await deps.cacheStorage.keys()
  await Promise.all(keys.map((k) => deps.cacheStorage!.delete(k)))
}

export async function nukeAndReload(deps: NukeDeps): Promise<void> {
  await unregisterSWs(deps)
  await clearCaches(deps)
  deps.reload()
}
