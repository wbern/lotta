/**
 * Hand-computed standings scenarios. Every expected number is derived by hand
 * from the rules (arithmetic in the comments), never copied from output.
 *
 * Rules used throughout (ppg = points per game, default 1):
 * - Score: win = maxPointsForWin (ppg), draw = ppg/2, loss = ppg - maxPointsForWin;
 *   bye and WO win = maxPointsForWin; postponed = 0 for the standings.
 * - Opponent score for Buchholz/Median: opponent's pairing score, except that a
 *   bye, a WO win or an unplayed (no result / postponed) game counts ppg/2.
 */
import { describe, expect, it } from 'vitest'
import type { ResultType, StandingDto } from '../types/api.ts'
import { calculateScores } from './scoring.ts'
import type { StandingsGameInfo, StandingsInput, StandingsPlayerInfo } from './standings.ts'
import { calculateStandings } from './standings.ts'

interface ScoringOpts {
  pointsPerGame?: number
  maxPointsForWin?: number
}

function player(
  id: number,
  firstName: string,
  lastName: string,
  rating = 1500,
  extra: Partial<StandingsPlayerInfo> = {},
): StandingsPlayerInfo {
  return {
    id,
    name: `${firstName} ${lastName}`,
    playerGroup: '',
    club: null,
    clubId: 0,
    rating,
    manualTiebreak: 0,
    lotNr: id,
    ...extra,
  }
}

/** A game with pairing scores exactly as the app stores them (calculateScores). */
function game(
  roundNr: number,
  boardNr: number,
  whitePlayerId: number,
  blackPlayerId: number | null,
  resultType: ResultType,
  scoring: ScoringOpts = {},
): StandingsGameInfo {
  const s = calculateScores(resultType, { pointsPerGame: scoring.pointsPerGame ?? 1, ...scoring })
  return {
    roundNr,
    boardNr,
    whitePlayerId,
    blackPlayerId,
    resultType,
    whiteScore: s.whiteScore,
    blackScore: blackPlayerId == null ? 0 : s.blackScore,
  }
}

/** A bye as the pairing engine stores it: white = player, black = null, WHITE_WIN_WO. */
function bye(roundNr: number, boardNr: number, playerId: number, scoring: ScoringOpts = {}) {
  return game(roundNr, boardNr, playerId, null, 'WHITE_WIN_WO', scoring)
}

function standings(
  players: StandingsPlayerInfo[],
  games: StandingsGameInfo[],
  selectedTiebreaks: string[],
  roundNr: number,
  extra: Partial<StandingsInput> = {},
): StandingDto[] {
  return calculateStandings({
    roundNr,
    pointsPerGame: 1,
    compensateWeakPlayerPP: false,
    selectedTiebreaks,
    players,
    games,
    ...extra,
  })
}

function byName(rows: StandingDto[]): Record<string, StandingDto> {
  return Object.fromEntries(rows.map((r) => [r.name, r]))
}

describe('Inbördes möte (INB)', () => {
  // Cyclic: r1 A>B, C>D; r2 B>C, A>D; r3 C>A, B>D.
  // Scores: A = 1+1+0 = 2, B = 0+1+1 = 2, C = 1+0+1 = 2, D = 0.
  // A, B, C tied on 2 with no earlier tiebreak → each scores 1 against the
  // other two (A: 1 vs B + 0 vs C; B: 0 vs A + 1 vs C; C: 1 vs A + 0 vs B).
  const A = player(1, 'Anna', 'A')
  const B = player(2, 'Bo', 'B')
  const C = player(3, 'Cilla', 'C')
  const D = player(4, 'Dan', 'D')
  const cyclicGames = [
    game(1, 1, 1, 2, 'WHITE_WIN'),
    game(1, 2, 3, 4, 'WHITE_WIN'),
    game(2, 1, 2, 3, 'WHITE_WIN'),
    game(2, 2, 1, 4, 'WHITE_WIN'),
    game(3, 1, 3, 1, 'WHITE_WIN'),
    game(3, 2, 2, 4, 'WHITE_WIN'),
  ]

  it.each([
    ['A, B, C, D', [A, B, C, D]],
    ['D, C, B, A', [D, C, B, A]],
  ])('given a cyclic A>B>C>A tie (input order %s), when standings are calculated, then A, B and C all get Inb 1 and share place 1, D is 4th', (_label, players) => {
    const rows = byName(standings(players, cyclicGames, ['Inbördes möte'], 3))
    for (const name of ['Anna A', 'Bo B', 'Cilla C']) {
      expect(rows[name].tiebreaks.Inb, name).toBe('1')
      expect(rows[name].place, name).toBe(1)
    }
    expect(rows['Dan D'].tiebreaks.Inb).toBe('0')
    expect(rows['Dan D'].place).toBe(4)
  })

  // Six players, three rounds:
  // r1 A-B 1-0, C-D 1-0, E-F ½-½   → A1 B0 C1 D0 E½ F½
  // r2 C-A 1-0, B-E 1-0, D-F ½-½   → A1 B1 C2 D½ E½ F1
  // r3 A-D 1-0, B-F 1-0, C-E ½-½   → A2 B2 C2½ D½ E1 F1
  // (The spec's wording "both win r2, both lose r3" would leave B on 1, so A
  // loses r2 and B wins r3 instead — same intent: A and B alone on 2, A beat B.)
  const P = {
    A: player(1, 'Anna', 'A'),
    B: player(2, 'Bo', 'B'),
    C: player(3, 'Cilla', 'C'),
    D: player(4, 'Dan', 'D'),
    E: player(5, 'Eva', 'E'),
    F: player(6, 'Filip', 'F'),
  }
  const sixGames = [
    game(1, 1, 1, 2, 'WHITE_WIN'),
    game(1, 2, 3, 4, 'WHITE_WIN'),
    game(1, 3, 5, 6, 'DRAW'),
    game(2, 1, 3, 1, 'WHITE_WIN'),
    game(2, 2, 2, 5, 'WHITE_WIN'),
    game(2, 3, 4, 6, 'DRAW'),
    game(3, 1, 1, 4, 'WHITE_WIN'),
    game(3, 2, 2, 6, 'WHITE_WIN'),
    game(3, 3, 3, 5, 'DRAW'),
  ]

  it.each([
    ['A first', [P.A, P.B, P.C, P.D, P.E, P.F]],
    ['B first', [P.B, P.A, P.F, P.E, P.D, P.C]],
  ])('given A beat B and they alone share 2 points (%s), when standings are calculated, then A has Inb 1, B Inb 0 and A ranks above B', (_label, players) => {
    const rows = standings(players, sixGames, ['Inbördes möte'], 3)
    const r = byName(rows)
    expect(r['Anna A'].tiebreaks.Inb).toBe('1')
    expect(r['Bo B'].tiebreaks.Inb).toBe('0')
    // E and F (1 point each) drew each other: ½ each.
    expect(r['Eva E'].tiebreaks.Inb).toBe('0.5')
    expect(r['Filip F'].tiebreaks.Inb).toBe('0.5')
    expect(rows.map((s) => [s.name, s.place])).toEqual([
      ['Cilla C', 1],
      ['Anna A', 2],
      ['Bo B', 3],
      ...(rows[3].name === 'Eva E'
        ? [
            ['Eva E', 4],
            ['Filip F', 4],
          ]
        : [
            ['Filip F', 4],
            ['Eva E', 4],
          ]),
      ['Dan D', 6],
    ])
  })

  it('given Buchholz before Inbördes möte and two 2-point players with different Buchholz, when standings are calculated, then they are not tied for Inb (both 0) and the higher Buchholz ranks first', () => {
    // Buchholz = sum of opponents' scores (no byes/WO here):
    // A: B 2 + C 2½ + D ½ = 5;  B: A 2 + E 1 + F 1 = 4.
    // Different first tiebreak → A and B are not tied when Inb is computed.
    const rows = byName(standings(Object.values(P), sixGames, ['Buchholz', 'Inbördes möte'], 3))
    expect(rows['Anna A'].tiebreaks.Buch).toBe('5')
    expect(rows['Bo B'].tiebreaks.Buch).toBe('4')
    expect(rows['Anna A'].tiebreaks.Inb).toBe('0')
    expect(rows['Bo B'].tiebreaks.Inb).toBe('0')
    expect(rows['Anna A'].place).toBe(2)
    expect(rows['Bo B'].place).toBe(3)
  })
})

describe('Median Buchholz (MEDIAN)', () => {
  // ppg 1. r1 A>B, C>D, E bye; r2 A>C, B>E, D bye; r3 A>D, B>C, E bye.
  // An own bye adds (ppg/2)·roundNr to Buchholz AND Median Buchholz (Java's
  // comment says rounds/2; the old ppg·roundNr was a port of a Java typo).
  const players = [
    player(1, 'Anna', 'A'),
    player(2, 'Bo', 'B'),
    player(3, 'Cilla', 'C'),
    player(4, 'Dan', 'D'),
    player(5, 'Eva', 'E'),
  ]
  const games = [
    game(1, 1, 1, 2, 'WHITE_WIN'),
    game(1, 2, 3, 4, 'WHITE_WIN'),
    bye(1, 3, 5),
    game(2, 1, 1, 3, 'WHITE_WIN'),
    game(2, 2, 2, 5, 'WHITE_WIN'),
    bye(2, 3, 4),
    game(3, 1, 1, 4, 'WHITE_WIN'),
    game(3, 2, 2, 3, 'WHITE_WIN'),
    bye(3, 3, 5),
  ]
  const tb = ['Buchholz', 'Median Buchholz']

  it('given standings after round 2, when D and E each had one bye, then their own bye counts ½·2 = 1 in both Buchholz and Median Buchholz', () => {
    // Opponent scores after r2 (bye/WO win/unplayed = ½): A 1+1 = 2, B 0+1 = 1,
    // C 1+0 = 1, D 0+½ = ½, E ½+0 = ½.
    // D: C 1 + own bye ½·2 = 1 → Buch 2; Median (r ≤ 2, nothing trimmed) 2.
    // E: own bye 1 + B 1 → Buch 2; Median 2.
    const rows = byName(standings(players, games, tb, 2))
    expect(rows['Dan D'].tiebreaks).toEqual({ Buch: '2', 'M.Buch': '2' })
    expect(rows['Eva E'].tiebreaks).toEqual({ Buch: '2', 'M.Buch': '2' })
  })

  it('given standings after round 3, when Median Buchholz trims the highest and lowest, then own byes count ½·3 = 1.5', () => {
    // Opponent scores after r3: A 1+1+1 = 3, B 0+1+1 = 2, C 1+0+0 = 1,
    // D 0+½+0 = ½, E ½+0+½ = 1.
    // A: B 2 + C 1 + D ½ = 3.5;          Median 3.5 − ½ − 2 = 1.
    // B: A 3 + E 1 + C 1 = 5;            Median 5 − 1 − 3 = 1.
    // D: C 1 + bye 1.5 + A 3 = 5.5;      Median 5.5 − 1 − 3 = 1.5 (old code 3).
    // E: bye 1.5 + B 2 + bye 1.5 = 5;    Median 5 − 1.5 − 2 = 1.5 (old code 3).
    const rows = byName(standings(players, games, tb, 3))
    expect(rows['Anna A'].tiebreaks).toEqual({ Buch: '3.5', 'M.Buch': '1' })
    expect(rows['Bo B'].tiebreaks).toEqual({ Buch: '5', 'M.Buch': '1' })
    expect(rows['Dan D'].tiebreaks).toEqual({ Buch: '5.5', 'M.Buch': '1.5' })
    expect(rows['Eva E'].tiebreaks).toEqual({ Buch: '5', 'M.Buch': '1.5' })
  })

  it('given any round, when standings are calculated, then no player has Median Buchholz above Buchholz', () => {
    for (const round of [1, 2, 3]) {
      for (const row of standings(players, games, tb, round)) {
        expect(Number(row.tiebreaks['M.Buch']), `${row.name} r${round}`).toBeLessThanOrEqual(
          Number(row.tiebreaks.Buch),
        )
      }
    }
  })
})
