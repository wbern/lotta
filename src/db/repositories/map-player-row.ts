import type { PlayerDto } from '../../types/api.ts'

/**
 * Maps a SQL result row to a PlayerDto.
 *
 * Columns 0-18 are shared between availableplayers and tournamentplayers queries.
 * When `extended` is true, columns 19 (withdrawnFromRound) and 20 (manualTiebreak)
 * are read from the row. Otherwise defaults are used.
 */
export function mapPlayerRow(row: unknown[], extended: boolean): PlayerDto {
  return {
    id: row[0] as number,
    lastName: row[1] as string,
    firstName: (row[2] as string) ?? '',
    club: row[3] as string | null,
    clubIndex: row[4] as number,
    ratingN: (row[5] as number) ?? 0,
    ratingI: (row[6] as number) ?? 0,
    ratingQ: (row[7] as number) ?? 0,
    ratingB: (row[8] as number) ?? 0,
    ratingK: (row[9] as number) ?? 0,
    ratingKQ: (row[10] as number) ?? 0,
    ratingKB: (row[11] as number) ?? 0,
    title: (row[12] as string) ?? '',
    sex: row[13] as string | null,
    federation: (row[14] as string) ?? '',
    fideId: (row[15] as number) ?? 0,
    ssfId: (row[16] as number) ?? 0,
    birthdate: row[17] as string | null,
    playerGroup: (row[18] as string) ?? '',
    withdrawnFromRound: extended ? (row[19] as number) : -1,
    manualTiebreak: extended ? (row[20] as number) : 0,
    lotNr: 2147483647,
  }
}
