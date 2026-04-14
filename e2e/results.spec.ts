import {
  type ApiClient,
  apiClient,
  createTournament,
  fetchStandings,
  HIGHER_RATED_WINS,
  type PlayerInput,
  pairRound,
  setResults,
  setResultsFromScript,
  waitForApi,
} from './api-helpers'
import { expect, test } from './fixtures'
import {
  RESULTS_ROUND2_GAMES,
  RESULTS_STANDINGS_AFTER_R2,
  RESULTS_STANDINGS_AFTER_R3,
} from './results-snapshots'

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

// Round 1: all higher-rated wins (baseline)
// Round 2: B1=WHITE_WIN_WO, B2=BLACK_WIN_WO, B3=DOUBLE_WO, B4=POSTPONED
// Round 3: B1=CANCELLED, B2=WHITE_WIN, B3=DRAW, B4=BLACK_WIN

const ROUND2_SCRIPT: Record<number, string> = {
  1: 'WHITE_WIN_WO',
  2: 'BLACK_WIN_WO',
  3: 'DOUBLE_WO',
  4: 'POSTPONED',
}

const ROUND3_SCRIPT: Record<number, string> = {
  1: 'CANCELLED',
  2: 'WHITE_WIN',
  3: 'DRAW',
  4: 'BLACK_WIN',
}

let resultsTournamentCounter = 0
async function setupResultsTournament($: ApiClient) {
  resultsTournamentCounter++
  const { tid } = await createTournament(
    $,
    {
      name: `Results-test-${resultsTournamentCounter}`,
      pairingSystem: 'Monrad',
      nrOfRounds: 3,
      selectedTiebreaks: ['Buchholz', 'Vinster'],
    },
    PLAYERS_8,
  )

  // Round 1: higher-rated wins
  const r1 = await pairRound($, tid)
  expect(r1.roundNr).toBe(1)
  await setResults($, tid, 1, r1.games, HIGHER_RATED_WINS)

  // Round 2: special results
  const r2 = await pairRound($, tid)
  expect(r2.roundNr).toBe(2)
  await setResultsFromScript($, tid, 2, r2.games, ROUND2_SCRIPT)

  // Round 3: mixed results
  const r3 = await pairRound($, tid)
  expect(r3.roundNr).toBe(3)
  await setResultsFromScript($, tid, 3, r3.games, ROUND3_SCRIPT)

  return tid
}

test.describe('Result types and scoring', () => {
  test('Game DTO after special results', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const tid = await setupResultsTournament($)

    const round2 = await $.get(`/api/tournaments/${tid}/rounds/2`)
    const gameSummaries = round2.games.map((g: any) => ({
      boardNr: g.boardNr,
      resultType: g.resultType,
      whiteScore: g.whiteScore,
      blackScore: g.blackScore,
      resultDisplay: g.resultDisplay,
    }))
    expect(gameSummaries).toEqual(RESULTS_ROUND2_GAMES)
  })

  test('Standings after round 2 (with special results)', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const tid = await setupResultsTournament($)

    const standings = await fetchStandings($, tid, 2)
    const snapshot = standings.map((s: any) => ({
      place: s.place,
      name: s.name,
      score: s.score,
      tiebreaks: s.tiebreaks,
    }))
    expect(snapshot).toEqual(RESULTS_STANDINGS_AFTER_R2)
  })

  test('Standings after round 3 (mixed results)', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const tid = await setupResultsTournament($)

    const standings = await fetchStandings($, tid, 3)
    const snapshot = standings.map((s: any) => ({
      place: s.place,
      name: s.name,
      score: s.score,
      tiebreaks: s.tiebreaks,
    }))
    expect(snapshot).toEqual(RESULTS_STANDINGS_AFTER_R3)
  })
})
