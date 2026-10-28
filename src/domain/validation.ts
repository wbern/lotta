import type { CreateTournamentRequest } from '../types/api'

/**
 * Domain invariant validation, enforced at the repository boundary (ADR-0003) so
 * invalid values cannot be persisted from any entry path — UI, direct api,
 * restore or P2P.
 */

/** A player must have a non-blank first or last name. */
export function hasPlayerName(firstName?: string | null, lastName?: string | null): boolean {
  return Boolean(firstName?.trim() || lastName?.trim())
}

/**
 * Validate and normalise a tournament create/update request at the repository
 * boundary (ADR-0003). Throws (with a Swedish message) when a value would corrupt
 * pairing or scoring; returns the normalised request (trimmed name/group) that the
 * caller must persist, so invalid/untrimmed data cannot reach the DB from any path.
 */
export function validateTournamentRequest(req: CreateTournamentRequest): CreateTournamentRequest {
  if (!Number.isInteger(req.nrOfRounds) || req.nrOfRounds < 1) {
    throw new Error('Antal ronder måste vara minst 1.')
  }
  if (!Number.isInteger(req.pointsPerGame) || req.pointsPerGame < 1) {
    throw new Error('Poäng per match måste vara minst 1.')
  }
  return { ...req, name: req.name.trim(), group: req.group.trim() }
}

/**
 * Normalise a "utgår från rond" value at the repository boundary. Java Lotta's
 * tooltip reads "Tomt fält eller 0 = ej utgått": null and anything ≤ 0 mean
 * "not withdrawn" (-1). A cleared form field arrives as Number('') === 0, and
 * imports/restores may carry 0, so these are normalised rather than rejected.
 * Non-integers (incl. NaN) are rejected like Java does. `undefined` is passed
 * through so updates can skip the column; inserts default it to -1.
 */
export function normaliseWithdrawnFromRound(value: number | null | undefined): number | undefined {
  if (value === undefined) return undefined
  if (value === null) return -1
  if (!Number.isInteger(value)) throw new Error('Utgå från rond måste vara ett heltal.')
  return value <= 0 ? -1 : value
}
