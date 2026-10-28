/**
 * Suffix Java Lotta's Player.toString appends to a withdrawn player's name in
 * standings ("%s (utgått r%d)"), regardless of which round is being viewed.
 * Values < 1 (-1, legacy 0) mean "not withdrawn".
 */
export function withdrawnSuffix(withdrawnFromRound: number): string {
  return withdrawnFromRound >= 1 ? ` (utgått r${withdrawnFromRound})` : ''
}

const swedishCollator = new Intl.Collator('sv')

/** Compare two strings in Swedish alphabetical order (… X, Y, Z, Å, Ä, Ö; case-insensitive first). */
export function compareSwedish(a: string, b: string): number {
  return swedishCollator.compare(a, b)
}

/** Order players by last name, then first name, in Swedish alphabetical order. */
export function compareSwedishNames(
  aLast: string,
  aFirst: string,
  bLast: string,
  bFirst: string,
): number {
  return compareSwedish(aLast, bLast) || compareSwedish(aFirst, bFirst)
}
