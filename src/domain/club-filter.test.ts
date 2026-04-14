import { describe, expect, it } from 'vitest'
import type { GameDto } from '../types/api'
import { filterGamesByClubs, redactPlayerName } from './club-filter'

function makeGame(
  boardNr: number,
  white: { name: string; club: string | null },
  black: { name: string; club: string | null },
): GameDto {
  return {
    boardNr,
    whitePlayer: {
      id: boardNr * 10,
      name: white.name,
      club: white.club,
      rating: 1500,
      lotNr: boardNr * 10,
    },
    blackPlayer: {
      id: boardNr * 10 + 1,
      name: black.name,
      club: black.club,
      rating: 1400,
      lotNr: boardNr * 10 + 1,
    },
    resultType: 'NO_RESULT',
    roundNr: 1,
    whiteScore: 0,
    blackScore: 0,
    resultDisplay: '',
  }
}

describe('club filter', () => {
  const games: GameDto[] = [
    makeGame(
      1,
      { name: 'Svensson Anna', club: 'SK Lansen' },
      { name: 'Johansson Erik', club: 'Kungsbacka SS' },
    ),
    makeGame(
      2,
      { name: 'Nilsson Karl', club: 'Kungsbacka SS' },
      { name: 'Lindberg Maria', club: 'SK Lansen' },
    ),
    makeGame(
      3,
      { name: 'Olsson Per', club: 'Gothenborg SK' },
      { name: 'Berg Sara', club: 'Gothenborg SK' },
    ),
  ]

  it('returns only games where at least one player belongs to an authorized club', () => {
    const filtered = filterGamesByClubs(games, ['SK Lansen'])

    expect(filtered).toHaveLength(2)
    expect(filtered.map((g) => g.boardNr)).toEqual([1, 2])
  })

  it('returns games for multiple authorized clubs', () => {
    const filtered = filterGamesByClubs(games, ['SK Lansen', 'Gothenborg SK'])

    expect(filtered).toHaveLength(3)
    expect(filtered.map((g) => g.boardNr)).toEqual([1, 2, 3])
  })

  it('shows full name for authorized club players, first name only for others', () => {
    const authorizedClubs = ['SK Lansen']
    const firstNames = new Map([
      [1, 'Anna'],
      [2, 'Erik'],
    ])

    // Player from authorized club — full name
    const authorized = redactPlayerName(
      { id: 1, name: 'Svensson Anna', club: 'SK Lansen', rating: 1500, lotNr: 1 },
      authorizedClubs,
      firstNames,
    )
    expect(authorized).toBe('Svensson Anna')

    // Player from non-authorized club — first name only
    const redacted = redactPlayerName(
      { id: 2, name: 'Johansson Erik', club: 'Kungsbacka SS', rating: 1400, lotNr: 2 },
      authorizedClubs,
      firstNames,
    )
    expect(redacted).toBe('Erik')
  })

  it('includes games with clubless players when __CLUBLESS__ is authorized', () => {
    const gamesWithClubless: GameDto[] = [
      ...games,
      makeGame(
        4,
        { name: 'Persson Nils', club: null },
        { name: 'Svensson Anna', club: 'SK Lansen' },
      ),
    ]
    const filtered = filterGamesByClubs(gamesWithClubless, ['__CLUBLESS__'])

    expect(filtered).toHaveLength(1)
    expect(filtered[0].boardNr).toBe(4)
  })

  it('shows full name for clubless players when __CLUBLESS__ is authorized', () => {
    const result = redactPlayerName(
      { id: 5, name: 'Persson Nils', club: null, rating: 1300, lotNr: 5 },
      ['__CLUBLESS__'],
      new Map([[5, 'Nils']]),
    )

    expect(result).toBe('Persson Nils')
  })

  it('returns BYE for null players', () => {
    const result = redactPlayerName(null, ['SK Lansen'], new Map())

    expect(result).toBe('BYE')
  })
})
