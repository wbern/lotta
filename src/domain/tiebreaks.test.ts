import { describe, expect, it } from 'vitest'
import type { TiebreakContext, TiebreakGameInfo } from './tiebreaks.ts'
import {
  tiebreakBerger,
  tiebreakBlacks,
  tiebreakBuchholz,
  tiebreakInternalMeeting,
  tiebreakManual,
  tiebreakMedianBuchholz,
  tiebreakProgressive,
  tiebreakRatingPerformance,
  tiebreakSSFBuchholz,
  tiebreakWins,
} from './tiebreaks.ts'

describe('tiebreakWins', () => {
  it('counts wins for a player', () => {
    const games: TiebreakGameInfo[] = [
      {
        roundNr: 1,
        side: 'white',
        resultType: 'WHITE_WIN',
        whiteScore: 1,
        blackScore: 0,
        opponentId: 2,
        opponentRating: 1500,
        isBye: false,
      },
      {
        roundNr: 2,
        side: 'black',
        resultType: 'BLACK_WIN',
        whiteScore: 0,
        blackScore: 1,
        opponentId: 3,
        opponentRating: 1400,
        isBye: false,
      },
      {
        roundNr: 3,
        side: 'white',
        resultType: 'DRAW',
        whiteScore: 0.5,
        blackScore: 0.5,
        opponentId: 4,
        opponentRating: 1600,
        isBye: false,
      },
    ]
    expect(tiebreakWins(games, 3)).toBe(2)
  })

  it('counts walkovers as wins', () => {
    const games: TiebreakGameInfo[] = [
      {
        roundNr: 1,
        side: 'white',
        resultType: 'WHITE_WIN_WO',
        whiteScore: 1,
        blackScore: 0,
        opponentId: 2,
        opponentRating: 1500,
        isBye: false,
      },
      {
        roundNr: 2,
        side: 'black',
        resultType: 'BLACK_WIN_WO',
        whiteScore: 0,
        blackScore: 1,
        opponentId: 3,
        opponentRating: 1400,
        isBye: false,
      },
    ]
    expect(tiebreakWins(games, 2)).toBe(2)
  })

  it('only counts games up to the specified round', () => {
    const games: TiebreakGameInfo[] = [
      {
        roundNr: 1,
        side: 'white',
        resultType: 'WHITE_WIN',
        whiteScore: 1,
        blackScore: 0,
        opponentId: 2,
        opponentRating: 1500,
        isBye: false,
      },
      {
        roundNr: 2,
        side: 'white',
        resultType: 'WHITE_WIN',
        whiteScore: 1,
        blackScore: 0,
        opponentId: 3,
        opponentRating: 1400,
        isBye: false,
      },
      {
        roundNr: 3,
        side: 'white',
        resultType: 'WHITE_WIN',
        whiteScore: 1,
        blackScore: 0,
        opponentId: 4,
        opponentRating: 1600,
        isBye: false,
      },
    ]
    expect(tiebreakWins(games, 2)).toBe(2)
  })

  it('ignores byes', () => {
    const games: TiebreakGameInfo[] = [
      {
        roundNr: 1,
        side: 'white',
        resultType: 'WHITE_WIN',
        whiteScore: 1,
        blackScore: 0,
        opponentId: null,
        opponentRating: 0,
        isBye: true,
      },
    ]
    expect(tiebreakWins(games, 1)).toBe(0)
  })
})

describe('tiebreakBlacks', () => {
  it('counts games played as black', () => {
    const games: TiebreakGameInfo[] = [
      {
        roundNr: 1,
        side: 'white',
        resultType: 'WHITE_WIN',
        whiteScore: 1,
        blackScore: 0,
        opponentId: 2,
        opponentRating: 1500,
        isBye: false,
      },
      {
        roundNr: 2,
        side: 'black',
        resultType: 'DRAW',
        whiteScore: 0.5,
        blackScore: 0.5,
        opponentId: 3,
        opponentRating: 1400,
        isBye: false,
      },
      {
        roundNr: 3,
        side: 'black',
        resultType: 'BLACK_WIN',
        whiteScore: 0,
        blackScore: 1,
        opponentId: 4,
        opponentRating: 1600,
        isBye: false,
      },
    ]
    expect(tiebreakBlacks(games, 3)).toBe(2)
  })

  it('ignores byes', () => {
    const games: TiebreakGameInfo[] = [
      {
        roundNr: 1,
        side: 'black',
        resultType: 'BLACK_WIN',
        whiteScore: 0,
        blackScore: 1,
        opponentId: null,
        opponentRating: 0,
        isBye: true,
      },
    ]
    expect(tiebreakBlacks(games, 1)).toBe(0)
  })
})

describe('tiebreakManual', () => {
  it('returns the manual tiebreak value', () => {
    expect(tiebreakManual(5)).toBe(5)
  })

  it('returns 0 when value is 0', () => {
    expect(tiebreakManual(0)).toBe(0)
  })
})

describe('tiebreakProgressive', () => {
  it('calculates running score sum with multipliers', () => {
    // Round 1: score 1, multiplier=3 (3-1+1=3)
    // Round 2: score 0.5, multiplier=2 (3-2+1=2)
    // Round 3: score 1, multiplier=1 (3-3+1=1)
    // Total: 1*3 + 0.5*2 + 1*1 = 3+1+1 = 5
    const games: TiebreakGameInfo[] = [
      {
        roundNr: 1,
        side: 'white',
        resultType: 'WHITE_WIN',
        whiteScore: 1,
        blackScore: 0,
        opponentId: 2,
        opponentRating: 1500,
        isBye: false,
      },
      {
        roundNr: 2,
        side: 'white',
        resultType: 'DRAW',
        whiteScore: 0.5,
        blackScore: 0.5,
        opponentId: 3,
        opponentRating: 1400,
        isBye: false,
      },
      {
        roundNr: 3,
        side: 'black',
        resultType: 'BLACK_WIN',
        whiteScore: 0,
        blackScore: 1,
        opponentId: 4,
        opponentRating: 1600,
        isBye: false,
      },
    ]
    expect(tiebreakProgressive(games, 3)).toBe(5)
  })

  it('uses actual scores (not pairing scores) — POSTPONED gives 0', () => {
    // Postponed with both players → actual score 0
    const games: TiebreakGameInfo[] = [
      {
        roundNr: 1,
        side: 'white',
        resultType: 'POSTPONED',
        whiteScore: 1,
        blackScore: 1,
        opponentId: 2,
        opponentRating: 1500,
        isBye: false,
      },
    ]
    // Progressive uses game.getScore() which returns 0 for POSTPONED with both players
    expect(tiebreakProgressive(games, 1)).toBe(0)
  })
})

describe('tiebreakBuchholz', () => {
  // Player 1 played: beat P2 (round 1), drew P3 (round 2), lost to P4 (round 3)
  // P2 score: lost R1 (0), won R3 (1) = total tiebreak score 1
  //   But as opponent, P2's tiebreak-score uses pairing score except for unplayed/bye/WO which use 0.5
  // P3 score: drew R2 (0.5), won R1 (1) = total tiebreak score 1.5
  // P4 score: won R3 (1), lost R2 (0) = total tiebreak score 1
  // Buchholz for P1 = P2_tiebreak_score + P3_tiebreak_score + P4_tiebreak_score
  it('sums opponent tiebreak scores', () => {
    // Simple scenario: 3 rounds, 4 players
    // Player 1 games
    const p1Games: TiebreakGameInfo[] = [
      {
        roundNr: 1,
        side: 'white',
        resultType: 'WHITE_WIN',
        whiteScore: 1,
        blackScore: 0,
        opponentId: 2,
        opponentRating: 1500,
        isBye: false,
      },
      {
        roundNr: 2,
        side: 'white',
        resultType: 'DRAW',
        whiteScore: 0.5,
        blackScore: 0.5,
        opponentId: 3,
        opponentRating: 1400,
        isBye: false,
      },
      {
        roundNr: 3,
        side: 'black',
        resultType: 'BLACK_WIN',
        whiteScore: 0,
        blackScore: 1,
        opponentId: 4,
        opponentRating: 1600,
        isBye: false,
      },
    ]

    // P2 games: lost to P1 (R1), beat P4 (R2), drew P3 (R3)
    const p2Games: TiebreakGameInfo[] = [
      {
        roundNr: 1,
        side: 'black',
        resultType: 'WHITE_WIN',
        whiteScore: 1,
        blackScore: 0,
        opponentId: 1,
        opponentRating: 1500,
        isBye: false,
      },
      {
        roundNr: 2,
        side: 'white',
        resultType: 'WHITE_WIN',
        whiteScore: 1,
        blackScore: 0,
        opponentId: 4,
        opponentRating: 1600,
        isBye: false,
      },
      {
        roundNr: 3,
        side: 'black',
        resultType: 'DRAW',
        whiteScore: 0.5,
        blackScore: 0.5,
        opponentId: 3,
        opponentRating: 1400,
        isBye: false,
      },
    ]

    // P3 games: beat P4 (R1), drew P1 (R2), drew P2 (R3)
    const p3Games: TiebreakGameInfo[] = [
      {
        roundNr: 1,
        side: 'white',
        resultType: 'WHITE_WIN',
        whiteScore: 1,
        blackScore: 0,
        opponentId: 4,
        opponentRating: 1600,
        isBye: false,
      },
      {
        roundNr: 2,
        side: 'black',
        resultType: 'DRAW',
        whiteScore: 0.5,
        blackScore: 0.5,
        opponentId: 1,
        opponentRating: 1500,
        isBye: false,
      },
      {
        roundNr: 3,
        side: 'white',
        resultType: 'DRAW',
        whiteScore: 0.5,
        blackScore: 0.5,
        opponentId: 2,
        opponentRating: 1500,
        isBye: false,
      },
    ]

    // P4 games: lost to P3 (R1), lost to P2 (R2), lost to P1 (R3)
    const p4Games: TiebreakGameInfo[] = [
      {
        roundNr: 1,
        side: 'black',
        resultType: 'WHITE_WIN',
        whiteScore: 1,
        blackScore: 0,
        opponentId: 3,
        opponentRating: 1400,
        isBye: false,
      },
      {
        roundNr: 2,
        side: 'black',
        resultType: 'WHITE_WIN',
        whiteScore: 1,
        blackScore: 0,
        opponentId: 2,
        opponentRating: 1500,
        isBye: false,
      },
      {
        roundNr: 3,
        side: 'white',
        resultType: 'BLACK_WIN',
        whiteScore: 0,
        blackScore: 1,
        opponentId: 1,
        opponentRating: 1500,
        isBye: false,
      },
    ]

    const ctx: TiebreakContext = {
      pointsPerGame: 2,
      chess4: false,
      compensateWeakPlayerPP: false,
      getPlayerGames: (playerId: number) => {
        if (playerId === 1) return p1Games
        if (playerId === 2) return p2Games
        if (playerId === 3) return p3Games
        if (playerId === 4) return p4Games
        return []
      },
    }

    // P2 tiebreak score: lost R1 (0 pairing score), won R2 (1), drew R3 (0.5) = 1.5
    // P3 tiebreak score: won R1 (1), drew R2 (0.5), drew R3 (0.5) = 2
    // P4 tiebreak score: lost R1 (0), lost R2 (0), lost R3 (0) = 0
    // Buchholz for P1 = 1.5 + 2 + 0 = 3.5
    expect(tiebreakBuchholz(p1Games, 3, ctx)).toBe(3.5)
  })

  it('treats byes as half points per round for buchholz', () => {
    const games: TiebreakGameInfo[] = [
      {
        roundNr: 1,
        side: 'white',
        resultType: 'WHITE_WIN',
        whiteScore: 1,
        blackScore: 0,
        opponentId: null,
        opponentRating: 0,
        isBye: true,
      },
      {
        roundNr: 2,
        side: 'white',
        resultType: 'WHITE_WIN',
        whiteScore: 1,
        blackScore: 0,
        opponentId: 2,
        opponentRating: 1500,
        isBye: false,
      },
    ]

    // P2: won R1, lost R2 (lost to P1)
    const p2Games: TiebreakGameInfo[] = [
      {
        roundNr: 1,
        side: 'white',
        resultType: 'WHITE_WIN',
        whiteScore: 1,
        blackScore: 0,
        opponentId: 3,
        opponentRating: 1400,
        isBye: false,
      },
      {
        roundNr: 2,
        side: 'black',
        resultType: 'WHITE_WIN',
        whiteScore: 1,
        blackScore: 0,
        opponentId: 1,
        opponentRating: 1500,
        isBye: false,
      },
    ]

    const ctx: TiebreakContext = {
      pointsPerGame: 2,
      chess4: false,
      compensateWeakPlayerPP: false,
      getPlayerGames: (playerId: number) => {
        if (playerId === 2) return p2Games
        return []
      },
    }

    // Bye in R1 with roundNr=2: buchholz bye = pointsPerGame/2 * roundNr = 1 * 2 = 2
    // P2 tiebreak score: won R1 (1) + lost R2 (0) = 1
    // Total = 2 + 1 = 3
    expect(tiebreakBuchholz(games, 2, ctx)).toBe(3)
  })
})

describe('tiebreakMedianBuchholz', () => {
  it('removes highest and lowest opponent scores when >2 rounds', () => {
    // Player 1 plays P2, P3, P4 over 3 rounds
    const p1Games: TiebreakGameInfo[] = [
      {
        roundNr: 1,
        side: 'white',
        resultType: 'WHITE_WIN',
        whiteScore: 1,
        blackScore: 0,
        opponentId: 2,
        opponentRating: 1500,
        isBye: false,
      },
      {
        roundNr: 2,
        side: 'white',
        resultType: 'DRAW',
        whiteScore: 0.5,
        blackScore: 0.5,
        opponentId: 3,
        opponentRating: 1400,
        isBye: false,
      },
      {
        roundNr: 3,
        side: 'black',
        resultType: 'BLACK_WIN',
        whiteScore: 0,
        blackScore: 1,
        opponentId: 4,
        opponentRating: 1600,
        isBye: false,
      },
    ]

    // P2: 0 + 1 + 0.5 = 1.5 tiebreak score
    const p2Games: TiebreakGameInfo[] = [
      {
        roundNr: 1,
        side: 'black',
        resultType: 'WHITE_WIN',
        whiteScore: 1,
        blackScore: 0,
        opponentId: 1,
        opponentRating: 1500,
        isBye: false,
      },
      {
        roundNr: 2,
        side: 'white',
        resultType: 'WHITE_WIN',
        whiteScore: 1,
        blackScore: 0,
        opponentId: 4,
        opponentRating: 1600,
        isBye: false,
      },
      {
        roundNr: 3,
        side: 'black',
        resultType: 'DRAW',
        whiteScore: 0.5,
        blackScore: 0.5,
        opponentId: 3,
        opponentRating: 1400,
        isBye: false,
      },
    ]

    // P3: 1 + 0.5 + 0.5 = 2.0 tiebreak score
    const p3Games: TiebreakGameInfo[] = [
      {
        roundNr: 1,
        side: 'white',
        resultType: 'WHITE_WIN',
        whiteScore: 1,
        blackScore: 0,
        opponentId: 4,
        opponentRating: 1600,
        isBye: false,
      },
      {
        roundNr: 2,
        side: 'black',
        resultType: 'DRAW',
        whiteScore: 0.5,
        blackScore: 0.5,
        opponentId: 1,
        opponentRating: 1500,
        isBye: false,
      },
      {
        roundNr: 3,
        side: 'white',
        resultType: 'DRAW',
        whiteScore: 0.5,
        blackScore: 0.5,
        opponentId: 2,
        opponentRating: 1500,
        isBye: false,
      },
    ]

    // P4: 0 + 0 + 0 = 0.0 tiebreak score
    const p4Games: TiebreakGameInfo[] = [
      {
        roundNr: 1,
        side: 'black',
        resultType: 'WHITE_WIN',
        whiteScore: 1,
        blackScore: 0,
        opponentId: 3,
        opponentRating: 1400,
        isBye: false,
      },
      {
        roundNr: 2,
        side: 'black',
        resultType: 'WHITE_WIN',
        whiteScore: 1,
        blackScore: 0,
        opponentId: 2,
        opponentRating: 1500,
        isBye: false,
      },
      {
        roundNr: 3,
        side: 'white',
        resultType: 'BLACK_WIN',
        whiteScore: 0,
        blackScore: 1,
        opponentId: 1,
        opponentRating: 1500,
        isBye: false,
      },
    ]

    const ctx: TiebreakContext = {
      pointsPerGame: 2,
      chess4: false,
      compensateWeakPlayerPP: false,
      getPlayerGames: (id: number) => {
        if (id === 1) return p1Games
        if (id === 2) return p2Games
        if (id === 3) return p3Games
        if (id === 4) return p4Games
        return []
      },
    }

    // Opponent scores: P2=1.5, P3=2.0, P4=0.0
    // Remove min (0.0) and max (2.0): 1.5
    expect(tiebreakMedianBuchholz(p1Games, 3, ctx)).toBe(1.5)
  })

  it('does not remove min/max when <=2 rounds', () => {
    const games: TiebreakGameInfo[] = [
      {
        roundNr: 1,
        side: 'white',
        resultType: 'WHITE_WIN',
        whiteScore: 1,
        blackScore: 0,
        opponentId: 2,
        opponentRating: 1500,
        isBye: false,
      },
      {
        roundNr: 2,
        side: 'white',
        resultType: 'DRAW',
        whiteScore: 0.5,
        blackScore: 0.5,
        opponentId: 3,
        opponentRating: 1400,
        isBye: false,
      },
    ]

    const p2Games: TiebreakGameInfo[] = [
      {
        roundNr: 1,
        side: 'black',
        resultType: 'WHITE_WIN',
        whiteScore: 1,
        blackScore: 0,
        opponentId: 1,
        opponentRating: 1500,
        isBye: false,
      },
      {
        roundNr: 2,
        side: 'white',
        resultType: 'WHITE_WIN',
        whiteScore: 1,
        blackScore: 0,
        opponentId: 3,
        opponentRating: 1400,
        isBye: false,
      },
    ]

    const p3Games: TiebreakGameInfo[] = [
      {
        roundNr: 1,
        side: 'white',
        resultType: 'WHITE_WIN',
        whiteScore: 1,
        blackScore: 0,
        opponentId: 4,
        opponentRating: 1600,
        isBye: false,
      },
      {
        roundNr: 2,
        side: 'black',
        resultType: 'WHITE_WIN',
        whiteScore: 1,
        blackScore: 0,
        opponentId: 2,
        opponentRating: 1500,
        isBye: false,
      },
    ]

    const ctx: TiebreakContext = {
      pointsPerGame: 2,
      chess4: false,
      compensateWeakPlayerPP: false,
      getPlayerGames: (id: number) => {
        if (id === 2) return p2Games
        if (id === 3) return p3Games
        return []
      },
    }

    // P2 score: 0+1=1, P3 score: 1+0=1
    // <=2 rounds, so no removal: 1+1=2
    expect(tiebreakMedianBuchholz(games, 2, ctx)).toBe(2)
  })
})

describe('tiebreakSSFBuchholz', () => {
  it('removes lowest opponent score and gives 0 for byes (not half)', () => {
    const games: TiebreakGameInfo[] = [
      {
        roundNr: 1,
        side: 'white',
        resultType: 'WHITE_WIN',
        whiteScore: 1,
        blackScore: 0,
        opponentId: 2,
        opponentRating: 1500,
        isBye: false,
      },
      {
        roundNr: 2,
        side: 'white',
        resultType: 'WHITE_WIN',
        whiteScore: 1,
        blackScore: 0,
        opponentId: 3,
        opponentRating: 1400,
        isBye: false,
      },
    ]

    // P2: won R1(but lost to P1, so 0), won R2(1) = 1
    const p2Games: TiebreakGameInfo[] = [
      {
        roundNr: 1,
        side: 'black',
        resultType: 'WHITE_WIN',
        whiteScore: 1,
        blackScore: 0,
        opponentId: 1,
        opponentRating: 1500,
        isBye: false,
      },
      {
        roundNr: 2,
        side: 'white',
        resultType: 'WHITE_WIN',
        whiteScore: 1,
        blackScore: 0,
        opponentId: 4,
        opponentRating: 1600,
        isBye: false,
      },
    ]

    // P3: 0.5 + 0 = 0.5
    const p3Games: TiebreakGameInfo[] = [
      {
        roundNr: 1,
        side: 'white',
        resultType: 'DRAW',
        whiteScore: 0.5,
        blackScore: 0.5,
        opponentId: 4,
        opponentRating: 1600,
        isBye: false,
      },
      {
        roundNr: 2,
        side: 'black',
        resultType: 'WHITE_WIN',
        whiteScore: 1,
        blackScore: 0,
        opponentId: 1,
        opponentRating: 1500,
        isBye: false,
      },
    ]

    const ctx: TiebreakContext = {
      pointsPerGame: 2,
      chess4: false,
      compensateWeakPlayerPP: false,
      getPlayerGames: (id: number) => {
        if (id === 2) return p2Games
        if (id === 3) return p3Games
        return []
      },
    }

    // P2 SSF score: lost R1 (0) + won R2 (1) = 1
    // P3 SSF score: drew R1 (0.5) + lost R2 (0) = 0.5
    // Opponent scores: [1, 0.5], remove min (0.5): 1
    expect(tiebreakSSFBuchholz(games, 2, ctx)).toBe(1)
  })

  it('does not remove min when only 1 round', () => {
    const games: TiebreakGameInfo[] = [
      {
        roundNr: 1,
        side: 'white',
        resultType: 'WHITE_WIN',
        whiteScore: 1,
        blackScore: 0,
        opponentId: 2,
        opponentRating: 1500,
        isBye: false,
      },
    ]

    const p2Games: TiebreakGameInfo[] = [
      {
        roundNr: 1,
        side: 'black',
        resultType: 'WHITE_WIN',
        whiteScore: 1,
        blackScore: 0,
        opponentId: 1,
        opponentRating: 1500,
        isBye: false,
      },
    ]

    const ctx: TiebreakContext = {
      pointsPerGame: 2,
      chess4: false,
      compensateWeakPlayerPP: false,
      getPlayerGames: (id: number) => {
        if (id === 2) return p2Games
        return []
      },
    }

    // 1 round: no removal
    expect(tiebreakSSFBuchholz(games, 1, ctx)).toBe(0)
  })
})

describe('tiebreakBerger', () => {
  it('sums opponent_score * game_result for played games', () => {
    // Player beats P2 (score 1), draws P3 (score 2), loses to P4 (score 3)
    const p1Games: TiebreakGameInfo[] = [
      {
        roundNr: 1,
        side: 'white',
        resultType: 'WHITE_WIN',
        whiteScore: 1,
        blackScore: 0,
        opponentId: 2,
        opponentRating: 1500,
        isBye: false,
      },
      {
        roundNr: 2,
        side: 'white',
        resultType: 'DRAW',
        whiteScore: 0.5,
        blackScore: 0.5,
        opponentId: 3,
        opponentRating: 1400,
        isBye: false,
      },
      {
        roundNr: 3,
        side: 'black',
        resultType: 'WHITE_WIN',
        whiteScore: 1,
        blackScore: 0,
        opponentId: 4,
        opponentRating: 1600,
        isBye: false,
      },
    ]

    const p2Games: TiebreakGameInfo[] = [
      {
        roundNr: 1,
        side: 'black',
        resultType: 'WHITE_WIN',
        whiteScore: 1,
        blackScore: 0,
        opponentId: 1,
        opponentRating: 1500,
        isBye: false,
      },
      {
        roundNr: 2,
        side: 'white',
        resultType: 'DRAW',
        whiteScore: 0.5,
        blackScore: 0.5,
        opponentId: 4,
        opponentRating: 1600,
        isBye: false,
      },
      {
        roundNr: 3,
        side: 'white',
        resultType: 'WHITE_WIN',
        whiteScore: 1,
        blackScore: 0,
        opponentId: 3,
        opponentRating: 1400,
        isBye: false,
      },
    ]

    const p3Games: TiebreakGameInfo[] = [
      {
        roundNr: 1,
        side: 'white',
        resultType: 'WHITE_WIN',
        whiteScore: 1,
        blackScore: 0,
        opponentId: 4,
        opponentRating: 1600,
        isBye: false,
      },
      {
        roundNr: 2,
        side: 'black',
        resultType: 'DRAW',
        whiteScore: 0.5,
        blackScore: 0.5,
        opponentId: 1,
        opponentRating: 1500,
        isBye: false,
      },
      {
        roundNr: 3,
        side: 'black',
        resultType: 'WHITE_WIN',
        whiteScore: 1,
        blackScore: 0,
        opponentId: 2,
        opponentRating: 1500,
        isBye: false,
      },
    ]

    const p4Games: TiebreakGameInfo[] = [
      {
        roundNr: 1,
        side: 'black',
        resultType: 'WHITE_WIN',
        whiteScore: 1,
        blackScore: 0,
        opponentId: 3,
        opponentRating: 1400,
        isBye: false,
      },
      {
        roundNr: 2,
        side: 'black',
        resultType: 'DRAW',
        whiteScore: 0.5,
        blackScore: 0.5,
        opponentId: 2,
        opponentRating: 1500,
        isBye: false,
      },
      {
        roundNr: 3,
        side: 'white',
        resultType: 'WHITE_WIN',
        whiteScore: 1,
        blackScore: 0,
        opponentId: 1,
        opponentRating: 1500,
        isBye: false,
      },
    ]

    const ctx: TiebreakContext = {
      pointsPerGame: 2,
      chess4: false,
      compensateWeakPlayerPP: false,
      getPlayerGames: (id: number) => {
        if (id === 1) return p1Games
        if (id === 2) return p2Games
        if (id === 3) return p3Games
        if (id === 4) return p4Games
        return []
      },
    }

    // P2 pairing score: 0 + 0.5 + 1 = 1.5
    // P3 pairing score: 1 + 0.5 + 0 = 1.5
    // P4 pairing score: 0 + 0.5 + 1 = 1.5
    // P1 beat P2: P2_score(1.5) * P1_game_score(1) = 1.5
    // P1 drew P3: P3_score(1.5) * P1_game_score(0.5) = 0.75
    // P1 lost P4: not played result (isPlayed = false for WHITE_WIN where P1 is black, wait...)
    // Actually P1 lost R3: resultType is WHITE_WIN, P1 is black, so P1 got 0 for that game
    // Berger only counts isPlayed (WHITE_WIN, BLACK_WIN, DRAW), so all 3 count
    // R1: P2_pairing_score(1.5) * P1_result(1) = 1.5
    // R2: P3_pairing_score(1.5) * P1_result(0.5) = 0.75
    // R3: P4_pairing_score(1.5) * P1_result(0) = 0
    // Total: 1.5 + 0.75 + 0 = 2.25
    expect(tiebreakBerger(p1Games, 3, ctx)).toBe(2.25)
  })
})

describe('tiebreakRatingPerformance', () => {
  it('calculates LASK performance rating', () => {
    // Player with score 2/3, opponents rated 1500, 1400, 1600
    // Average opponent rating: (1500+1400+1600)/3 = 1500
    // Score fraction: 2/3 = 0.667
    // Since 0.667 > 0.66, addon = 125 (from lookup table)
    // Performance = 1500 + 125 = 1625
    const games: TiebreakGameInfo[] = [
      {
        roundNr: 1,
        side: 'white',
        resultType: 'WHITE_WIN',
        whiteScore: 1,
        blackScore: 0,
        opponentId: 2,
        opponentRating: 1500,
        isBye: false,
      },
      {
        roundNr: 2,
        side: 'white',
        resultType: 'DRAW',
        whiteScore: 0.5,
        blackScore: 0.5,
        opponentId: 3,
        opponentRating: 1400,
        isBye: false,
      },
      {
        roundNr: 3,
        side: 'black',
        resultType: 'BLACK_WIN',
        whiteScore: 0,
        blackScore: 1,
        opponentId: 4,
        opponentRating: 1600,
        isBye: false,
      },
    ]

    // Score: 1 + 0.5 + 1 = 2.5 (pairing score identical for these results)
    // fracScore = 2.5/3 = 0.833...
    // 0.833 > 0.83, addon = 284
    // Performance = 1500 + 284 = 1784
    expect(tiebreakRatingPerformance(games, 3, 2.5)).toBe(1784)
  })

  it('handles score below 50% (subtracts addon)', () => {
    // Player with score 0.5/3
    // Average opponent: (1500+1400+1600)/3 = 1500
    // fracScore = 0.5/3 = 0.167
    // minusFrac = true, fracScore becomes 1-0.167 = 0.833
    // 0.833 > 0.83, addon = 284
    // Performance = 1500 - 284 = 1216
    const games: TiebreakGameInfo[] = [
      {
        roundNr: 1,
        side: 'white',
        resultType: 'DRAW',
        whiteScore: 0.5,
        blackScore: 0.5,
        opponentId: 2,
        opponentRating: 1500,
        isBye: false,
      },
      {
        roundNr: 2,
        side: 'black',
        resultType: 'WHITE_WIN',
        whiteScore: 1,
        blackScore: 0,
        opponentId: 3,
        opponentRating: 1400,
        isBye: false,
      },
      {
        roundNr: 3,
        side: 'white',
        resultType: 'BLACK_WIN',
        whiteScore: 0,
        blackScore: 1,
        opponentId: 4,
        opponentRating: 1600,
        isBye: false,
      },
    ]
    expect(tiebreakRatingPerformance(games, 3, 0.5)).toBe(1216)
  })
})

describe('tiebreakInternalMeeting', () => {
  it('sums scores against players with same score and previous tiebreaks', () => {
    // P1 and P2 both have score 2.0 and same Buchholz
    // P1 beat P2 in round 1: P1 gets 1 point from internal meeting
    const p1Games: TiebreakGameInfo[] = [
      {
        roundNr: 1,
        side: 'white',
        resultType: 'WHITE_WIN',
        whiteScore: 1,
        blackScore: 0,
        opponentId: 2,
        opponentRating: 1500,
        isBye: false,
      },
      {
        roundNr: 2,
        side: 'white',
        resultType: 'WHITE_WIN',
        whiteScore: 1,
        blackScore: 0,
        opponentId: 3,
        opponentRating: 1400,
        isBye: false,
      },
    ]

    // P2 has score 2.0 too (beat different opponents)
    // P3 has score 0.0

    const playerScores: Record<number, number> = { 1: 2, 2: 2, 3: 0 }
    const previousTiebreaks: Record<number, number[]> = { 1: [3], 2: [3], 3: [0] }

    expect(tiebreakInternalMeeting(1, p1Games, 2, playerScores, previousTiebreaks)).toBe(1)
  })

  it('returns 0 when opponents with same score were not played', () => {
    const p1Games: TiebreakGameInfo[] = [
      {
        roundNr: 1,
        side: 'white',
        resultType: 'WHITE_WIN',
        whiteScore: 1,
        blackScore: 0,
        opponentId: 3,
        opponentRating: 1400,
        isBye: false,
      },
    ]

    const playerScores: Record<number, number> = { 1: 1, 2: 1, 3: 0 }
    const previousTiebreaks: Record<number, number[]> = { 1: [1], 2: [1], 3: [0] }

    expect(tiebreakInternalMeeting(1, p1Games, 1, playerScores, previousTiebreaks)).toBe(0)
  })
})
