import {
  ALL_DRAWS,
  type ApiClient,
  apiClient,
  createTournament,
  fetchStandings,
  HIGHER_RATED_WINS,
  type PlayerInput,
  type ResultFn,
  setResults,
  waitForApi,
} from './api-helpers'
import { expect, test } from './fixtures'
import type { RoundPairings, Snapshot } from './pairings-snapshots'
import {
  BERGER_7P_ODD,
  BERGER_8P_BASE,
  MONRAD_7P_ODD,
  MONRAD_8P_BASE,
  MONRAD_8P_DRAWS,
  MONRAD_8P_WITHDRAW,
  NS_7P_ODD,
  NS_8P_BASE,
  NS_8P_DRAWS,
  NS_8P_WITHDRAW,
} from './pairings-snapshots'

// ── Player sets ─────────────────────────────────────────────────────────

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

const PLAYERS_7 = PLAYERS_8.slice(0, 7)

// ── Helpers ─────────────────────────────────────────────────────────────

type AfterRoundHook = (
  round: number,
  $: ApiClient,
  tid: number,
  addedPlayers: any[],
) => Promise<void>

function extractPairings(round: any): RoundPairings {
  return round.games.map((g: any) => [
    g.whitePlayer?.name ?? '(bye)',
    g.blackPlayer?.name ?? '(bye)',
  ])
}

// ── Unified snapshot runner ─────────────────────────────────────────────

interface SnapshotTestConfig {
  name: string
  pairingSystem: string
  nrOfRounds: number
  players: PlayerInput[]
  expected: Snapshot
  resultFn: ResultFn
  afterRound?: AfterRoundHook
}

async function runSnapshot(page: any, config: SnapshotTestConfig) {
  await page.goto('/')
  await waitForApi(page)
  const $ = apiClient(page)
  const { tid, addedPlayers } = await createTournament($, config, config.players)

  const isBerger = config.pairingSystem === 'Berger'
  if (isBerger) {
    await $.post(`/api/tournaments/${tid}/pair?confirm=true`)
  }

  for (let roundIdx = 0; roundIdx < config.nrOfRounds; roundIdx++) {
    if (config.afterRound && roundIdx > 0) {
      await config.afterRound(roundIdx, $, tid, addedPlayers)
    }

    let round: any
    if (isBerger) {
      round = await $.get(`/api/tournaments/${tid}/rounds/${roundIdx + 1}`)
    } else {
      round = await $.post(`/api/tournaments/${tid}/pair?confirm=true`)
      expect(round.roundNr).toBe(roundIdx + 1)
    }

    const pairings = extractPairings(round)
    expect(pairings).toEqual(config.expected.pairings[roundIdx])
    await setResults($, tid, roundIdx + 1, round.games, config.resultFn)
  }

  const raw = await fetchStandings($, tid, config.nrOfRounds)
  const standings = raw.map((s: any) => ({ place: s.place, name: s.name, score: s.score }))
  expect(standings).toEqual(config.expected.standings)
}

// ── Withdrawal hook ─────────────────────────────────────────────────────

const withdrawSigridAfterRound2: AfterRoundHook = async (roundIdx, $, tid, addedPlayers) => {
  if (roundIdx === 2) {
    const sigrid = addedPlayers[7]
    await $.put(`/api/tournaments/${tid}/players/${sigrid.id}`, {
      ...sigrid,
      withdrawnFromRound: 3,
    })
  }
}

// ═════════════════════════════════════════════════════════════════════════
// Tests
// ═════════════════════════════════════════════════════════════════════════

test.describe('Base case: 8 players, higher-rated wins', () => {
  test('Nordisk Schweizer', async ({ page }) => {
    await runSnapshot(page, {
      name: 'NS-8p-base',
      pairingSystem: 'Nordisk Schweizer',
      nrOfRounds: 7,
      players: PLAYERS_8,
      expected: NS_8P_BASE,
      resultFn: HIGHER_RATED_WINS,
    })
  })

  test('Monrad', async ({ page }) => {
    await runSnapshot(page, {
      name: 'Monrad-8p-base',
      pairingSystem: 'Monrad',
      nrOfRounds: 7,
      players: PLAYERS_8,
      expected: MONRAD_8P_BASE,
      resultFn: HIGHER_RATED_WINS,
    })
  })

  test('Berger', async ({ page }) => {
    await runSnapshot(page, {
      name: 'Berger-8p-base',
      pairingSystem: 'Berger',
      nrOfRounds: 7,
      players: PLAYERS_8,
      expected: BERGER_8P_BASE,
      resultFn: HIGHER_RATED_WINS,
    })
  })
})

test.describe('Odd players: 7 players with bye', () => {
  test('Nordisk Schweizer', async ({ page }) => {
    await runSnapshot(page, {
      name: 'NS-7p-odd',
      pairingSystem: 'Nordisk Schweizer',
      nrOfRounds: 6,
      players: PLAYERS_7,
      expected: NS_7P_ODD,
      resultFn: HIGHER_RATED_WINS,
    })
  })

  test('Monrad', async ({ page }) => {
    await runSnapshot(page, {
      name: 'Monrad-7p-odd',
      pairingSystem: 'Monrad',
      nrOfRounds: 6,
      players: PLAYERS_7,
      expected: MONRAD_7P_ODD,
      resultFn: HIGHER_RATED_WINS,
    })
  })

  test('Berger', async ({ page }) => {
    await runSnapshot(page, {
      name: 'Berger-7p-odd',
      pairingSystem: 'Berger',
      nrOfRounds: 7,
      players: PLAYERS_7,
      expected: BERGER_7P_ODD,
      resultFn: HIGHER_RATED_WINS,
    })
  })
})

test.describe('All draws: single score group', () => {
  test('Nordisk Schweizer (3 rounds — algorithm limit)', async ({ page }) => {
    await runSnapshot(page, {
      name: 'NS-8p-draws',
      pairingSystem: 'Nordisk Schweizer',
      nrOfRounds: 3,
      players: PLAYERS_8,
      expected: NS_8P_DRAWS,
      resultFn: ALL_DRAWS,
    })
  })

  test('Monrad', async ({ page }) => {
    await runSnapshot(page, {
      name: 'Monrad-8p-draws',
      pairingSystem: 'Monrad',
      nrOfRounds: 7,
      players: PLAYERS_8,
      expected: MONRAD_8P_DRAWS,
      resultFn: ALL_DRAWS,
    })
  })
})

test.describe('Keyboard navigation in pairings table', () => {
  async function seedAndOpen(page: import('@playwright/test').Page) {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const { tid } = await createTournament(
      $,
      {
        name: `kbnav-${Date.now()}`,
        pairingSystem: 'Monrad',
        nrOfRounds: 3,
      },
      PLAYERS_8,
    )
    await $.post(`/api/tournaments/${tid}/pair?confirm=true`)
    await page.goto(`/?tournamentId=${tid}&tab=pairings`)
    await expect(page.getByTestId('data-table')).toBeVisible()
    return page.getByTestId('data-table').locator('tbody tr')
  }

  test('ArrowDown moves selection to the next row', async ({ page }) => {
    const rows = await seedAndOpen(page)
    await rows.nth(0).click()
    await expect(rows.nth(0)).toHaveClass(/selected/)
    await page.keyboard.press('ArrowDown')
    await expect(rows.nth(1)).toHaveClass(/selected/)
    await expect(rows.nth(0)).not.toHaveClass(/selected/)
  })

  test('ArrowUp moves selection to the previous row', async ({ page }) => {
    const rows = await seedAndOpen(page)
    await rows.nth(2).click()
    await expect(rows.nth(2)).toHaveClass(/selected/)
    await page.keyboard.press('ArrowUp')
    await expect(rows.nth(1)).toHaveClass(/selected/)
  })

  test('v auto-advances and the next v hits the next board, not the previous one', async ({
    page,
  }) => {
    const rows = await seedAndOpen(page)

    await rows.nth(0).click()
    await expect(rows.nth(0)).toHaveClass(/selected/)

    // First v: white wins board 1, auto-advance to board 2
    await page.keyboard.press('v')
    await expect(page.getByTestId('result-dropdown-1')).toContainText('1-0')
    await expect(rows.nth(1)).toHaveClass(/selected/)

    // Second v: must hit board 2 (the new selection), NOT re-set board 1
    await page.keyboard.press('v')
    await expect(page.getByTestId('result-dropdown-2')).toContainText('1-0')
    await expect(rows.nth(2)).toHaveClass(/selected/)
  })

  test('ArrowDown then v sets the result on the row that was navigated to', async ({ page }) => {
    const rows = await seedAndOpen(page)
    await rows.nth(0).click()
    await page.keyboard.press('ArrowDown')
    await expect(rows.nth(1)).toHaveClass(/selected/)

    await page.keyboard.press('v')
    await expect(page.getByTestId('result-dropdown-2')).toContainText('1-0')
    // Board 1 must remain blank — focus moved before v was pressed
    await expect(page.getByTestId('result-dropdown-1')).not.toContainText('1-0')
  })
})

test.describe('Withdrawal: player drops after round 2', () => {
  test('Nordisk Schweizer (3 rounds — algorithm limit)', async ({ page }) => {
    await runSnapshot(page, {
      name: 'NS-8p-withdraw',
      pairingSystem: 'Nordisk Schweizer',
      nrOfRounds: 3,
      players: PLAYERS_8,
      expected: NS_8P_WITHDRAW,
      resultFn: HIGHER_RATED_WINS,
      afterRound: withdrawSigridAfterRound2,
    })
  })

  test('Monrad (4 rounds — algorithm limit)', async ({ page }) => {
    await runSnapshot(page, {
      name: 'Monrad-8p-withdraw',
      pairingSystem: 'Monrad',
      nrOfRounds: 4,
      players: PLAYERS_8,
      expected: MONRAD_8P_WITHDRAW,
      resultFn: HIGHER_RATED_WINS,
      afterRound: withdrawSigridAfterRound2,
    })
  })
})
