interface NukeDeps {
  swContainer: ServiceWorkerContainer | null
  cacheStorage: CacheStorage | null
  reload: () => void
}

export async function nukeAndReload(deps: NukeDeps): Promise<void> {
  if (deps.swContainer) {
    const registrations = await deps.swContainer.getRegistrations()
    await Promise.all(registrations.map((r) => r.unregister()))
  }
  if (deps.cacheStorage) {
    const keys = await deps.cacheStorage.keys()
    await Promise.all(keys.map((k) => deps.cacheStorage!.delete(k)))
  }
  deps.reload()
}
