function getSpectatorUrl(roomCode: string): string {
  const url = new URL(`${window.location.origin}${import.meta.env.BASE_URL}live/${roomCode}`)
  if (__COMMIT_HASH__) url.searchParams.set('v', __COMMIT_HASH__)
  return url.toString()
}

export function getKioskUrl(roomCode: string): string {
  const url = new URL(getSpectatorUrl(roomCode))
  url.searchParams.set('kiosk', 'true')
  return url.toString()
}

export function getShareUrl(roomCode: string, token: string): string {
  const url = new URL(getSpectatorUrl(roomCode))
  url.searchParams.set('share', 'full')
  url.searchParams.set('token', token)
  return url.toString()
}

export function getViewUrl(roomCode: string, token: string): string {
  const url = new URL(getSpectatorUrl(roomCode))
  url.searchParams.set('share', 'view')
  url.searchParams.set('token', token)
  return url.toString()
}
