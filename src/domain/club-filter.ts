import type { GameDto, PlayerSummaryDto } from '../types/api'

export const CLUBLESS_KEY = '__CLUBLESS__'

function isPlayerAuthorized(player: { club: string | null } | null, clubSet: Set<string>): boolean {
  if (!player) return false
  if (player.club != null) return clubSet.has(player.club)
  return clubSet.has(CLUBLESS_KEY)
}

export function filterGamesByClubs(games: GameDto[], clubs: string[]): GameDto[] {
  const clubSet = new Set(clubs)
  return games.filter(
    (g) => isPlayerAuthorized(g.whitePlayer, clubSet) || isPlayerAuthorized(g.blackPlayer, clubSet),
  )
}

export function redactPlayerName(
  player: PlayerSummaryDto | null,
  authorizedClubs: string[],
  firstNameMap: Map<number, string>,
): string {
  if (!player) return 'BYE'
  const clubSet = new Set(authorizedClubs)
  if (isPlayerAuthorized(player, clubSet)) {
    return player.name
  }
  return firstNameMap.get(player.id) ?? player.name.split(' ')[0]
}
