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
