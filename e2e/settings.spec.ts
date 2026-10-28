import {
  apiClient,
  createTournament,
  fetchStandings,
  HIGHER_RATED_WINS,
  type PlayerInput,
  pairRound,
  setResults,
  waitForApi,
} from './api-helpers'
import { expect, test } from './fixtures'
import { SETTINGS_POINTS_PER_GAME_2 } from './settings-snapshots'

const PLAYERS_4: PlayerInput[] = [
  { lastName: 'Ödinson', firstName: 'Thor', ratingI: 2100 },
  { lastName: 'Läufeyson', firstName: 'Loki', ratingI: 1950 },
  { lastName: 'Järnsida', firstName: 'Björn', ratingI: 1800 },
  { lastName: 'Åskväder', firstName: 'Odin', ratingI: 1750 },
]

function snapshotStanding(s: any) {
  return { place: s.place, name: s.name, rating: s.rating, score: s.score }
}

test.describe('Settings that change API output', () => {
  test('pointsPerGame=2', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const { tid } = await createTournament(
      $,
      {
        name: 'Settings-ppg2',
        pairingSystem: 'Monrad',
        nrOfRounds: 3,
        pointsPerGame: 2,
      },
      PLAYERS_4,
    )

    for (let r = 1; r <= 3; r++) {
      const round = await pairRound($, tid)
      expect(round.roundNr).toBe(r)
      await setResults($, tid, r, round.games, HIGHER_RATED_WINS)
    }

    const standings = await fetchStandings($, tid, 3)
    const snapshot = standings.map(snapshotStanding)
    expect(snapshot).toEqual(SETTINGS_POINTS_PER_GAME_2)
  })
})
