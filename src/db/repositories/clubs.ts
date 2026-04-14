import type { Database } from 'sql.js'
import type { ClubDto } from '../../types/api.ts'

export class ClubRepository {
  private db: Database
  constructor(db: Database) {
    this.db = db
  }

  create(data: { name: string; chess4Members?: number }): ClubDto {
    const chess4Members = data.chess4Members ?? 20
    this.db.run('INSERT INTO clubs (club, chess4members) VALUES (?, ?)', [data.name, chess4Members])
    const result = this.db.exec('SELECT last_insert_rowid()')
    const id = result[0].values[0][0] as number
    return { id, name: data.name, chess4Members }
  }

  update(id: number, data: { name?: string; chess4Members?: number }): ClubDto {
    if (data.name !== undefined) {
      this.db.run('UPDATE clubs SET club = ? WHERE "index" = ?', [data.name, id])
    }
    if (data.chess4Members !== undefined) {
      this.db.run('UPDATE clubs SET chess4members = ? WHERE "index" = ?', [data.chess4Members, id])
    }
    const result = this.db.exec(
      'SELECT "index", club, chess4members FROM clubs WHERE "index" = ?',
      [id],
    )
    const row = result[0].values[0]
    return {
      id: row[0] as number,
      name: row[1] as string,
      chess4Members: (row[2] as number) ?? 0,
    }
  }

  delete(id: number): void {
    this.db.run('DELETE FROM clubs WHERE "index" = ?', [id])
  }

  list(): ClubDto[] {
    const result = this.db.exec('SELECT "index", club, chess4members FROM clubs ORDER BY club')
    if (result.length === 0) return []
    return result[0].values.map((row) => ({
      id: row[0] as number,
      name: row[1] as string,
      chess4Members: (row[2] as number) ?? 0,
    }))
  }
}
