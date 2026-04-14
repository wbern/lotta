import type {
  CreateTournamentRequest,
  GameDto,
  PlayerDto,
  RoundDto,
  SetResultRequest,
  StandingDto,
  TournamentDto,
  TournamentListItemDto,
} from '../types/api'
import type { CommandOutcome, SetResultCommand } from './result-command'

export interface DataProvider {
  tournaments: {
    list(): Promise<TournamentListItemDto[]>
    get(id: number): Promise<TournamentDto>
    create(req: CreateTournamentRequest): Promise<TournamentDto>
  }
  tournamentPlayers: {
    list(tournamentId: number): Promise<PlayerDto[]>
    add(tournamentId: number, dto: Partial<PlayerDto>): Promise<PlayerDto>
    addMany(tournamentId: number, dtos: Partial<PlayerDto>[]): Promise<PlayerDto[]>
    update(tournamentId: number, playerId: number, dto: Partial<PlayerDto>): Promise<PlayerDto>
    remove(tournamentId: number, playerId: number): Promise<void>
    removeMany(tournamentId: number, playerIds: number[]): Promise<void>
  }
  rounds: {
    list(tournamentId: number): Promise<RoundDto[]>
    get(tournamentId: number, roundNr: number): Promise<RoundDto>
    pairNext(tournamentId: number): Promise<RoundDto>
    unpairLast(tournamentId: number): Promise<void>
  }
  results: {
    set(
      tournamentId: number,
      roundNr: number,
      boardNr: number,
      req: SetResultRequest,
    ): Promise<GameDto>
  }
  standings: {
    get(tournamentId: number, round?: number): Promise<StandingDto[]>
  }
  commands?: {
    setResult(cmd: SetResultCommand): Promise<CommandOutcome>
  }
}

export interface DataProviderSetup {
  provider: DataProvider
  teardown: () => Promise<void>
}
