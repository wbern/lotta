import {
  type ApiClient,
  apiClient,
  createTournament,
  ensureClubs,
  fetchClubStandings,
  HIGHER_RATED_WINS,
  type PlayerInput,
  pairRound,
  setResults,
  setResultsFromScript,
  waitForApi,
} from './api-helpers'
import { CLUB_STANDINGS_ALL_DRAWS, CLUB_STANDINGS_BY_ROUND } from './club-standings-snapshots'
import { expect, test } from './fixtures'

const CLUBS = [{ name: 'SK Vit' }, { name: 'SK Svart' }, { name: 'SK Grön' }]

// 6 players, 2 per club
const PLAYERS_6: PlayerInput[] = [
  { lastName: 'Ödinson', firstName: 'Thor', ratingI: 2100, clubIndex: -1 }, // SK Vit
  { lastName: 'Läufeyson', firstName: 'Loki', ratingI: 1950, clubIndex: -1 }, // SK Vit
  { lastName: 'Järnsida', firstName: 'Björn', ratingI: 1800, clubIndex: -1 }, // SK Svart
  { lastName: 'Åskväder', firstName: 'Odin', ratingI: 1750, clubIndex: -1 }, // SK Svart
  { lastName: 'Stormöga', firstName: 'Frej', ratingI: 1600, clubIndex: -1 }, // SK Grön
  { lastName: 'Svärdhand', firstName: 'Tyr', ratingI: 1500, clubIndex: -1 }, // SK Grön
]

async function setupClubTournament($: ApiClient) {
  const clubIds = await ensureClubs($, CLUBS)

  // Assign club indices: 2 players per club
  const players = PLAYERS_6.map((p, i) => ({
    ...p,
    clubIndex: clubIds[Math.floor(i / 2)],
  }))

  return { clubIds, players }
}

test.describe('Club standings', () => {
  test('Club standings round-by-round', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const { players } = await setupClubTournament($)

    const { tid } = await createTournament(
      $,
      {
        name: 'ClubStandings-base',
        pairingSystem: 'Monrad',
        nrOfRounds: 4,
      },
      players,
    )

    const script: Record<number, Record<number, string>> = {
      1: { 1: 'WHITE_WIN', 2: 'BLACK_WIN', 3: 'WHITE_WIN' },
      2: { 1: 'BLACK_WIN', 2: 'WHITE_WIN', 3: 'DRAW' },
      3: { 1: 'WHITE_WIN', 2: 'DRAW', 3: 'BLACK_WIN' },
      4: { 1: 'DRAW', 2: 'WHITE_WIN', 3: 'BLACK_WIN' },
    }

    const allStandings: any[][] = []
    for (let r = 1; r <= 4; r++) {
      const round = await pairRound($, tid)
      expect(round.roundNr).toBe(r)
      await setResultsFromScript($, tid, r, round.games, script[r])
      const cs = await fetchClubStandings($, tid, r)
      allStandings.push(cs.map((s: any) => ({ place: s.place, club: s.club, score: s.score })))
    }

    expect(allStandings).toEqual(CLUB_STANDINGS_BY_ROUND)
  })

  test('Club standings with all draws', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const { players } = await setupClubTournament($)

    const { tid } = await createTournament(
      $,
      {
        name: 'ClubStandings-draws',
        pairingSystem: 'Monrad',
        nrOfRounds: 4,
      },
      players,
    )

    for (let r = 1; r <= 4; r++) {
      const round = await pairRound($, tid)
      expect(round.roundNr).toBe(r)
      await setResults($, tid, r, round.games, () => 'DRAW')
    }

    const cs = await fetchClubStandings($, tid, 4)
    const snapshot = cs.map((s: any) => ({ place: s.place, club: s.club, score: s.score }))
    expect(snapshot).toEqual(CLUB_STANDINGS_ALL_DRAWS)
  })
})
