import type { Database } from 'sql.js'
import { emitSaveError } from '../lib/save-error-bus.ts'
import { initDatabase } from './db.ts'
import { loadDatabase, saveDatabase } from './persistence.ts'
import { AvailablePlayerRepository } from './repositories/available-players.ts'
import { ClubRepository } from './repositories/clubs.ts'
import { GameRepository } from './repositories/games.ts'
import { SettingsRepository } from './repositories/settings.ts'
import { TournamentPlayerRepository } from './repositories/tournament-players.ts'
import { TournamentRepository } from './repositories/tournaments.ts'
import { createSchema, migrateSchema } from './schema.ts'

export class DatabaseService {
  readonly clubs: ClubRepository
  readonly tournaments: TournamentRepository
  readonly settings: SettingsRepository
  readonly availablePlayers: AvailablePlayerRepository
  readonly tournamentPlayers: TournamentPlayerRepository
  readonly games: GameRepository

  private db: Database
  private constructor(db: Database) {
    this.db = db
    this.clubs = new ClubRepository(db)
    this.tournaments = new TournamentRepository(db)
    this.settings = new SettingsRepository(db)
    this.availablePlayers = new AvailablePlayerRepository(db)
    this.tournamentPlayers = new TournamentPlayerRepository(db)
    this.games = new GameRepository(db)
  }

  static async create(): Promise<DatabaseService> {
    const saved = await loadDatabase()
    if (saved) {
      const db = await initDatabase(saved)
      migrateSchema(db)
      return new DatabaseService(db)
    }
    const db = await initDatabase()
    createSchema(db)
    return new DatabaseService(db)
  }

  static async createFromData(data: Uint8Array): Promise<DatabaseService> {
    const db = await initDatabase(data)
    migrateSchema(db)
    return new DatabaseService(db)
  }

  async save(): Promise<void> {
    const data = this.db.export()
    try {
      await saveDatabase(data)
    } catch (e) {
      // Announce the failure on the shared bus (ADR-0001) so the UI surfaces it,
      // then re-throw so callers still see the rejection for flow control.
      emitSaveError(e)
      throw e
    }
  }

  export(): Uint8Array {
    return this.db.export()
  }

  close(): void {
    this.db.close()
  }
}
