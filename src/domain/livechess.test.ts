import { describe, expect, it } from 'vitest'
import type { LiveChessInput } from './livechess.ts'
import { generateLiveChessPgn } from './livechess.ts'

describe('generateLiveChessPgn', () => {
  it('generates PGN for games with no result', () => {
    const input: LiveChessInput = {
      tournamentName: 'Höstturneringen',
      roundNr: 1,
      games: [
        {
          boardNr: 1,
          whiteLastName: 'Andersson',
          whiteFirstName: 'Anna',
          blackLastName: 'Björk',
          blackFirstName: 'Bo',
          whiteRating: 1800,
          blackRating: 1700,
          resultType: 'NO_RESULT',
        },
        {
          boardNr: 2,
          whiteLastName: 'Carlsson',
          whiteFirstName: 'Cilla',
          blackLastName: 'Dahl',
          blackFirstName: 'Dan',
          whiteRating: 1600,
          blackRating: 1500,
          resultType: 'NO_RESULT',
        },
      ],
    }

    const pgn = generateLiveChessPgn(input)
    expect(pgn).toContain('[Event "Höstturneringen"]')
    expect(pgn).toContain('[Round "1"]')
    expect(pgn).toContain('[White "Andersson, Anna"]')
    expect(pgn).toContain('[Black "Björk, Bo"]')
    expect(pgn).toContain('[Board "1"]')
    expect(pgn).toContain('[WhiteElo "1800"]')
    expect(pgn).toContain('[BlackElo "1700"]')
    expect(pgn).toContain('*')
    // Should contain 2 entries
    const entries = pgn.split('*').filter((s) => s.trim() !== '')
    expect(entries).toHaveLength(2)
  })

  it('skips games with results already entered', () => {
    const input: LiveChessInput = {
      tournamentName: 'Test',
      roundNr: 1,
      games: [
        {
          boardNr: 1,
          whiteLastName: 'A',
          whiteFirstName: 'A',
          blackLastName: 'B',
          blackFirstName: 'B',
          whiteRating: 1500,
          blackRating: 1400,
          resultType: 'WHITE_WIN',
        },
        {
          boardNr: 2,
          whiteLastName: 'C',
          whiteFirstName: 'C',
          blackLastName: 'D',
          blackFirstName: 'D',
          whiteRating: 1300,
          blackRating: 1200,
          resultType: 'NO_RESULT',
        },
      ],
    }

    const pgn = generateLiveChessPgn(input)
    expect(pgn).not.toContain('[Board "1"]')
    expect(pgn).toContain('[Board "2"]')
  })

  it('skips bye games (null players)', () => {
    const input: LiveChessInput = {
      tournamentName: 'Test',
      roundNr: 1,
      games: [
        {
          boardNr: 1,
          whiteLastName: 'A',
          whiteFirstName: 'A',
          blackLastName: null,
          blackFirstName: null,
          whiteRating: 1500,
          blackRating: 0,
          resultType: 'NO_RESULT',
        },
      ],
    }

    const pgn = generateLiveChessPgn(input)
    expect(pgn).toBe('')
  })

  it('returns empty string when all games have results', () => {
    const input: LiveChessInput = {
      tournamentName: 'Test',
      roundNr: 1,
      games: [
        {
          boardNr: 1,
          whiteLastName: 'A',
          whiteFirstName: 'A',
          blackLastName: 'B',
          blackFirstName: 'B',
          whiteRating: 1500,
          blackRating: 1400,
          resultType: 'DRAW',
        },
      ],
    }

    const pgn = generateLiveChessPgn(input)
    expect(pgn).toBe('')
  })
})
