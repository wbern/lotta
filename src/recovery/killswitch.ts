import { nukeAndReload } from './nuke'

interface KillswitchDeps {
  location: { search: string; pathname: string; hash: string }
  swContainer: ServiceWorkerContainer | null
  cacheStorage: CacheStorage | null
  reload: () => void
  replaceUrl: (cleanUrl: string) => void
}

export async function runKillswitchIfRequested(deps: KillswitchDeps): Promise<void> {
  const params = new URLSearchParams(deps.location.search)
  if (params.get('reset') !== '1') return

  deps.replaceUrl(deps.location.pathname + deps.location.hash)

  await nukeAndReload({
    swContainer: deps.swContainer,
    cacheStorage: deps.cacheStorage,
    reload: deps.reload,
  })
}
