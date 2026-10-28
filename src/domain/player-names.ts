/**
 * Suffix Java Lotta's Player.toString appends to a withdrawn player's name in
 * standings ("%s (utgått r%d)"), regardless of which round is being viewed.
 * Values < 1 (-1, legacy 0) mean "not withdrawn".
 */
export function withdrawnSuffix(withdrawnFromRound: number): string {
  return withdrawnFromRound >= 1 ? ` (utgått r${withdrawnFromRound})` : ''
}
