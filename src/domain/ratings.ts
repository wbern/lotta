import type { PlayerDto } from '../types/api.ts'

export function getPlayerRating(player: PlayerDto, ratingChoice: string): number {
  switch (ratingChoice) {
    case 'ELO':
      return player.ratingI
    case 'QUICK':
      return player.ratingQ
    case 'BLITZ':
      return player.ratingB
    case 'QUICK_THEN_ELO':
      return player.ratingQ > 0 ? player.ratingQ : player.ratingI
    case 'BLITZ_THEN_ELO':
      return player.ratingB > 0 ? player.ratingB : player.ratingI
    default:
      return player.ratingN
  }
}
