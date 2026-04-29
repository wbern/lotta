import type { PlayerDto } from '../types/api'

const defaults: PlayerDto = {
  id: 0,
  firstName: '',
  lastName: '',
  club: '',
  clubIndex: 0,
  ratingN: 0,
  ratingI: 0,
  ratingQ: 0,
  ratingB: 0,
  ratingK: 0,
  ratingKQ: 0,
  ratingKB: 0,
  title: '',
  sex: null,
  federation: 'SWE',
  fideId: 0,
  ssfId: 0,
  birthdate: null,
  playerGroup: '',
  withdrawnFromRound: -1,
  manualTiebreak: 0,
  addedAtRound: 0,
  protectFromByeInDebut: true,
  lotNr: 2147483647,
}

export function mockPlayer(overrides: Partial<PlayerDto> = {}): PlayerDto {
  return { ...defaults, ...overrides }
}
