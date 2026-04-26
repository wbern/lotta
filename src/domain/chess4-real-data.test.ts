/**
 * Real-data verifier for Chess4 (Schackfyran) club scoring.
 *
 * Loads ~/Downloads/lotta-backup*.sqlite (latest) and proves that
 * calculateChess4Standings agrees with an independent transcription of the
 * Schackfyran formula on every club in tournament 4.
 *
 * Skipped when no backup is present (so CI passes). To force, point
 * LOTTA_BACKUP at a specific file.
 *
 *   pnpm exec vitest run src/domain/chess4-real-data.test.ts
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import initSqlJs from 'sql.js'
import { describe, expect, it } from 'vitest'
import type { ResultType } from '../types/api.ts'
import { calculateChess4Standings } from './standings.ts'

// Mirror src/db/repositories/games.ts:24 — the resulttype int → enum mapping.
const RESULT_TYPES: ResultType[] = [
  'NO_RESULT',
  'WHITE_WIN',
  'DRAW',
  'BLACK_WIN',
  'WHITE_WIN_WO',
  'BLACK_WIN_WO',
  'DOUBLE_WO',
  'POSTPONED',
  'CANCELLED',
]

function findBackup(): string | null {
  if (process.env.LOTTA_BACKUP && existsSync(process.env.LOTTA_BACKUP)) {
    return process.env.LOTTA_BACKUP
  }
  const dir = join(homedir(), 'Downloads')
  if (!existsSync(dir)) return null
  const candidates = readdirSync(dir)
    .filter((f) => /^lotta-backup.*\.sqlite$/i.test(f))
    .map((f) => ({ full: join(dir, f), mtime: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
  return candidates[0]?.full ?? null
}

const TOURNAMENT_ID = 4

describe.skipIf(!findBackup())('chess4 real-data verifier', () => {
  it('production calculateChess4Standings matches independent spec formula', async () => {
    const backupPath = findBackup() as string
    const bytes = readFileSync(backupPath)
    // eslint-disable-next-line no-console
    console.log(`backup: ${backupPath} (${bytes.length} bytes)`)

    const SQL = await initSqlJs({})
    const db = new SQL.Database(bytes)

    const tRows = db.exec(
      `SELECT "index", tournament, chess4, pointspergame FROM tournaments WHERE "index" = ${TOURNAMENT_ID}`,
    )
    if (tRows.length === 0) {
      // eslint-disable-next-line no-console
      console.log(`tournament ${TOURNAMENT_ID} not in this backup — skipping`)
      return
    }
    const t = tRows[0].values[0]
    const chess4 = t[2] === 'true' || (t[2] as unknown) === true || t[2] === 1
    const ppg = t[3] as number
    // eslint-disable-next-line no-console
    console.log(`tournament: ${t[1]} (chess4=${chess4}, ppg=${ppg})`)

    const pRows = db.exec(`
      SELECT tp."index", tp.lastname, tp.firstname, c.club
      FROM tournamentplayers tp
      LEFT JOIN clubs c ON c."index" = tp.clubindex
      WHERE tp.tournamentindex = ${TOURNAMENT_ID}
    `)
    const players = pRows[0].values.map((row) => ({
      id: row[0] as number,
      name: `${row[2] ?? ''} ${row[1]}`.trim(),
      playerGroup: '',
      club: (row[3] as string | null) ?? null,
      clubId: 0,
      rating: 0,
      manualTiebreak: 0,
      lotNr: row[0] as number,
    }))

    const gRows = db.exec(`
      SELECT round, boardnr, whiteplayer, blackplayer, resulttype, whitescore, blackscore
      FROM tournamentgames WHERE tournament = ${TOURNAMENT_ID}
    `)
    const games =
      gRows.length === 0
        ? []
        : gRows[0].values.map((row) => ({
            roundNr: row[0] as number,
            boardNr: row[1] as number,
            whitePlayerId: (row[2] as number | null) ?? null,
            blackPlayerId: (row[3] as number | null) ?? null,
            resultType: RESULT_TYPES[row[4] as number] ?? ('NO_RESULT' as ResultType),
            whiteScore: row[5] as number,
            blackScore: row[6] as number,
          }))
    const maxRound = games.reduce((m, g) => Math.max(m, g.roundNr), 0)

    const cRows = db.exec(`SELECT club, chess4members FROM clubs`)
    const clubs = cRows[0].values.map((row) => ({
      name: row[0] as string,
      chess4Members: (row[1] as number | null) ?? 0,
    }))

    const input = {
      roundNr: maxRound,
      pointsPerGame: ppg,
      chess4,
      compensateWeakPlayerPP: false,
      selectedTiebreaks: [],
      players,
      games,
    }

    // Method A: production code
    const prod = calculateChess4Standings(input, clubs)

    // Method B: clean-room reference. Spec:
    //   player_score = Σ stored {white,black}score, except POSTPONED with both
    //                  players present → 0 (override per scoring.ts).
    //   club_score   = round( (40 / max(10, chess4Members)) × Σ club players' scores ).
    const playerScore = (pid: number): number => {
      let s = 0
      for (const g of games) {
        const isWhite = g.whitePlayerId === pid
        const isBlack = g.blackPlayerId === pid
        if (!isWhite && !isBlack) continue
        const both = g.whitePlayerId != null && g.blackPlayerId != null
        if (g.resultType === 'POSTPONED' && both) continue
        s += isWhite ? g.whiteScore : g.blackScore
      }
      return s
    }

    const expected = new Map<string, { points: number; score: number; playerCount: number }>()
    for (const c of clubs) {
      const clubPlayers = players.filter((p) => p.club === c.name)
      const points = clubPlayers.reduce((acc, p) => acc + playerScore(p.id), 0)
      const score = Math.round((40 / Math.max(10, c.chess4Members)) * points)
      expected.set(c.name, { points, score, playerCount: clubPlayers.length })
    }

    // Compare every prod entry. Production filters out clubs with no players
    // in the input (only those in the clubMap that received contributions);
    // actually it keeps every club from the clubs[] arg, so we expect a 1:1
    // match for clubs that have entries in `expected` AND appear in prod.
    const mismatches: string[] = []
    for (const p of prod) {
      const ref = expected.get(p.club)
      if (!ref) {
        mismatches.push(`prod has unknown club ${p.club}`)
        continue
      }
      if (p.score !== ref.score) {
        mismatches.push(
          `${p.club}: prod=${p.score} vs spec=${ref.score} (points=${ref.points}, members=${p.chess4Members})`,
        )
      }
      if (p.playerCount !== ref.playerCount) {
        mismatches.push(`${p.club}: playerCount prod=${p.playerCount} vs spec=${ref.playerCount}`)
      }
    }

    // Top-10 print so the user can eyeball announcement-level winners.
    // eslint-disable-next-line no-console
    console.log('\nTop 10 clubs (place, score, points, members, club):')
    for (let i = 0; i < Math.min(10, prod.length); i++) {
      const p = prod[i]
      const ref = expected.get(p.club)!
      // eslint-disable-next-line no-console
      console.log(
        `  ${String(p.place).padStart(3)}  ${String(p.score).padStart(4)}  ${String(ref.points).padStart(4)}  ${String(p.chess4Members).padStart(3)}   ${p.club}`,
      )
    }

    expect(mismatches, mismatches.join('\n')).toEqual([])
    expect(prod.length).toBeGreaterThan(0)
  })
})
