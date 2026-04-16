export type ResultType =
  | 'NO_RESULT'
  | 'WHITE_WIN'
  | 'DRAW'
  | 'BLACK_WIN'
  | 'WHITE_WIN_WO'
  | 'BLACK_WIN_WO'
  | 'DOUBLE_WO'
  | 'POSTPONED'
  | 'CANCELLED'

export interface TournamentListItemDto {
  id: number
  name: string
  group: string
  pairingSystem: string
  nrOfRounds: number
  roundsPlayed: number
  playerCount: number
  finished: boolean
}

export interface TournamentDto {
  id: number
  name: string
  group: string
  pairingSystem: string
  initialPairing: string
  nrOfRounds: number
  barredPairing: boolean
  compensateWeakPlayerPP: boolean
  pointsPerGame: number
  chess4: boolean
  ratingChoice: string
  showELO: boolean
  showGroup: boolean
  city: string
  startDate: string | null
  endDate: string | null
  chiefArbiter: string
  deputyArbiter: string
  timeControl: string
  federation: string
  resultsPage: string
  standingsPage: string
  playerListPage: string
  roundForRoundPage: string
  clubStandingsPage: string
  roundsPlayed: number
  playerCount: number
  finished: boolean
  hasRecordedResults: boolean
  selectedTiebreaks: string[]
  roundDates: { round: number; date: string }[]
}

export interface PlayerDto {
  id: number
  lastName: string
  firstName: string
  club: string | null
  clubIndex: number
  ratingN: number
  ratingI: number
  ratingQ: number
  ratingB: number
  ratingK: number
  ratingKQ: number
  ratingKB: number
  title: string
  sex: string | null
  federation: string
  fideId: number
  ssfId: number
  birthdate: string | null
  playerGroup: string
  withdrawnFromRound: number
  manualTiebreak: number
  lotNr: number
}

export interface PlayerSummaryDto {
  id: number
  name: string
  club: string | null
  rating: number
  lotNr: number
}

export interface GameDto {
  boardNr: number
  roundNr: number
  whitePlayer: PlayerSummaryDto | null
  blackPlayer: PlayerSummaryDto | null
  resultType: ResultType
  whiteScore: number
  blackScore: number
  resultDisplay: string
}

export interface RoundDto {
  roundNr: number
  hasAllResults: boolean
  gameCount: number
  games: GameDto[]
}

export interface StandingDto {
  place: number
  name: string
  playerGroup: string
  club: string | null
  rating: number
  score: number
  scoreDisplay: string
  tiebreaks: Record<string, string>
}

export interface ClubStandingDto {
  place: number
  club: string
  score: number
}

export interface Chess4StandingDto {
  place: number
  club: string
  playerCount: number
  chess4Members: number
  score: number
}

export interface ClubDto {
  id: number
  name: string
  chess4Members: number
}

export interface SettingsDto {
  playerPresentation: string
  maxPointsImmediately: boolean
  searchForUpdate: boolean
  nrOfRows: number
}

export interface SetResultRequest {
  resultType: ResultType
  whiteScore?: number
  blackScore?: number
  expectedPrior?: ResultType
}

export interface CreateTournamentRequest {
  name: string
  group: string
  pairingSystem: string
  initialPairing: string
  nrOfRounds: number
  barredPairing: boolean
  compensateWeakPlayerPP: boolean
  pointsPerGame: number
  chess4: boolean
  ratingChoice: string
  showELO: boolean
  showGroup: boolean
  city?: string
  startDate?: string
  endDate?: string
  chiefArbiter?: string
  deputyArbiter?: string
  timeControl?: string
  federation?: string
  resultsPage?: string
  standingsPage?: string
  playerListPage?: string
  roundForRoundPage?: string
  clubStandingsPage?: string
  selectedTiebreaks?: string[]
  roundDates?: { round: number; date: string }[]
}
