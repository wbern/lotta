import {
  apiClient,
  createTournament,
  HIGHER_RATED_WINS,
  type PlayerInput,
  pairRound,
  setResults,
  setResultsFromScript,
  waitForApi,
} from './api-helpers'
import { expect, test } from './fixtures'
import {
  BERGER_3P,
  BERGER_5P,
  BYE_ROTATION,
  IDENTICAL_RATINGS,
  MONRAD_COLOR,
  NS_COLOR,
} from './pairing-edge-cases-snapshots'

function snapshotPairings(round: any) {
  return round.games.map((g: any) => ({
    boardNr: g.boardNr,
    white: g.whitePlayer?.name ?? '(bye)',
    black: g.blackPlayer?.name ?? '(bye)',
  }))
}

function findByeRecipient(round: any): string | null {
  for (const g of round.games) {
    if (!g.whitePlayer) return g.blackPlayer?.name ?? null
    if (!g.blackPlayer) return g.whitePlayer?.name ?? null
  }
  return null
}

test.describe('Pairing edge cases', () => {
  test('5-player Monrad bye rotation', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const players: PlayerInput[] = [
      { lastName: 'Alfa', firstName: 'A', ratingI: 2000 },
      { lastName: 'Beta', firstName: 'B', ratingI: 1900 },
      { lastName: 'Gamma', firstName: 'C', ratingI: 1800 },
      { lastName: 'Delta', firstName: 'D', ratingI: 1700 },
      { lastName: 'Epsilon', firstName: 'E', ratingI: 1600 },
    ]

    const { tid } = await createTournament(
      $,
      {
        name: 'Monrad-5p-bye',
        pairingSystem: 'Monrad',
        nrOfRounds: 5,
      },
      players,
    )

    const rounds: any[] = []
    for (let r = 1; r <= 5; r++) {
      const round = await pairRound($, tid)
      expect(round.roundNr).toBe(r)
      const pairings = snapshotPairings(round)
      const byeRecipient = findByeRecipient(round)
      rounds.push({ roundNr: r, pairings, byeRecipient })
      await setResults($, tid, r, round.games, HIGHER_RATED_WINS)
    }

    // Structural assert: 5 unique bye recipients (everyone gets exactly 1 bye)
    const byeRecipients = rounds.map((r) => r.byeRecipient).filter(Boolean)
    const uniqueByes = new Set(byeRecipients)
    expect(byeRecipients.length).toBe(5)
    expect(uniqueByes.size).toBe(5)
    expect(rounds).toEqual(BYE_ROTATION)
  })

  test('Berger 3-player round-robin', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const players: PlayerInput[] = [
      { lastName: 'Alfa', firstName: 'A', ratingI: 2000 },
      { lastName: 'Beta', firstName: 'B', ratingI: 1900 },
      { lastName: 'Gamma', firstName: 'C', ratingI: 1800 },
    ]

    const { tid } = await createTournament(
      $,
      {
        name: 'Berger-3p',
        pairingSystem: 'Berger',
        nrOfRounds: 3,
      },
      players,
    )

    // Berger pairs all rounds at once
    await $.post(`/api/tournaments/${tid}/pair?confirm=true`)
    const allRounds = await $.get(`/api/tournaments/${tid}/rounds`)

    const snapshot = allRounds.map((r: any) => ({
      roundNr: r.roundNr,
      pairings: r.games.map((g: any) => ({
        boardNr: g.boardNr,
        white: g.whitePlayer?.name ?? '(bye)',
        black: g.blackPlayer?.name ?? '(bye)',
      })),
      byeRecipient: findByeRecipient(r),
    }))

    expect(snapshot).toEqual(BERGER_3P)
  })

  test('Berger 5-player round-robin', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const players: PlayerInput[] = [
      { lastName: 'Alfa', firstName: 'A', ratingI: 2200 },
      { lastName: 'Beta', firstName: 'B', ratingI: 2100 },
      { lastName: 'Gamma', firstName: 'C', ratingI: 2000 },
      { lastName: 'Delta', firstName: 'D', ratingI: 1900 },
      { lastName: 'Epsilon', firstName: 'E', ratingI: 1800 },
    ]

    const { tid } = await createTournament(
      $,
      {
        name: 'Berger-5p',
        pairingSystem: 'Berger',
        nrOfRounds: 5,
      },
      players,
    )

    await $.post(`/api/tournaments/${tid}/pair?confirm=true`)
    const allRounds = await $.get(`/api/tournaments/${tid}/rounds`)

    const snapshot = allRounds.map((r: any) => ({
      roundNr: r.roundNr,
      pairings: r.games.map((g: any) => ({
        boardNr: g.boardNr,
        white: g.whitePlayer?.name ?? '(bye)',
        black: g.blackPlayer?.name ?? '(bye)',
      })),
      byeRecipient: findByeRecipient(r),
    }))

    expect(snapshot).toEqual(BERGER_5P)
  })

  test('Monrad color balance', async ({ page }) => {
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
        name: 'Monrad-color-balance',
        pairingSystem: 'Monrad',
        nrOfRounds: 7,
      },
      players,
    )

    const script: Record<number, Record<number, string>> = {
      1: { 1: 'WHITE_WIN', 2: 'BLACK_WIN', 3: 'DRAW', 4: 'WHITE_WIN' },
      2: { 1: 'BLACK_WIN', 2: 'WHITE_WIN', 3: 'BLACK_WIN', 4: 'DRAW' },
      3: { 1: 'WHITE_WIN', 2: 'DRAW', 3: 'WHITE_WIN', 4: 'BLACK_WIN' },
      4: { 1: 'DRAW', 2: 'BLACK_WIN', 3: 'WHITE_WIN', 4: 'WHITE_WIN' },
      5: { 1: 'BLACK_WIN', 2: 'WHITE_WIN', 3: 'DRAW', 4: 'BLACK_WIN' },
      6: { 1: 'WHITE_WIN', 2: 'BLACK_WIN', 3: 'BLACK_WIN', 4: 'DRAW' },
      7: { 1: 'DRAW', 2: 'WHITE_WIN', 3: 'WHITE_WIN', 4: 'BLACK_WIN' },
    }

    for (let r = 1; r <= 7; r++) {
      const round = await pairRound($, tid)
      expect(round.roundNr).toBe(r)
      await setResultsFromScript($, tid, r, round.games, script[r])
    }

    // Count whites/blacks per player across all rounds
    const allRounds = await $.get(`/api/tournaments/${tid}/rounds`)
    const colorCounts: Record<string, { whites: number; blacks: number }> = {}

    for (const r of allRounds) {
      for (const g of r.games) {
        if (!g.whitePlayer || !g.blackPlayer) continue
        const wn = g.whitePlayer.name
        const bn = g.blackPlayer.name
        if (!colorCounts[wn]) colorCounts[wn] = { whites: 0, blacks: 0 }
        if (!colorCounts[bn]) colorCounts[bn] = { whites: 0, blacks: 0 }
        colorCounts[wn].whites++
        colorCounts[bn].blacks++
      }
    }

    const snapshot = Object.entries(colorCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, counts]) => ({ name, whites: counts.whites, blacks: counts.blacks }))

    // Structural assert: |whites - blacks| <= 1
    for (const { name, whites, blacks } of snapshot) {
      expect(
        Math.abs(whites - blacks),
        `Color imbalance for ${name}: ${whites}W ${blacks}B`,
      ).toBeLessThanOrEqual(1)
    }
    expect(snapshot).toEqual(MONRAD_COLOR)
  })

  test('NordicSchweizer color balance', async ({ page }) => {
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
        name: 'NS-color-balance',
        pairingSystem: 'Nordisk Schweizer',
        nrOfRounds: 7,
      },
      players,
    )

    const script: Record<number, Record<number, string>> = {
      1: { 1: 'WHITE_WIN', 2: 'BLACK_WIN', 3: 'DRAW', 4: 'WHITE_WIN' },
      2: { 1: 'BLACK_WIN', 2: 'WHITE_WIN', 3: 'BLACK_WIN', 4: 'DRAW' },
      3: { 1: 'WHITE_WIN', 2: 'DRAW', 3: 'WHITE_WIN', 4: 'BLACK_WIN' },
      4: { 1: 'DRAW', 2: 'BLACK_WIN', 3: 'WHITE_WIN', 4: 'WHITE_WIN' },
      5: { 1: 'BLACK_WIN', 2: 'WHITE_WIN', 3: 'DRAW', 4: 'BLACK_WIN' },
      6: { 1: 'WHITE_WIN', 2: 'BLACK_WIN', 3: 'BLACK_WIN', 4: 'DRAW' },
      7: { 1: 'DRAW', 2: 'WHITE_WIN', 3: 'WHITE_WIN', 4: 'BLACK_WIN' },
    }

    for (let r = 1; r <= 7; r++) {
      const round = await pairRound($, tid)
      expect(round.roundNr).toBe(r)
      await setResultsFromScript($, tid, r, round.games, script[r])
    }

    const allRounds = await $.get(`/api/tournaments/${tid}/rounds`)
    const colorCounts: Record<string, { whites: number; blacks: number }> = {}

    for (const r of allRounds) {
      for (const g of r.games) {
        if (!g.whitePlayer || !g.blackPlayer) continue
        const wn = g.whitePlayer.name
        const bn = g.blackPlayer.name
        if (!colorCounts[wn]) colorCounts[wn] = { whites: 0, blacks: 0 }
        if (!colorCounts[bn]) colorCounts[bn] = { whites: 0, blacks: 0 }
        colorCounts[wn].whites++
        colorCounts[bn].blacks++
      }
    }

    const snapshot = Object.entries(colorCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, counts]) => ({ name, whites: counts.whites, blacks: counts.blacks }))

    for (const { name, whites, blacks } of snapshot) {
      expect(
        Math.abs(whites - blacks),
        `Color imbalance for ${name}: ${whites}W ${blacks}B`,
      ).toBeLessThanOrEqual(1)
    }
    expect(snapshot).toEqual(NS_COLOR)
  })

  test('Identical ratings seeding', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const players: PlayerInput[] = [
      { lastName: 'Alfa', firstName: 'A', ratingI: 1500 },
      { lastName: 'Beta', firstName: 'B', ratingI: 1500 },
      { lastName: 'Gamma', firstName: 'C', ratingI: 1500 },
      { lastName: 'Delta', firstName: 'D', ratingI: 1500 },
    ]

    const { tid } = await createTournament(
      $,
      {
        name: 'Identical-ratings',
        pairingSystem: 'Monrad',
        nrOfRounds: 2,
      },
      players,
    )

    const r1 = await pairRound($, tid)
    expect(r1.roundNr).toBe(1)

    const pairings = snapshotPairings(r1)
    expect(pairings).toEqual(IDENTICAL_RATINGS)
  })
})
