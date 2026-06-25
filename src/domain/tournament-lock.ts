import type { CreateTournamentRequest, TournamentDto } from '../types/api.ts'

type TournamentLockState = 'draft' | 'seeded' | 'in_progress' | 'finalized'

interface TournamentLockInput {
  roundsPlayed: number
  hasRecordedResults: boolean
  nrOfRounds: number
}

export type LockableField =
  | 'pairingSystem'
  | 'initialPairing'
  | 'compensateWeakPlayerPP'
  | 'ratingChoice'
  | 'barredPairing'
  | 'selectedTiebreaks'
  | 'chess4'
  | 'pointsPerGame'
  | 'maxPointsForWin'
  | 'showELO'
  | 'showGroup'

// The LockableField union is the single source of truth for which tournament
// fields lock once the tournament leaves draft (ADR-0004): the dialog disables
// each via isFieldLocked, and TournamentRepository.update enforces the same set
// via LOCK_GUARDS below.

export function isFieldLocked(_field: LockableField, state: TournamentLockState): boolean {
  return state !== 'draft'
}

/**
 * Repository enforcement of the lock, as a single ordered list (ADR-0004) rather
 * than ad-hoc per-field checks. Each guard reports whether a locked field changed
 * and the message to reject with. nrOfRounds (decrease-only) and selectedTiebreaks
 * (order compare) have their own checks in the repo as they are not simple
 * equality. Adding a locked field is a one-line addition here.
 */
export const LOCK_GUARDS: {
  changed: (current: TournamentDto, req: CreateTournamentRequest) => boolean
  message: string
}[] = [
  {
    changed: (c, r) =>
      c.chess4 !== r.chess4 ||
      c.pointsPerGame !== r.pointsPerGame ||
      (r.maxPointsForWin != null && c.maxPointsForWin !== r.maxPointsForWin),
    message: 'Kan inte ändra poängsystem efter att rond 1 har lottats.',
  },
  {
    changed: (c, r) => c.pairingSystem !== r.pairingSystem,
    message: 'Kan inte ändra lottningssystem efter att rond 1 har lottats.',
  },
  {
    changed: (c, r) => c.initialPairing !== r.initialPairing,
    message: 'Kan inte ändra startlottning efter att rond 1 har lottats.',
  },
  {
    changed: (c, r) => c.barredPairing !== r.barredPairing,
    message: 'Kan inte ändra lottningsregler efter att rond 1 har lottats.',
  },
  {
    changed: (c, r) => c.compensateWeakPlayerPP !== r.compensateWeakPlayerPP,
    message: 'Kan inte ändra kompensation för svagare spelare efter att rond 1 har lottats.',
  },
  {
    changed: (c, r) => c.ratingChoice !== r.ratingChoice,
    message: 'Kan inte ändra ratingval efter att rond 1 har lottats.',
  },
  {
    changed: (c, r) => c.showELO !== r.showELO || c.showGroup !== r.showGroup,
    message: 'Kan inte ändra visningsinställningar efter att rond 1 har lottats.',
  },
]

export function tournamentLockState(t: TournamentLockInput): TournamentLockState {
  const roundsPlayed = t.roundsPlayed ?? 0
  if (t.nrOfRounds > 0 && roundsPlayed >= t.nrOfRounds) return 'finalized'
  if (t.hasRecordedResults) return 'in_progress'
  if (roundsPlayed > 0) return 'seeded'
  return 'draft'
}
