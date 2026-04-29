import type { Database } from 'sql.js'
import type { PlayerDto } from '../../types/api.ts'
import { mapPlayerRow } from './map-player-row.ts'

export class AvailablePlayerRepository {
  private db: Database
  constructor(db: Database) {
    this.db = db
  }

  create(dto: Partial<PlayerDto>): PlayerDto {
    this.db.run(
      `INSERT INTO availableplayers (
        lastname, firstname, clubindex, ratingn, ratingi, ratingq, ratingb,
        ratingk, ratingkq, ratingkb, title, sex, federation, fideid, ssfid,
        birthdate, playergroup
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dto.lastName ?? '',
        dto.firstName ?? '',
        dto.clubIndex && dto.clubIndex > 0 ? dto.clubIndex : null,
        dto.ratingN ?? 0,
        dto.ratingI ?? 0,
        dto.ratingQ ?? 0,
        dto.ratingB ?? 0,
        dto.ratingK ?? 0,
        dto.ratingKQ ?? 0,
        dto.ratingKB ?? 0,
        dto.title ?? '',
        dto.sex ?? null,
        dto.federation ?? '',
        dto.fideId ?? 0,
        dto.ssfId ?? 0,
        dto.birthdate ?? null,
        dto.playerGroup ?? '',
      ],
    )
    const idResult = this.db.exec('SELECT last_insert_rowid()')
    const id = idResult[0].values[0][0] as number
    return this.get(id)!
  }

  get(id: number): PlayerDto | null {
    const result = this.db.exec(
      `SELECT
        p."index", p.lastname, p.firstname, c.club, COALESCE(p.clubindex, 0),
        p.ratingn, p.ratingi, p.ratingq, p.ratingb, p.ratingk, p.ratingkq, p.ratingkb,
        p.title, p.sex, p.federation, p.fideid, p.ssfid, p.birthdate, p.playergroup
      FROM availableplayers p
      LEFT JOIN clubs c ON c."index" = p.clubindex
      WHERE p."index" = ?`,
      [id],
    )
    if (result.length === 0) return null
    const row = result[0].values[0]
    return this.mapRow(row)
  }

  update(id: number, dto: Partial<PlayerDto>): PlayerDto {
    const fields: string[] = []
    const values: (string | number | null)[] = []

    const fieldMap: Record<string, string> = {
      lastName: 'lastname',
      firstName: 'firstname',
      clubIndex: 'clubindex',
      ratingN: 'ratingn',
      ratingI: 'ratingi',
      ratingQ: 'ratingq',
      ratingB: 'ratingb',
      ratingK: 'ratingk',
      ratingKQ: 'ratingkq',
      ratingKB: 'ratingkb',
      title: 'title',
      sex: 'sex',
      federation: 'federation',
      fideId: 'fideid',
      ssfId: 'ssfid',
      birthdate: 'birthdate',
      playerGroup: 'playergroup',
    }

    for (const [dtoField, dbColumn] of Object.entries(fieldMap)) {
      const value = dto[dtoField as keyof PlayerDto]
      if (value !== undefined) {
        fields.push(`${dbColumn} = ?`)
        values.push(value as string | number | null)
      }
    }

    if (fields.length > 0) {
      values.push(id)
      this.db.run(`UPDATE availableplayers SET ${fields.join(', ')} WHERE "index" = ?`, values)
    }

    return this.get(id)!
  }

  delete(id: number): void {
    this.db.run('DELETE FROM availableplayers WHERE "index" = ?', [id])
  }

  deleteMany(ids: number[]): void {
    for (const id of ids) this.delete(id)
  }

  list(): PlayerDto[] {
    const result = this.db.exec(`
      SELECT
        p."index", p.lastname, p.firstname, c.club, COALESCE(p.clubindex, 0),
        p.ratingn, p.ratingi, p.ratingq, p.ratingb, p.ratingk, p.ratingkq, p.ratingkb,
        p.title, p.sex, p.federation, p.fideid, p.ssfid, p.birthdate, p.playergroup
      FROM availableplayers p
      LEFT JOIN clubs c ON c."index" = p.clubindex
      ORDER BY p.lastname, p.firstname
    `)
    if (result.length === 0) return []
    return result[0].values.map((row) => this.mapRow(row))
  }

  private mapRow(row: unknown[]): PlayerDto {
    return mapPlayerRow(row, false)
  }
}
