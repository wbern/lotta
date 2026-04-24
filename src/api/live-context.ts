type LiveContext = {
  tournamentId: number
  round: number | null
  sharedTournamentIds?: number[]
  includeFutureTournaments?: boolean
}

let context: LiveContext | null = null

export function setLiveContext(ctx: LiveContext | null): void {
  context = ctx
}

export function getLiveContext(): LiveContext | null {
  return context
}
