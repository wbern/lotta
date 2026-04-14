import {
  type ApiClient,
  apiClient,
  createTournament,
  fetchStandings,
  type PlayerInput,
  pairRound,
  setResultsFromScript,
  waitForApi,
} from './api-helpers'
import { expect, test } from './fixtures'
import {
  STANDINGS_8TB_BY_ROUND,
  STANDINGS_INBORDES,
  STANDINGS_MANUELL,
} from './standings-snapshots'

// ── 8-tiebreaker test setup ──────────────────────────────────────────────

const PLAYERS_8: PlayerInput[] = [
  { lastName: 'Ödinson', firstName: 'Thor', ratingI: 2100 },
  { lastName: 'Läufeyson', firstName: 'Loki', ratingI: 1950 },
  { lastName: 'Järnsida', firstName: 'Björn', ratingI: 1800 },
  { lastName: 'Åskväder', firstName: 'Odin', ratingI: 1750 },
  { lastName: 'Stormöga', firstName: 'Frej', ratingI: 1600 },
  { lastName: 'Svärdhand', firstName: 'Tyr', ratingI: 1500 },
  { lastName: 'Stjärnljus', firstName: 'Freja', ratingI: 1400 },
  { lastName: 'Nattskärm', firstName: 'Sigrid', ratingI: 1300 },
]

const ALL_TIEBREAKS = [
  'Buchholz',
  'Berger',
  'Median Buchholz',
  'SSF Buchholz',
  'Progressiv',
  'Vinster',
  'Svarta partier',
  'Prestationsrating LASK',
]

const SCRIPTED_5R: Record<number, Record<number, string>> = {
  1: { 1: 'WHITE_WIN', 2: 'BLACK_WIN', 3: 'WHITE_WIN', 4: 'DRAW' },
  2: { 1: 'BLACK_WIN', 2: 'WHITE_WIN', 3: 'DRAW', 4: 'WHITE_WIN' },
  3: { 1: 'WHITE_WIN', 2: 'DRAW', 3: 'BLACK_WIN', 4: 'WHITE_WIN' },
  4: { 1: 'DRAW', 2: 'WHITE_WIN', 3: 'WHITE_WIN', 4: 'BLACK_WIN' },
  5: { 1: 'WHITE_WIN', 2: 'BLACK_WIN', 3: 'DRAW', 4: 'WHITE_WIN' },
}

function snapshotStanding(s: any) {
  return { place: s.place, name: s.name, score: s.score, tiebreaks: s.tiebreaks }
}

test.describe('Standings with tiebreakers', () => {
  test('All 8 tiebreakers, round-by-round', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const { tid } = await createTournament(
      $,
      {
        name: 'Standings-8TB',
        pairingSystem: 'Monrad',
        nrOfRounds: 5,
        selectedTiebreaks: ALL_TIEBREAKS,
      },
      PLAYERS_8,
    )

    const allStandings: any[][] = []
    for (let r = 1; r <= 5; r++) {
      const round = await pairRound($, tid)
      expect(round.roundNr).toBe(r)
      await setResultsFromScript($, tid, r, round.games, SCRIPTED_5R[r])
      const standings = await fetchStandings($, tid, r)
      allStandings.push(standings.map(snapshotStanding))
    }

    expect(allStandings).toEqual(STANDINGS_8TB_BY_ROUND)
  })

  test('Inbördes möte (Internal Meeting)', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const players: PlayerInput[] = [
      { lastName: 'Alfa', firstName: 'A', ratingI: 2000 },
      { lastName: 'Beta', firstName: 'B', ratingI: 1900 },
      { lastName: 'Gamma', firstName: 'C', ratingI: 1800 },
      { lastName: 'Delta', firstName: 'D', ratingI: 1700 },
      { lastName: 'Epsilon', firstName: 'E', ratingI: 1600 },
      { lastName: 'Zeta', firstName: 'F', ratingI: 1500 },
    ]

    const { tid } = await createTournament(
      $,
      {
        name: 'Standings-Inbordes',
        pairingSystem: 'Monrad',
        nrOfRounds: 4,
        selectedTiebreaks: ['Buchholz', 'Inbördes möte'],
      },
      players,
    )

    // Scripted: craft results so 2 players tie on score AND Buchholz but have met each other
    const script: Record<number, Record<number, string>> = {
      1: { 1: 'WHITE_WIN', 2: 'BLACK_WIN', 3: 'WHITE_WIN' },
      2: { 1: 'BLACK_WIN', 2: 'WHITE_WIN', 3: 'DRAW' },
      3: { 1: 'WHITE_WIN', 2: 'DRAW', 3: 'BLACK_WIN' },
      4: { 1: 'DRAW', 2: 'WHITE_WIN', 3: 'BLACK_WIN' },
    }

    for (let r = 1; r <= 4; r++) {
      const round = await pairRound($, tid)
      expect(round.roundNr).toBe(r)
      await setResultsFromScript($, tid, r, round.games, script[r])
    }

    const standings = await fetchStandings($, tid, 4)
    const snapshot = standings.map(snapshotStanding)
    expect(snapshot).toEqual(STANDINGS_INBORDES)
  })

  test('Manuell tiebreak', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const { tid, addedPlayers } = await createTournament(
      $,
      {
        name: 'Standings-Manuell',
        pairingSystem: 'Monrad',
        nrOfRounds: 3,
        selectedTiebreaks: ['Buchholz', 'Manuell'],
      },
      PLAYERS_8,
    )

    const script: Record<number, Record<number, string>> = {
      1: { 1: 'WHITE_WIN', 2: 'BLACK_WIN', 3: 'DRAW', 4: 'DRAW' },
      2: { 1: 'WHITE_WIN', 2: 'DRAW', 3: 'WHITE_WIN', 4: 'BLACK_WIN' },
      3: { 1: 'DRAW', 2: 'WHITE_WIN', 3: 'BLACK_WIN', 4: 'WHITE_WIN' },
    }

    for (let r = 1; r <= 3; r++) {
      const round = await pairRound($, tid)
      expect(round.roundNr).toBe(r)
      await setResultsFromScript($, tid, r, round.games, script[r])
    }

    // Set manualTiebreak on one player to differentiate ties
    const player = addedPlayers[2] // Björn Järnsida
    await $.put(`/api/tournaments/${tid}/players/${player.id}`, {
      ...player,
      manualTiebreak: 10,
    })

    const standings = await fetchStandings($, tid, 3)
    const snapshot = standings.map(snapshotStanding)
    expect(snapshot).toEqual(STANDINGS_MANUELL)
  })
})
