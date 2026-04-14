import {
  type ApiClient,
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
import {
  SETTINGS_FIRST_LAST_STANDINGS,
  SETTINGS_LAST_FIRST_STANDINGS,
  SETTINGS_POINTS_PER_GAME_2,
  SETTINGS_QUICK_RATING,
  SETTINGS_QUICK_THEN_ELO_FALLBACK,
} from './settings-snapshots'

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
  test('playerPresentation LAST_FIRST vs FIRST_LAST', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const { tid } = await createTournament(
      $,
      {
        name: 'Settings-presentation',
        pairingSystem: 'Monrad',
        nrOfRounds: 2,
      },
      PLAYERS_4,
    )

    const r1 = await pairRound($, tid)
    await setResults($, tid, 1, r1.games, HIGHER_RATED_WINS)

    // Default is FIRST_LAST
    const standingsFL = await fetchStandings($, tid, 1)
    const snapshotFL = standingsFL.map(snapshotStanding)
    expect(snapshotFL).toEqual(SETTINGS_FIRST_LAST_STANDINGS)

    // Change to LAST_FIRST
    await $.put('/api/settings', { playerPresentation: 'LAST_FIRST' })
    const standingsLF = await fetchStandings($, tid, 1)
    const snapshotLF = standingsLF.map(snapshotStanding)
    expect(snapshotLF).toEqual(SETTINGS_LAST_FIRST_STANDINGS)

    // Reset back to FIRST_LAST for other tests
    await $.put('/api/settings', { playerPresentation: 'FIRST_LAST' })
  })

  test('ratingChoice QUICK', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const players: PlayerInput[] = PLAYERS_4.map((p) => ({
      ...p,
      ratingQ: 1500,
    }))

    const { tid } = await createTournament(
      $,
      {
        name: 'Settings-quick-rating',
        pairingSystem: 'Monrad',
        nrOfRounds: 2,
        ratingChoice: 'QUICK',
      },
      players,
    )

    const r1 = await pairRound($, tid)
    await setResults($, tid, 1, r1.games, HIGHER_RATED_WINS)

    const standings = await fetchStandings($, tid, 1)
    const snapshot = standings.map(snapshotStanding)
    expect(snapshot).toEqual(SETTINGS_QUICK_RATING)
  })

  test('ratingChoice QUICK_THEN_ELO fallback', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    // Some players have ratingQ=0, should fall back to ratingI
    const players: PlayerInput[] = [
      { lastName: 'Ödinson', firstName: 'Thor', ratingI: 2100, ratingQ: 1800 },
      { lastName: 'Läufeyson', firstName: 'Loki', ratingI: 1950, ratingQ: 0 },
      { lastName: 'Järnsida', firstName: 'Björn', ratingI: 1800, ratingQ: 1600 },
      { lastName: 'Åskväder', firstName: 'Odin', ratingI: 1750, ratingQ: 0 },
    ]

    const { tid } = await createTournament(
      $,
      {
        name: 'Settings-quick-fallback',
        pairingSystem: 'Monrad',
        nrOfRounds: 2,
        ratingChoice: 'QUICK_THEN_ELO',
      },
      players,
    )

    const r1 = await pairRound($, tid)
    await setResults($, tid, 1, r1.games, HIGHER_RATED_WINS)

    const standings = await fetchStandings($, tid, 1)
    const snapshot = standings.map(snapshotStanding)
    expect(snapshot).toEqual(SETTINGS_QUICK_THEN_ELO_FALLBACK)
  })

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
