import type { GameDto, PlayerDto } from '../types/api'
import type { AlphabeticalPairingsPublishInput } from './html-publisher'

/**
 * Alphabetical pairings grouped by club, from a round's games and the
 * tournament's players. Pure: shared by the HTML publish (DB) and the on-screen
 * print view (data provider), so screen and paper stay consistent.
 */
export function buildAlphabeticalPairings(
  tournamentName: string,
  roundNr: number,
  games: GameDto[],
  players: PlayerDto[],
): AlphabeticalPairingsPublishInput {
  const playerById = new Map(players.map((p) => [p.id, p]))

  type PlayerRow = AlphabeticalPairingsPublishInput['classes'][number]['players'][number]
  const byGroup = new Map<string, PlayerRow[]>()

  for (const game of games) {
    const addRow = (selfId: number, opponentId: number | null, selfColor: 'V' | 'S') => {
      const self = playerById.get(selfId)
      if (!self) return
      const opponent = opponentId != null ? playerById.get(opponentId) : undefined
      const row: PlayerRow = {
        firstName: self.firstName,
        lastName: self.lastName,
        boardNr: game.boardNr,
        color: selfColor,
        opponent: opponent
          ? {
              firstName: opponent.firstName,
              lastName: opponent.lastName,
              color: selfColor === 'V' ? 'S' : 'V',
            }
          : null,
      }
      // The checkbox is labeled "Gruppera per klubb på egen sida" in both modes,
      // so group by club. Non-chess4 tournaments previously grouped by
      // playerGroup, which collapsed to a single section whenever all players
      // shared the same group — making the checkbox look broken.
      const group = self.club ?? ''
      const list = byGroup.get(group) ?? []
      list.push(row)
      byGroup.set(group, list)
    }

    if (game.whitePlayer) addRow(game.whitePlayer.id, game.blackPlayer?.id ?? null, 'V')
    if (game.blackPlayer) addRow(game.blackPlayer.id, game.whitePlayer?.id ?? null, 'S')
  }

  const classes = Array.from(byGroup.entries())
    .sort(([a], [b]) => a.localeCompare(b, 'sv'))
    .map(([className, rows]) => ({
      className,
      players: rows.sort(
        (a, b) =>
          a.firstName.localeCompare(b.firstName, 'sv') ||
          a.lastName.localeCompare(b.lastName, 'sv'),
      ),
    }))

  return { tournamentName, roundNr, classes }
}
