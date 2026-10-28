import { sv } from '../lib/swedish-text.ts'
import type { PlayerDto } from '../types/api.ts'

/** Stored rating-choice codes: Java Lotta's RatingChoice enum names. */
export const RATING_CHOICE_CODES = [
  'ELO',
  'QUICK',
  'BLITZ',
  'QUICK_THEN_ELO',
  'BLITZ_THEN_ELO',
] as const

type RatingChoiceCode = (typeof RATING_CHOICE_CODES)[number]

export const RATING_CHOICE_LABELS: Record<RatingChoiceCode, string> = {
  ELO: sv.ratingChoices.elo,
  QUICK: sv.ratingChoices.rapidElo,
  BLITZ: sv.ratingChoices.blitzElo,
  QUICK_THEN_ELO: sv.ratingChoices.rapidOrElo,
  BLITZ_THEN_ELO: sv.ratingChoices.blitzOrElo,
}

/**
 * Up to v1.23 the tournament dialog saved the Swedish label instead of the
 * code, so every choice but ELO fell through to the (unused) national rating
 * and all ratings read as 0. Map labels back to codes; anything unknown is ELO.
 */
export function normaliseRatingChoice(value: string | null | undefined): RatingChoiceCode {
  if ((RATING_CHOICE_CODES as readonly string[]).includes(value ?? '')) {
    return value as RatingChoiceCode
  }
  const fromLabel = RATING_CHOICE_CODES.find((code) => RATING_CHOICE_LABELS[code] === value)
  return fromLabel ?? 'ELO'
}

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
