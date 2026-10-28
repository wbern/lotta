/**
 * ADR-0007, P2P side: a host write that is not a React Query mutation (Ta bort
 * bord, Editera bord, player import, test players) used to reach connected
 * peers only if it happened to carry a page-broadcast "affects" hint. A
 * referee working from the full shared view kept seeing a deleted board until
 * some other write happened. Every host write ends in save(), so every one
 * must tell peers that the data changed.
 */
import type { BrowserContext } from '@playwright/test'
import { apiClient, createTournament, type PlayerInput, pairRound, waitForApi } from './api-helpers'
import { expect, type Page, test } from './fixtures'

const PLAYERS: PlayerInput[] = [
  { lastName: 'Eriksson', firstName: 'Anna', ratingI: 1900 },
  { lastName: 'Lindberg', firstName: 'Magnus', ratingI: 1800 },
  { lastName: 'Svensson', firstName: 'Karin', ratingI: 1700 },
  { lastName: 'Öberg', firstName: 'Sofia', ratingI: 1600 },
]
const TOURNAMENT_NAME = 'P2P-färskhet'

async function dismissBanner(page: Page) {
  try {
    await page.getByRole('button', { name: 'OK', exact: true }).click({ timeout: 2000 })
  } catch {
    // Banner not present.
  }
}

async function hostStartLive(page: Page): Promise<string> {
  await page.goto('/')
  await waitForApi(page)
  await dismissBanner(page)
  const $ = apiClient(page)
  const { tid } = await createTournament(
    $,
    { name: TOURNAMENT_NAME, pairingSystem: 'Monrad', nrOfRounds: 3 },
    PLAYERS,
  )
  await pairRound($, tid)
  await page.reload()
  await waitForApi(page)
  await dismissBanner(page)
  const sel = page.getByTestId('tournament-selector').locator('select').first()
  await sel.locator('option', { hasText: TOURNAMENT_NAME }).waitFor({ state: 'attached' })
  await sel.selectOption(TOURNAMENT_NAME)

  await page.getByTestId('tab-headers').getByText('Live (Beta)').click()
  await page.locator('button', { hasText: 'Starta Live' }).click()
  await expect(page.getByTestId('live-peer-badge')).toContainText('0 anslutna')

  await page.getByRole('tab', { name: 'Domarstyrning' }).click()
  await page.getByTestId('grant-label-input').fill('Domare')
  await page.getByTestId('grant-submit').click()
  const grantRow = page.locator('[data-testid^="grant-row-"]').first()
  await expect(grantRow).toBeVisible()
  const shareUrl = await grantRow.getAttribute('data-grant-url')
  expect(shareUrl).toBeTruthy()

  await page.getByTestId('tab-headers').getByText('Lottning & resultat').click()
  return shareUrl!
}

async function connectReferee(page: Page, shareUrl: string) {
  await page.addInitScript(() => {
    localStorage.setItem('lotta-live-name', 'Domare')
  })
  await page.goto(shareUrl)
  await expect(page.getByTestId('status-live')).toBeVisible({ timeout: 60_000 })
  await dismissBanner(page)
  const sel = page.getByTestId('tournament-selector').locator('select').first()
  await sel
    .locator('option', { hasText: TOURNAMENT_NAME })
    .waitFor({ state: 'attached', timeout: 30_000 })
  await sel.selectOption(TOURNAMENT_NAME)
  await page.getByTestId('tab-headers').getByText('Lottning & resultat').click()
  await expect(page.locator('tr[data-board-nr="2"]')).toBeVisible({ timeout: 30_000 })
}

test.describe('P2P: host writes outside a mutation reach connected peers', () => {
  test.setTimeout(120_000)

  let hostCtx: BrowserContext
  let refCtx: BrowserContext

  test.afterEach(async () => {
    await refCtx?.close()
    await hostCtx?.close()
  })

  test('given a referee on the shared view, when the host deletes a board, then it disappears for the referee', async ({
    browser,
  }) => {
    hostCtx = await browser.newContext({ ignoreHTTPSErrors: true })
    refCtx = await browser.newContext({ ignoreHTTPSErrors: true })
    const host = await hostCtx.newPage()
    const referee = await refCtx.newPage()
    const shareUrl = await hostStartLive(host)
    await connectReferee(referee, shareUrl)

    await host.locator('tr[data-board-nr="2"]').first().locator('td').first().click()
    host.once('dialog', (d) => d.accept())
    await host.getByTestId('menu-bar').getByRole('button', { name: 'Lotta', exact: true }).click()
    await host.getByTestId('menu-dropdown').getByText('Ta bort bord').click()
    await expect(host.locator('tr[data-board-nr="2"]')).toHaveCount(0)

    await expect(referee.locator('tr[data-board-nr="2"]')).toHaveCount(0, { timeout: 20_000 })
    await expect(referee.locator('tr[data-board-nr="1"]')).toBeVisible()
  })
})
