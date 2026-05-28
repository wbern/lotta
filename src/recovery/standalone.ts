interface StandaloneDeps {
  userAgent: string
  matchMedia: ((q: string) => MediaQueryList) | null
  navigatorStandalone: boolean | undefined
}

export function isIosStandalone(deps: StandaloneDeps): boolean {
  const isIos =
    /iPad|iPhone|iPod/.test(deps.userAgent) ||
    (/Macintosh/.test(deps.userAgent) && deps.navigatorStandalone !== undefined)
  if (!isIos) return false
  if (deps.navigatorStandalone === true) return true
  if (deps.matchMedia) {
    try {
      return deps.matchMedia('(display-mode: standalone)').matches
    } catch {
      return false
    }
  }
  return false
}
