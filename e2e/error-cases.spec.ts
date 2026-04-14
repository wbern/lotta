import {
  apiClient,
  createTournament,
  HIGHER_RATED_WINS,
  type PlayerInput,
  pairRound,
  setResults,
  waitForApi,
} from './api-helpers'
import {
  FIDE_MISSING_FIELDS,
  INCOMPLETE_RESULTS,
  NO_ROUNDS_STANDINGS,
  SCORE_EXCEED_PPG,
} from './error-cases-snapshots'
import { expect, test } from './fixtures'

test.describe('Error cases', () => {
  test('FIDE export missing required fields', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const players: PlayerInput[] = [
      { lastName: 'Alfa', firstName: 'A', ratingI: 2000 },
      { lastName: 'Beta', firstName: 'B', ratingI: 1900 },
      { lastName: 'Gamma', firstName: 'C', ratingI: 1800 },
      { lastName: 'Delta', firstName: 'D', ratingI: 1700 },
    ]

    // Create tournament WITHOUT city, federation, chiefArbiter, timeControl
    const { tid } = await createTournament(
      $,
      {
        name: 'FIDE-missing-fields',
        pairingSystem: 'Monrad',
        nrOfRounds: 2,
      },
      players,
    )

    const r1 = await pairRound($, tid)
    await setResults($, tid, 1, r1.games, HIGHER_RATED_WINS)

    // Raw fetch inside page to capture error status and body
    const result = await page.evaluate(async (tournamentId: number) => {
      const res = await fetch(`/api/tournaments/${tournamentId}/export/fide`)
      const body = await res.json()
      return { status: res.status, error: body.error }
    }, tid)

    expect(result).toEqual(FIDE_MISSING_FIELDS)
  })

  test('Publish standings with no rounds', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const players: PlayerInput[] = [
      { lastName: 'Alfa', firstName: 'A', ratingI: 2000 },
      { lastName: 'Beta', firstName: 'B', ratingI: 1900 },
    ]

    const { tid } = await createTournament(
      $,
      {
        name: 'No-rounds',
        pairingSystem: 'Monrad',
        nrOfRounds: 3,
      },
      players,
    )

    // DON'T pair — try to publish standings
    const result = await page.evaluate(async (tournamentId: number) => {
      const res = await fetch(`/api/tournaments/${tournamentId}/publish/standings?round=1`)
      const body = await res.json()
      return { status: res.status, error: body.error }
    }, tid)

    expect(result).toEqual(NO_ROUNDS_STANDINGS)
  })

  test('Invalid explicit scores exceeding PPG', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const players: PlayerInput[] = [
      { lastName: 'Alfa', firstName: 'A', ratingI: 2000 },
      { lastName: 'Beta', firstName: 'B', ratingI: 1900 },
      { lastName: 'Gamma', firstName: 'C', ratingI: 1800 },
      { lastName: 'Delta', firstName: 'D', ratingI: 1700 },
    ]

    // PPG=1
    const { tid } = await createTournament(
      $,
      {
        name: 'Score-exceed-PPG',
        pairingSystem: 'Monrad',
        nrOfRounds: 2,
      },
      players,
    )

    await pairRound($, tid)

    // Try to set result with whiteScore + blackScore > PPG (1+1=2 > 1)
    const result = await page.evaluate(async (tournamentId: number) => {
      const res = await fetch(`/api/tournaments/${tournamentId}/rounds/1/games/1/result`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resultType: 'WHITE_WIN', whiteScore: 1, blackScore: 1 }),
      })
      const body = await res.json()
      return { status: res.status, error: body.error }
    }, tid)

    expect(result).toEqual(SCORE_EXCEED_PPG)
  })

  test('Pair with incomplete results', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const players: PlayerInput[] = [
      { lastName: 'Alfa', firstName: 'A', ratingI: 2200 },
      { lastName: 'Beta', firstName: 'B', ratingI: 2100 },
      { lastName: 'Gamma', firstName: 'C', ratingI: 2000 },
      { lastName: 'Delta', firstName: 'D', ratingI: 1900 },
      { lastName: 'Epsilon', firstName: 'E', ratingI: 1800 },
      { lastName: 'Zeta', firstName: 'F', ratingI: 1700 },
      { lastName: 'Eta', firstName: 'G', ratingI: 1600 },
      { lastName: 'Theta', firstName: 'H', ratingI: 1500 },
    ]

    const { tid } = await createTournament(
      $,
      {
        name: 'Incomplete-results',
        pairingSystem: 'Monrad',
        nrOfRounds: 3,
      },
      players,
    )

    const r1 = await pairRound($, tid)
    expect(r1.roundNr).toBe(1)

    // Set results for boards 1-3 only, leave board 4 as NO_RESULT
    await $.put(`/api/tournaments/${tid}/rounds/1/games/1/result`, { resultType: 'WHITE_WIN' })
    await $.put(`/api/tournaments/${tid}/rounds/1/games/2/result`, { resultType: 'BLACK_WIN' })
    await $.put(`/api/tournaments/${tid}/rounds/1/games/3/result`, { resultType: 'DRAW' })

    // Try to pair R2 — should fail with 409
    const result = await page.evaluate(async (tournamentId: number) => {
      const res = await fetch(`/api/tournaments/${tournamentId}/pair?confirm=true`, {
        method: 'POST',
      })
      const body = await res.json()
      return { status: res.status, error: body.error, message: body.message }
    }, tid)

    expect(result).toEqual(INCOMPLETE_RESULTS)
  })
})
