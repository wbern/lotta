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
 * Validate a tournament create/update request. Throws (with a Swedish message)
 * when a value would corrupt pairing or scoring.
 */
export function validateTournamentRequest(req: CreateTournamentRequest): void {
  if (!Number.isInteger(req.nrOfRounds) || req.nrOfRounds < 1) {
    throw new Error('Antal ronder måste vara minst 1.')
  }
  if (!Number.isInteger(req.pointsPerGame) || req.pointsPerGame < 1) {
    throw new Error('Poäng per match måste vara minst 1.')
  }
}
