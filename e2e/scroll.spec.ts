import { type Page } from '@playwright/test'
import {
  apiClient,
  createTournament,
  ensureClubs,
  type PlayerInput,
  pairRound,
  waitForApi,
} from './api-helpers'
import { expect, test } from './fixtures'

// Use a short viewport so even a handful of rows overflow the content area,
// making scroll behavior observable regardless of per-view data volume.
test.use({ viewport: { width: 900, height: 300 } })

// ── Test data ───────────────────────────────────────────────────────────

const CLUBS = [
  { name: 'SK Alfa', chess4Members: 12 },
  { name: 'SK Beta', chess4Members: 8 },
  { name: 'SK Gamma', chess4Members: 15 },
  { name: 'SK Delta', chess4Members: 10 },
  { name: 'SK Epsilon', chess4Members: 6 },
]

function manyPlayers(count: number): PlayerInput[] {
  return Array.from({ length: count }, (_, i) => ({
    lastName: `Spelare${String(i + 1).padStart(3, '0')}`,
    firstName: `Test${i + 1}`,
    ratingI: 2000 - i * 5,
  }))
}

async function seedTournament(page: Page, opts: { chess4?: boolean } = {}): Promise<number> {
  await page.goto('/')
  await waitForApi(page)
  const $ = apiClient(page)
  const clubIds = await ensureClubs($, CLUBS)
  const players = manyPlayers(40).map((p, i) => ({
    ...p,
    clubIndex: clubIds[i % clubIds.length],
  }))
  const { tid } = await createTournament(
    $,
    {
      name: `Scroll-${opts.chess4 ? 'c4' : 'std'}-${Date.now()}`,
      pairingSystem: 'Monrad',
      nrOfRounds: 3,
      chess4: opts.chess4,
      pointsPerGame: opts.chess4 ? 4 : 1,
    },
    players,
  )
  await pairRound($, tid)
  return tid
}

// ── Assertion helper ────────────────────────────────────────────────────

async function assertScrollable(page: Page) {
  // TabPanel always renders LiveTab (with display:none) so "scroll-container"
  // may match more than one element. Filter to the visible one.
  const scrollContainer = page.locator('[data-testid="scroll-container"]:visible')
  await expect(scrollContainer).toBeVisible()

  const result = await scrollContainer.evaluate((el) => {
    const style = getComputedStyle(el)
    return {
      overflowY: style.overflowY,
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
    }
  })

  expect(
    result.overflowY === 'auto' || result.overflowY === 'scroll',
    `overflow-y should be auto or scroll, got "${result.overflowY}"`,
  ).toBe(true)
  expect(result.scrollHeight, 'content must overflow so we can verify scrolling').toBeGreaterThan(
    result.clientHeight + 1,
  )

  // Scroll programmatically and confirm the scroll position actually moves.
  const scrolledTo = await scrollContainer.evaluate((el) => {
    el.scrollTop = el.scrollHeight
    return el.scrollTop
  })
  expect(scrolledTo, 'scrollTop should increase after setting it').toBeGreaterThan(0)
}

async function openTab(page: Page, tid: number, tab: string) {
  await page.goto(`/?tournamentId=${tid}&tab=${tab}`)
}

// ── Tests ───────────────────────────────────────────────────────────────

test.describe('Scrolling behavior when content overflows viewport', () => {
  test('pairings tab scrolls when games exceed viewport', async ({ page }) => {
    const tid = await seedTournament(page)
    await openTab(page, tid, 'pairings')
    await expect(page.getByTestId('data-table')).toBeVisible()
    await assertScrollable(page)
  })

  test('standings tab scrolls when players exceed viewport', async ({ page }) => {
    const tid = await seedTournament(page)
    await openTab(page, tid, 'standings')
    await expect(page.getByTestId('data-table')).toBeVisible()
    await assertScrollable(page)
  })

  test('players tab scrolls when players exceed viewport', async ({ page }) => {
    const tid = await seedTournament(page)
    await openTab(page, tid, 'players')
    await expect(page.getByTestId('data-table')).toBeVisible()
    await assertScrollable(page)
  })

  test('alphabetical tab scrolls when players exceed viewport', async ({ page }) => {
    const tid = await seedTournament(page)
    await openTab(page, tid, 'alphabetical')
    await expect(page.getByTestId('data-table')).toBeVisible()
    await assertScrollable(page)
  })

  test('club-standings tab scrolls when clubs exceed viewport', async ({ page }) => {
    const tid = await seedTournament(page)
    await openTab(page, tid, 'club-standings')
    await expect(page.getByTestId('data-table')).toBeVisible()
    await assertScrollable(page)
  })

  test('chess4-setup tab scrolls when clubs exceed viewport', async ({ page }) => {
    const tid = await seedTournament(page, { chess4: true })
    await openTab(page, tid, 'chess4-setup')
    await expect(page.getByTestId('data-table')).toBeVisible()
    await assertScrollable(page)
  })

  test('chess4-standings tab scrolls when clubs exceed viewport', async ({ page }) => {
    const tid = await seedTournament(page, { chess4: true })
    await openTab(page, tid, 'chess4-standings')
    await expect(page.getByTestId('data-table')).toBeVisible()
    await assertScrollable(page)
  })

  test('live tab scrolls when intro content exceeds viewport', async ({ page }) => {
    // Live intro is compact; shrink further so it definitely overflows.
    await page.setViewportSize({ width: 900, height: 220 })
    const tid = await seedTournament(page)
    await openTab(page, tid, 'live')
    await assertScrollable(page)
  })
})
