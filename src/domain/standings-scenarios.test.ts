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
import { calculateClubStandings, calculateStandings } from './standings.ts'

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
    firstName,
    lastName,
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

  it('given the cyclic tie, when the input order is reversed, then the whole standings list is identical', () => {
    expect(standings([D, C, B, A], cyclicGames, ['Inbördes möte'], 3)).toEqual(
      standings([A, B, C, D], cyclicGames, ['Inbördes möte'], 3),
    )
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
      // E and F share place 4; equal rating → listed by name (E before F).
      ['Eva E', 4],
      ['Filip F', 4],
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

describe('Prestationsrating (L)', () => {
  // Played games only: bye, WO win/loss, double WO, cancelled, postponed and
  // no-result games are skipped. avg = floor(Σ opponent rating / played),
  // p = (wins + ½·draws) / played from the result type (not points), then the
  // dp table with a strict ">" lookup; below .5 the table is mirrored.
  const pres = ['Prestationsrating LASK']

  it('given W 1600, W 1400 and a bye, when standings after round 3 are calculated, then Pres = 1500 + 800 = 2300', () => {
    const players = [
      player(1, 'Anna', 'A', 1500),
      player(2, 'Bo', 'B', 1600),
      player(3, 'Cilla', 'C', 1400),
    ]
    const games = [
      game(1, 1, 1, 2, 'WHITE_WIN'),
      bye(1, 2, 3),
      game(2, 1, 3, 1, 'BLACK_WIN'),
      bye(2, 2, 2),
      bye(3, 1, 1),
      game(3, 2, 2, 3, 'DRAW'),
    ]
    // A: played vs B 1600 (W) and C 1400 (W); bye r3 ignored.
    // avg (1600 + 1400) / 2 = 1500, p = 2/2 = 1 > .99 → +800 → 2300.
    expect(byName(standings(players, games, pres, 3))['Anna A'].tiebreaks.Pres).toBe('2300')
  })

  it('given ppg 2 and W 1500, W 1600, L 1700, when standings are calculated, then Pres = 1600 + 125 = 1725', () => {
    const scoring = { pointsPerGame: 2 }
    const players = [
      player(1, 'Anna', 'A', 1650),
      player(2, 'Bo', 'B', 1500),
      player(3, 'Cilla', 'C', 1600),
      player(4, 'Dan', 'D', 1700),
    ]
    const games = [
      game(1, 1, 1, 2, 'WHITE_WIN', scoring),
      game(1, 2, 3, 4, 'DRAW', scoring),
      game(2, 1, 3, 1, 'BLACK_WIN', scoring),
      game(2, 2, 2, 4, 'DRAW', scoring),
      game(3, 1, 1, 4, 'BLACK_WIN', scoring),
      game(3, 2, 2, 3, 'DRAW', scoring),
    ]
    // A (score 2+2+0 = 4 of 6): avg (1500 + 1600 + 1700) / 3 = 1600,
    // p = 2 wins / 3 = .667 > .66 → +125 → 1725.
    const rows = byName(standings(players, games, pres, 3, { pointsPerGame: 2 }))
    expect(rows['Anna A'].score).toBe(4)
    expect(rows['Anna A'].tiebreaks.Pres).toBe('1725')
  })

  it('given a WO win vs 1800 then a win vs 1500, when standings are calculated, then the WO is ignored: Pres = 1500 + 800 = 2300', () => {
    const players = [
      player(1, 'Anna', 'A', 1500),
      player(2, 'Bo', 'B', 1800),
      player(3, 'Cilla', 'C', 1500),
    ]
    const games = [
      game(1, 1, 1, 2, 'WHITE_WIN_WO'),
      bye(1, 2, 3),
      game(2, 1, 1, 3, 'WHITE_WIN'),
      bye(2, 2, 2),
    ]
    expect(byName(standings(players, games, pres, 2))['Anna A'].tiebreaks.Pres).toBe('2300')
  })

  it('given a player added before round 3 who won vs 1500, when standings after round 3 are calculated, then Pres = 1500 + 800 = 2300 (old code divided by all 3 rounds)', () => {
    const players = [
      player(1, 'Anna', 'A', 1500),
      player(2, 'Bo', 'B', 1500),
      player(3, 'Sen', 'Ankomling', 1500),
      player(4, 'Dan', 'D', 1500),
    ]
    const games = [
      game(1, 1, 1, 2, 'DRAW'),
      game(2, 1, 2, 1, 'DRAW'),
      game(3, 1, 3, 4, 'WHITE_WIN'),
      game(3, 2, 1, 2, 'DRAW'),
    ]
    expect(byName(standings(players, games, pres, 3))['Sen Ankomling'].tiebreaks.Pres).toBe('2300')
  })

  it('given L 1500 and D 1700, when standings are calculated, then avg 1600, p .25 mirrored to .75 > .74 → 1600 − 193 = 1407', () => {
    const players = [
      player(1, 'Anna', 'A', 1600),
      player(2, 'Bo', 'B', 1500),
      player(3, 'Cilla', 'C', 1700),
    ]
    const games = [game(1, 1, 1, 2, 'BLACK_WIN'), game(2, 1, 3, 1, 'DRAW')]
    expect(byName(standings(players, games, pres, 2))['Anna A'].tiebreaks.Pres).toBe('1407')
  })

  it('given only a bye and a postponed game, when standings are calculated, then Pres = 0', () => {
    const players = [player(1, 'Anna', 'A'), player(2, 'Bo', 'B'), player(3, 'Cilla', 'C')]
    const games = [bye(1, 1, 1), game(1, 2, 2, 3, 'DRAW'), game(2, 1, 1, 2, 'POSTPONED')]
    expect(byName(standings(players, games, pres, 2))['Anna A'].tiebreaks.Pres).toBe('0')
  })

  it('given chess4 (ppg 4, win 3-1) and a win vs 1500, when standings are calculated, then the win counts as 1 (not 3/4): Pres = 2300', () => {
    const scoring = { pointsPerGame: 4, maxPointsForWin: 3 }
    const players = [player(1, 'Anna', 'A', 1500), player(2, 'Bo', 'B', 1500)]
    const games = [game(1, 1, 1, 2, 'WHITE_WIN', scoring)]
    const rows = byName(
      standings(players, games, pres, 1, { pointsPerGame: 4, maxPointsForWin: 3, chess4: true }),
    )
    expect(rows['Anna A'].score).toBe(3)
    expect(rows['Anna A'].tiebreaks.Pres).toBe('2300')
    // Loser: p 0 → mirrored 1 > .99 → 1500 − 800 = 700.
    expect(rows['Bo B'].tiebreaks.Pres).toBe('700')
  })

  it('given W 1400 and L 1600, when standings are calculated, then p = .5 is not > .5 → Pres = avg 1500 (strict lookup locked)', () => {
    const players = [
      player(1, 'Anna', 'A', 1500),
      player(2, 'Bo', 'B', 1400),
      player(3, 'Cilla', 'C', 1600),
    ]
    const games = [game(1, 1, 1, 2, 'WHITE_WIN'), game(2, 1, 3, 1, 'WHITE_WIN')]
    expect(byName(standings(players, games, pres, 2))['Anna A'].tiebreaks.Pres).toBe('1500')
  })
})

describe('Tied players listing order (TIE)', () => {
  // Players tied on score and every tiebreak share a place; within the place
  // they are listed by rating (high first), then Swedish name order
  // (… X, Y, Z, Å, Ä, Ö), last name before first name. Never affects place.

  it('given Öberg (1500) drew Åberg (1700), when standings are calculated, then both share place 1 and Åberg (higher rating) is listed first', () => {
    const players = [player(1, 'Olle', 'Öberg', 1500), player(2, 'Åsa', 'Åberg', 1700)]
    const games = [game(1, 1, 1, 2, 'DRAW')]
    const rows = standings(players, games, [], 1)
    expect(rows.map((r) => [r.name, r.place])).toEqual([
      ['Åsa Åberg', 1],
      ['Olle Öberg', 1],
    ])
  })

  it('given three tied 1500 players Öberg, Äberg, Åberg, when standings are calculated, then they are listed Åberg, Äberg, Öberg (Swedish collation)', () => {
    const players = [
      player(1, 'Olle', 'Öberg', 1500),
      player(2, 'Ärla', 'Äberg', 1500),
      player(3, 'Åsa', 'Åberg', 1500),
    ]
    // No games in the viewed round yet: all on 0 points, no tiebreaks → tied.
    const tied = standings(players, [], [], 1)
    expect(tied.map((r) => [r.name, r.place])).toEqual([
      ['Åsa Åberg', 1],
      ['Ärla Äberg', 1],
      ['Olle Öberg', 1],
    ])
  })

  it('given tied players "berg" and "Zeta", when standings are calculated, then lower-case "berg" is listed first (case-insensitive)', () => {
    const players = [player(1, 'Anna', 'Zeta', 1500), player(2, 'Anna', 'berg', 1500)]
    expect(standings(players, [], [], 1).map((r) => r.name)).toEqual(['Anna berg', 'Anna Zeta'])
  })

  it('given tied players with the same last name, when standings are calculated, then the first name decides', () => {
    const players = [player(1, 'Örjan', 'Berg', 1500), player(2, 'Åke', 'Berg', 1500)]
    expect(standings(players, [], [], 1).map((r) => r.name)).toEqual(['Åke Berg', 'Örjan Berg'])
  })

  it('given rows without last/first name, when standings are calculated, then the formatted name is compared with Swedish collation', () => {
    const players = [
      { ...player(1, 'Olle', 'Öberg', 1500), firstName: undefined, lastName: undefined },
      { ...player(2, 'Åsa', 'Åberg', 1500), firstName: undefined, lastName: undefined },
      { ...player(3, 'Bo', 'Berg', 1500), firstName: undefined, lastName: undefined },
    ]
    expect(standings(players, [], [], 1).map((r) => r.name)).toEqual([
      'Bo Berg',
      'Olle Öberg',
      'Åsa Åberg',
    ])
  })

  it('given the same players in reversed input order, when standings are calculated, then the output is identical', () => {
    const players = [
      player(1, 'Olle', 'Öberg', 1500),
      player(2, 'Ärla', 'Äberg', 1500),
      player(3, 'Åsa', 'Åberg', 1500),
      player(4, 'Bo', 'berg', 1500),
      player(5, 'Zack', 'Zeta', 1700),
    ]
    const games = [game(1, 1, 1, 2, 'DRAW'), game(1, 2, 3, 4, 'DRAW'), bye(1, 3, 5)]
    expect(standings([...players].reverse(), games, ['Buchholz'], 1)).toEqual(
      standings(players, games, ['Buchholz'], 1),
    )
  })

  it('given a higher-rated player behind on a tiebreak, when standings are calculated, then rating never changes the place', () => {
    // r1: A (1400) beats C, B (2000) beats D → A and B on 1 point.
    // Vinster both 1; Buchholz: A's opponent C 0, B's opponent D 0 → tied
    // on all tiebreaks → shared place 1, B listed first only because of rating.
    const players = [
      player(1, 'Anna', 'A', 1400),
      player(2, 'Bo', 'B', 2000),
      player(3, 'Cilla', 'C', 1500),
      player(4, 'Dan', 'D', 1500),
    ]
    const games = [game(1, 1, 1, 3, 'WHITE_WIN'), game(1, 2, 2, 4, 'WHITE_WIN')]
    const rows = standings(players, games, ['Buchholz', 'Vinster'], 1)
    expect(rows.map((r) => [r.name, r.place])).toEqual([
      ['Bo B', 1],
      ['Anna A', 1],
      ['Cilla C', 3],
      ['Dan D', 3],
    ])
  })
})

const ALL_TIEBREAKS = [
  'Inbördes möte',
  'Buchholz',
  'Median Buchholz',
  'SSF Buchholz',
  'Berger',
  'Progressiv',
  'Vinster',
  'Prestationsrating LASK',
  'Svarta partier',
  'Manuell',
]

// S5: five players, three rounds, one bye per round (ppg 1).
// r1 A–B ½-½, C–D 1-0, E bye
// r2 E–A 0-1, D–B 0-1, C bye
// r3 A–C 1-0, B–E ½-½, D bye
// Scores: A ½+1+1 = 2.5, B ½+1+½ = 2, C 1+1+0 = 2, D 0+0+1 = 1, E 1+0+½ = 1.5
const S5 = {
  players: [
    player(1, 'Anna', 'A', 1800),
    player(2, 'Bo', 'B', 1700, { manualTiebreak: 3 }),
    player(3, 'Cilla', 'C', 1600, { manualTiebreak: 7 }),
    player(4, 'Dan', 'D', 1500),
    player(5, 'Eva', 'E', 1400),
  ],
  games: [
    game(1, 1, 1, 2, 'DRAW'),
    game(1, 2, 3, 4, 'WHITE_WIN'),
    bye(1, 3, 5),
    game(2, 1, 5, 1, 'BLACK_WIN'),
    game(2, 2, 4, 2, 'BLACK_WIN'),
    bye(2, 3, 3),
    game(3, 1, 1, 3, 'WHITE_WIN'),
    game(3, 2, 2, 5, 'DRAW'),
    bye(3, 3, 4),
  ],
}

describe('Five players, all tiebreaks (S5)', () => {
  it('given S5 after round 3 with every tiebreak selected, when standings are calculated, then every value matches the hand computation', () => {
    // Opponent score for Buchholz/Median (bye/WO win/unplayed = ½):
    //   A ½+1+1 = 2.5, B ½+1+½ = 2, C 1+½+0 = 1.5, D 0+0+½ = ½, E ½+0+½ = 1
    // Buchholz (own bye = ½·3 = 1.5):
    //   A: B 2 + E 1 + C 1.5 = 4.5      B: A 2.5 + D ½ + E 1 = 4
    //   C: D ½ + bye 1.5 + A 2.5 = 4.5  D: C 1.5 + B 2 + bye 1.5 = 5
    //   E: bye 1.5 + A 2.5 + B 2 = 6
    // Median (drop min and max): A 4.5−1−2 = 1.5, B 4−½−2.5 = 1,
    //   C 4.5−½−2.5 = 1.5, D 5−1.5−2 = 1.5, E 6−1.5−2.5 = 2
    // SSF opponent score (opponent's bye = full win 1): A 2.5, B 2, C 1+1+0 = 2,
    //   D 0+0+1 = 1, E 1+0+½ = 1.5. Own bye = 0, drop the lowest:
    //   A [2, 1.5, 2] 5.5−1.5 = 4    B [2.5, 1, 1.5] 5−1 = 4
    //   C [1, 0, 2.5] 3.5−0 = 3.5    D [2, 2, 0] 4−0 = 4    E [0, 2.5, 2] 4.5−0 = 4.5
    // Berger (played games: opponent's total pairing score × own game score;
    //   totals A 2.5, B 2, C 2, D 1, E 1.5):
    //   A: B 2·½ + E 1.5·1 + C 2·1 = 4.5   B: A 2.5·½ + D 1·1 + E 1.5·½ = 3
    //   C: D 1·1 + A 2.5·0 = 1             D: 0      E: A 0 + B 2·½ = 1
    // Progressiv (3·r1 + 2·r2 + 1·r3): A 1.5+2+1 = 4.5, B 1.5+2+½ = 4,
    //   C 3+2+0 = 5, D 0+0+1 = 1, E 3+0+½ = 3.5
    // Vinster (WO wins yes, byes no): A 2, B 1, C 1, D 0, E 0
    // Prestationsrating (played games only, floor of avg):
    //   A: (1700+1400+1600)/3 = 1566, p 2.5/3 = .833 > .83 → +284 = 1850
    //   B: (1800+1500+1400)/3 = 1566, p 2/3 = .667 > .66 → +125 = 1691
    //   C: (1500+1800)/2 = 1650, p .5 → +0 = 1650
    //   D: (1600+1700)/2 = 1650, p 0 → mirrored 1 > .99 → −800 = 850
    //   E: (1800+1700)/2 = 1750, p .25 → mirrored .75 > .74 → −193 = 1557
    // Svarta partier (black games, byes excluded): A 1, B 2, C 1, D 1, E 1
    // Manuell: B 3, C 7, others 0
    // Inbördes möte first: only B and C share a score (2) and they never met → 0.
    // Order: A 2.5; C and B on 2 → Inb 0/0, Buchholz C 4.5 > B 4; E 1.5; D 1.
    const rows = standings(S5.players, S5.games, ALL_TIEBREAKS, 3)
    expect(rows.map((r) => [r.place, r.name, r.scoreDisplay])).toEqual([
      [1, 'Anna A', '2½'],
      [2, 'Cilla C', '2'],
      [3, 'Bo B', '2'],
      [4, 'Eva E', '1½'],
      [5, 'Dan D', '1'],
    ])
    const tb = (name: string) => rows.find((r) => r.name === name)!.tiebreaks
    // biome-ignore format: one row per player reads like the standings table
    {
      expect(tb('Anna A')).toEqual({ Inb: '0', Buch: '4.5', 'M.Buch': '1.5', SSFBuch: '4', Berg: '4.5', Prog: '4.5', Vin: '2', Pres: '1850', Svart: '1', Man: '0' })
      expect(tb('Bo B')).toEqual({ Inb: '0', Buch: '4', 'M.Buch': '1', SSFBuch: '4', Berg: '3', Prog: '4', Vin: '1', Pres: '1691', Svart: '2', Man: '3' })
      expect(tb('Cilla C')).toEqual({ Inb: '0', Buch: '4.5', 'M.Buch': '1.5', SSFBuch: '3.5', Berg: '1', Prog: '5', Vin: '1', Pres: '1650', Svart: '1', Man: '7' })
      expect(tb('Dan D')).toEqual({ Inb: '0', Buch: '5', 'M.Buch': '1.5', SSFBuch: '4', Berg: '0', Prog: '1', Vin: '0', Pres: '850', Svart: '1', Man: '0' })
      expect(tb('Eva E')).toEqual({ Inb: '0', Buch: '6', 'M.Buch': '2', SSFBuch: '4.5', Berg: '1', Prog: '3.5', Vin: '0', Pres: '1557', Svart: '1', Man: '0' })
    }
  })
})

// W: walkovers. Ratings A 1800, B 1700, C 1600, D 1500.
// r1 A–B 1-0 WO, C–D ½-½;  r2 A–C 1-0, D–B 0-1 WO.
// Scores: A 1+1 = 2, B 0+1 = 1, C ½+0 = ½, D ½+0 = ½.
const W = {
  players: [
    player(1, 'Anna', 'A', 1800),
    player(2, 'Bo', 'B', 1700),
    player(3, 'Cilla', 'C', 1600),
    player(4, 'Dan', 'D', 1500),
  ],
  games: [
    game(1, 1, 1, 2, 'WHITE_WIN_WO'),
    game(1, 2, 3, 4, 'DRAW'),
    game(2, 1, 1, 3, 'WHITE_WIN'),
    game(2, 2, 4, 2, 'BLACK_WIN_WO'),
  ],
  tiebreaks: [
    'Buchholz',
    'SSF Buchholz',
    'Berger',
    'Vinster',
    'Svarta partier',
    'Prestationsrating LASK',
  ],
}

describe('Walkovers (W)', () => {
  it('given WO wins and losses, when standings are calculated, then WO wins score fully and each tiebreak treats them by its own convention', () => {
    // Buchholz opponent score (opponent's WO win = ½, WO loss = its 0):
    //   A ½+1 = 1.5, B 0+½ = ½, C ½+0 = ½, D ½+0 = ½
    //   Buch: A B ½ + C ½ = 1, B A 1.5 + D ½ = 2, C D ½ + A 1.5 = 2, D C ½ + B ½ = 1
    // SSF opponent score (WO win counts in full): A 2, B 0+1 = 1, C ½, D ½
    //   SSF (drop lowest): A [1, ½] = 1, B [2, ½] = 2, C [½, 2] = 2, D [½, 1] = 1
    // Berger (WO games excluded; totals A 2, B 1, C ½, D ½):
    //   A: C ½·1 = ½, B: 0, C: D ½·½ = .25, D: C ½·½ = .25
    // Vinster: A 2 (one by WO), B 1 (WO), C 0, D 0
    // Svarta partier (WO games count): A 0, B 2, C 1, D 1
    // Prestationsrating (WO games excluded): A: C 1600 W → +800 = 2400;
    //   B: no played game → 0; C: (1500+1800)/2 = 1650, p .25 → −193 = 1457;
    //   D: C 1600, p .5 → 1600
    // Order: A 2, B 1, then C/D on ½ split by Buchholz C 2 > D 1.
    const rows = standings(W.players, W.games, W.tiebreaks, 2)
    expect(rows.map((r) => [r.place, r.name, r.score])).toEqual([
      [1, 'Anna A', 2],
      [2, 'Bo B', 1],
      [3, 'Cilla C', 0.5],
      [4, 'Dan D', 0.5],
    ])
    const tb = (name: string) => rows.find((r) => r.name === name)!.tiebreaks
    // biome-ignore format: one row per player
    {
      expect(tb('Anna A')).toEqual({ Buch: '1', SSFBuch: '1', Berg: '0.5', Vin: '2', Svart: '0', Pres: '2400' })
      expect(tb('Bo B')).toEqual({ Buch: '2', SSFBuch: '2', Berg: '0', Vin: '1', Svart: '2', Pres: '0' })
      expect(tb('Cilla C')).toEqual({ Buch: '2', SSFBuch: '2', Berg: '0.25', Vin: '0', Svart: '1', Pres: '1457' })
      expect(tb('Dan D')).toEqual({ Buch: '1', SSFBuch: '1', Berg: '0.25', Vin: '0', Svart: '1', Pres: '1600' })
    }
  })
})

describe('Unplayed games (U)', () => {
  it('given a postponed game and a game without result, when standings are calculated, then both score 0 but count ½ as opponent score', () => {
    // Ratings A 1800, B 1700, C 1600, D 1500.
    // r1 A–B 1-0, C–D postponed;  r2 A–C no result yet, B–D 1-0.
    // Scores: A 1+0 = 1, B 0+1 = 1, C 0+0 = 0, D 0+0 = 0 (postponed = 0).
    // Buchholz opponent score (unplayed = ½): A 1+½ = 1.5, B 0+1 = 1,
    //   C ½+½ = 1, D ½+0 = ½
    //   Buch: A B 1 + C 1 = 2, B A 1.5 + D ½ = 2, C D ½ + A 1.5 = 2, D C 1 + B 1 = 2
    // Progressiv (2·r1 + 1·r2): A 2, B 1, C 0, D 0
    // Berger (played games only; opponent totals use pairing scores, where a
    //   postponed game gives both players the win points 1):
    //   A: B total 0+1 = 1, ·1 = 1;  B: D total 1+0 = 1, ·1 = 1;  C 0;  D 0
    // Prestationsrating: A: B 1700 W → 2500; B: (1800+1500)/2 = 1650, p .5 → 1650;
    //   C: no played game → 0; D: B 1700 L → −800 = 900
    // Order: A/B on 1, Buch tied, Prog A 2 > B 1. C/D on 0, Buch, Prog, Berger
    //   tied, Pres D 900 > C 0.
    const players = [
      player(1, 'Anna', 'A', 1800),
      player(2, 'Bo', 'B', 1700),
      player(3, 'Cilla', 'C', 1600),
      player(4, 'Dan', 'D', 1500),
    ]
    const games = [
      game(1, 1, 1, 2, 'WHITE_WIN'),
      game(1, 2, 3, 4, 'POSTPONED'),
      game(2, 1, 1, 3, 'NO_RESULT'),
      game(2, 2, 2, 4, 'WHITE_WIN'),
    ]
    const rows = standings(
      players,
      games,
      ['Buchholz', 'Progressiv', 'Berger', 'Prestationsrating LASK'],
      2,
    )
    expect(rows.map((r) => [r.place, r.name, r.score])).toEqual([
      [1, 'Anna A', 1],
      [2, 'Bo B', 1],
      [3, 'Dan D', 0],
      [4, 'Cilla C', 0],
    ])
    const tb = (name: string) => rows.find((r) => r.name === name)!.tiebreaks
    expect(tb('Anna A')).toEqual({ Buch: '2', Prog: '2', Berg: '1', Pres: '2500' })
    expect(tb('Bo B')).toEqual({ Buch: '2', Prog: '1', Berg: '1', Pres: '1650' })
    expect(tb('Cilla C')).toEqual({ Buch: '2', Prog: '0', Berg: '0', Pres: '0' })
    expect(tb('Dan D')).toEqual({ Buch: '2', Prog: '0', Berg: '0', Pres: '900' })
  })
})

describe('Manual tiebreak (MAN)', () => {
  it('given two players tied on score with manual values 1 and 2, when standings are calculated, then the higher manual value ranks first', () => {
    const players = [
      player(1, 'Anna', 'A', 1800, { manualTiebreak: 1 }),
      player(2, 'Bo', 'B', 1700, { manualTiebreak: 2 }),
    ]
    const rows = standings(players, [game(1, 1, 1, 2, 'DRAW')], ['Manuell'], 1)
    expect(rows.map((r) => [r.place, r.name, r.tiebreaks.Man])).toEqual([
      [1, 'Bo B', '2'],
      [2, 'Anna A', '1'],
    ])
  })

  it('given equal manual values, when standings are calculated, then the players share the place', () => {
    const players = [
      player(1, 'Anna', 'A', 1800, { manualTiebreak: 5 }),
      player(2, 'Bo', 'B', 1700, { manualTiebreak: 5 }),
    ]
    const rows = standings(players, [game(1, 1, 1, 2, 'DRAW')], ['Manuell'], 1)
    expect(rows.map((r) => r.place)).toEqual([1, 1])
  })
})

describe('Points per game 2 (PPG2)', () => {
  it('given ppg 2 with a bye each round, when standings are calculated, then scores and tiebreaks scale with ppg', () => {
    // ppg 2: win 2, draw 1, bye 2.
    // r1 A–B 2-0, C bye;  r2 B–C 1-1, A bye;  r3 C–A 0-2, B bye.
    // Scores: A 2+2+2 = 6, B 0+1+2 = 3, C 2+1+0 = 3.
    // Buchholz opponent score (bye = ppg/2 = 1): A 2+1+2 = 5, B 0+1+1 = 2, C 1+1+0 = 2
    //   Own bye = (ppg/2)·3 = 3.
    //   A: B 2 + bye 3 + C 2 = 7;  B: A 5 + C 2 + bye 3 = 10;  C: bye 3 + B 2 + A 5 = 10
    // Inbördes möte (after Buchholz, B and C still tied): drew each other → 1 each.
    // Progressiv: A 3·2+2·2+1·2 = 12, B 0+2·1+2 = 4, C 3·2+2·1+0 = 8 → C ahead of B.
    const scoring = { pointsPerGame: 2 }
    const players = [
      player(1, 'Anna', 'A', 1800),
      player(2, 'Bo', 'B', 1700),
      player(3, 'Cilla', 'C', 1600),
    ]
    const games = [
      game(1, 1, 1, 2, 'WHITE_WIN', scoring),
      bye(1, 2, 3, scoring),
      game(2, 1, 2, 3, 'DRAW', scoring),
      bye(2, 2, 1, scoring),
      game(3, 1, 3, 1, 'BLACK_WIN', scoring),
      bye(3, 2, 2, scoring),
    ]
    const rows = standings(players, games, ['Buchholz', 'Inbördes möte', 'Progressiv'], 3, {
      pointsPerGame: 2,
    })
    expect(rows.map((r) => [r.place, r.name, r.scoreDisplay, r.tiebreaks])).toEqual([
      [1, 'Anna A', '6', { Buch: '7', Inb: '0', Prog: '12' }],
      [2, 'Cilla C', '3', { Buch: '10', Inb: '1', Prog: '8' }],
      [3, 'Bo B', '3', { Buch: '10', Inb: '1', Prog: '4' }],
    ])
  })
})

describe('Club standings (CLUB)', () => {
  it('given S5 with clubs Alfa (A, D), Beta (B, E), Gamma (C), when club standings are calculated, then totals are summed and equal totals share a place', () => {
    // Alfa: A 2.5 + D 1 = 3.5; Beta: B 2 + E 1.5 = 3.5; Gamma: C 2.
    const club = (name: string) => ({ club: name, clubId: name.length })
    const players = [
      { ...S5.players[0], ...club('Alfa') },
      { ...S5.players[1], ...club('Beta') },
      { ...S5.players[2], ...club('Gamma') },
      { ...S5.players[3], ...club('Alfa') },
      { ...S5.players[4], ...club('Beta') },
    ]
    const rows = calculateClubStandings({
      roundNr: 3,
      pointsPerGame: 1,
      compensateWeakPlayerPP: false,
      selectedTiebreaks: [],
      players,
      games: S5.games,
    })
    expect(rows.map((r) => [r.place, r.club, r.score])).toEqual([
      [1, 'Alfa', 3.5],
      [1, 'Beta', 3.5],
      [3, 'Gamma', 2],
    ])
  })

  it('given a player without a club, when club standings are calculated, then that player is not counted', () => {
    // Alfa: A 2.5 (D has no club); Beta: B 2 + E 1.5 = 3.5; Gamma: C 2.
    const players = [
      { ...S5.players[0], club: 'Alfa', clubId: 1 },
      { ...S5.players[1], club: 'Beta', clubId: 2 },
      { ...S5.players[2], club: 'Gamma', clubId: 3 },
      { ...S5.players[3], club: null, clubId: 0 },
      { ...S5.players[4], club: 'Beta', clubId: 2 },
    ]
    const rows = calculateClubStandings({
      roundNr: 3,
      pointsPerGame: 1,
      compensateWeakPlayerPP: false,
      selectedTiebreaks: [],
      players,
      games: S5.games,
    })
    expect(rows.map((r) => [r.place, r.club, r.score])).toEqual([
      [1, 'Beta', 3.5],
      [2, 'Alfa', 2.5],
      [3, 'Gamma', 2],
    ])
  })
})

describe('Locked tiebreak conventions (A7)', () => {
  // These conventions were reviewed and deliberately kept. Changing any of
  // them needs an adjudicated spec, not a test update.

  it('given a player with an own bye, when Buchholz is calculated, then the bye counts (ppg/2)·roundNr (½ model)', () => {
    // S5 E: own bye ½·3 = 1.5 + A 2.5 + B 2 = 6.
    const rows = byName(standings(S5.players, S5.games, ['Buchholz'], 3))
    expect(rows['Eva E'].tiebreaks.Buch).toBe('6')
  })

  it('given byes, when SSF Buchholz is calculated, then the own bye adds 0, an opponent bye counts as a full win and the lowest value is dropped', () => {
    // S5 C: D (0+0+bye 1 = 1) + own bye 0 + A 2.5 → 3.5 − lowest 0 = 3.5.
    const rows = byName(standings(S5.players, S5.games, ['SSF Buchholz'], 3))
    expect(rows['Cilla C'].tiebreaks.SSFBuch).toBe('3.5')
  })

  it('given byes and walkovers, when Berger is calculated, then only played games count while opponent totals include bye and WO points', () => {
    // W A: WO vs B excluded; C (total ½) · 1 = 0.5.
    // S5 C: D's total includes D's bye (1) → 1·1 = 1.
    expect(byName(standings(W.players, W.games, ['Berger'], 2))['Anna A'].tiebreaks.Berg).toBe(
      '0.5',
    )
    expect(byName(standings(S5.players, S5.games, ['Berger'], 3))['Cilla C'].tiebreaks.Berg).toBe(
      '1',
    )
  })

  it('given WO wins and byes, when Vinster is calculated, then WO wins count and byes do not', () => {
    // W A: one OTB win + one WO win = 2. S5 C: one win + one bye = 1.
    expect(byName(standings(W.players, W.games, ['Vinster'], 2))['Anna A'].tiebreaks.Vin).toBe('2')
    expect(byName(standings(S5.players, S5.games, ['Vinster'], 3))['Cilla C'].tiebreaks.Vin).toBe(
      '1',
    )
  })

  it('given WO games with black and byes, when Svarta partier is calculated, then WO black games count and byes do not', () => {
    // W B: black in both rounds, both WO = 2. S5 E: one black game + one bye = 1.
    expect(
      byName(standings(W.players, W.games, ['Svarta partier'], 2))['Bo B'].tiebreaks.Svart,
    ).toBe('2')
    expect(
      byName(standings(S5.players, S5.games, ['Svarta partier'], 3))['Eva E'].tiebreaks.Svart,
    ).toBe('1')
  })
})
