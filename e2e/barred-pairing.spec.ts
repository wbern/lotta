import {
  type ApiClient,
  apiClient,
  createTournament,
  ensureClubs,
  HIGHER_RATED_WINS,
  type PlayerInput,
  pairRound,
  setResults,
  waitForApi,
} from './api-helpers'
import {
  BARRED_MAJORITY_ERROR,
  BARRED_MONRAD_PAIRINGS,
  BARRED_NS_PAIRINGS,
} from './barred-pairing-snapshots'
import { expect, test } from './fixtures'

const CLUBS = [{ name: 'SK Alfa' }, { name: 'SK Beta' }, { name: 'SK Gamma' }, { name: 'SK Delta' }]

// 8 players, 2 per club
const PLAYERS_8: PlayerInput[] = [
  { lastName: 'Ödinson', firstName: 'Thor', ratingI: 2100, clubIndex: -1 },
  { lastName: 'Läufeyson', firstName: 'Loki', ratingI: 1950, clubIndex: -1 },
  { lastName: 'Järnsida', firstName: 'Björn', ratingI: 1800, clubIndex: -1 },
  { lastName: 'Åskväder', firstName: 'Odin', ratingI: 1750, clubIndex: -1 },
  { lastName: 'Stormöga', firstName: 'Frej', ratingI: 1600, clubIndex: -1 },
  { lastName: 'Svärdhand', firstName: 'Tyr', ratingI: 1500, clubIndex: -1 },
  { lastName: 'Stjärnljus', firstName: 'Freja', ratingI: 1400, clubIndex: -1 },
  { lastName: 'Nattskärm', firstName: 'Sigrid', ratingI: 1300, clubIndex: -1 },
]

async function setupBarredPlayers($: ApiClient) {
  const clubIds = await ensureClubs($, CLUBS)
  return PLAYERS_8.map((p, i) => ({
    ...p,
    clubIndex: clubIds[Math.floor(i / 2)],
  }))
}

function extractClubPairings(round: any) {
  return round.games
    .filter((g: any) => g.whitePlayer && g.blackPlayer)
    .map((g: any) => ({
      boardNr: g.boardNr,
      white: g.whitePlayer.name,
      black: g.blackPlayer.name,
      whiteClub: g.whitePlayer.club,
      blackClub: g.blackPlayer.club,
    }))
}

test.describe('Barred pairing', () => {
  test('Monrad — no same-club matches', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const players = await setupBarredPlayers($)

    const { tid } = await createTournament(
      $,
      {
        name: 'Barred-Monrad',
        pairingSystem: 'Monrad',
        nrOfRounds: 4,
        barredPairing: true,
      },
      players,
    )

    const allRoundPairings: any[][] = []

    for (let r = 1; r <= 4; r++) {
      const round = await pairRound($, tid)
      expect(round.roundNr).toBe(r)
      const pairings = extractClubPairings(round)
      allRoundPairings.push(pairings)
      for (const p of pairings) {
        expect(p.whiteClub).not.toBe(p.blackClub)
      }
      await setResults($, tid, r, round.games, HIGHER_RATED_WINS)
    }

    expect(allRoundPairings).toEqual(BARRED_MONRAD_PAIRINGS)
  })

  test('Nordisk Schweizer — no same-club matches', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const players = await setupBarredPlayers($)

    const { tid } = await createTournament(
      $,
      {
        name: 'Barred-NS',
        pairingSystem: 'Nordisk Schweizer',
        nrOfRounds: 3,
        barredPairing: true,
      },
      players,
    )

    const allRoundPairings: any[][] = []

    for (let r = 1; r <= 3; r++) {
      const round = await pairRound($, tid)
      expect(round.roundNr).toBe(r)
      const pairings = extractClubPairings(round)
      allRoundPairings.push(pairings)
      for (const p of pairings) {
        expect(p.whiteClub).not.toBe(p.blackClub)
      }
      await setResults($, tid, r, round.games, HIGHER_RATED_WINS)
    }

    expect(allRoundPairings).toEqual(BARRED_NS_PAIRINGS)
  })

  test('Majority club returns error', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const clubIds = await ensureClubs($, [{ name: 'SK Stor' }, { name: 'SK Liten' }])

    // 4 from club A, 2 from club B — majority club makes barred pairing impossible
    const players: PlayerInput[] = [
      { lastName: 'Alfa', firstName: 'A', ratingI: 2000, clubIndex: clubIds[0] },
      { lastName: 'Beta', firstName: 'B', ratingI: 1900, clubIndex: clubIds[0] },
      { lastName: 'Gamma', firstName: 'C', ratingI: 1800, clubIndex: clubIds[0] },
      { lastName: 'Delta', firstName: 'D', ratingI: 1700, clubIndex: clubIds[0] },
      { lastName: 'Epsilon', firstName: 'E', ratingI: 1600, clubIndex: clubIds[1] },
      { lastName: 'Zeta', firstName: 'F', ratingI: 1500, clubIndex: clubIds[1] },
    ]

    const { tid } = await createTournament(
      $,
      {
        name: 'Barred-Majority',
        pairingSystem: 'Monrad',
        nrOfRounds: 3,
        barredPairing: true,
      },
      players,
    )

    // Use page.evaluate with raw fetch to capture the error status and body
    const result = await page.evaluate(async (tournamentId: number) => {
      const res = await fetch(`/api/tournaments/${tournamentId}/pair?confirm=true`, {
        method: 'POST',
      })
      const body = await res.text()
      return { status: res.status, body }
    }, tid)

    expect(result).toEqual(BARRED_MAJORITY_ERROR)
  })
})
