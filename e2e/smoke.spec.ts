/**
 * Release-gating smoke tests. These run in CI on every push to main and block
 * the deploy if they fail, so keep them fast and focused on the flows an
 * arbiter cannot work around mid-tournament.
 *
 * Interactions go through the real mouse/keyboard (no API shortcuts for the
 * step under test): the result context menu was broken for months because
 * every existing test either used keyboard shortcuts or only checked that the
 * menu appeared, never that clicking an item did anything.
 */

import { apiClient, createTournament, pairRound, waitForApi } from './api-helpers'
import { expect, test } from './fixtures'
import { selectTournament } from './helpers'

const PLAYERS = [
  { lastName: 'Svensson', firstName: 'Anna', ratingI: 1800 },
  { lastName: 'Johansson', firstName: 'Erik', ratingI: 1750 },
  { lastName: 'Nilsson', firstName: 'Karl', ratingI: 1700 },
  { lastName: 'Lindberg', firstName: 'Maria', ratingI: 1650 },
]

let tid: number

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await waitForApi(page)
  const $ = apiClient(page)
  ;({ tid } = await createTournament(
    $,
    { name: 'Röktest', pairingSystem: 'Monrad', nrOfRounds: 3 },
    PLAYERS,
  ))
  await pairRound($, tid)
  await page.reload()
  await waitForApi(page)
  await selectTournament(page, 'Röktest')
  await expect(page.getByTestId('data-table')).toBeVisible()
})

async function resultOf(page: import('@playwright/test').Page, round: number, boardNr: number) {
  const data = await apiClient(page).get(`/api/tournaments/${tid}/rounds/${round}`)
  return data.games.find((g: { boardNr: number }) => g.boardNr === boardNr).resultType
}

test('sets a result by clicking an item in the right-click menu', async ({ page }) => {
  await page.getByTestId('data-table').locator('tbody tr').first().click({ button: 'right' })
  const ctxMenu = page.getByTestId('result-context-menu')
  await expect(ctxMenu).toBeVisible()

  await ctxMenu.getByRole('button', { name: /^Remi/ }).click()

  await expect(ctxMenu).not.toBeVisible()
  await expect.poll(() => resultOf(page, 1, 1)).toBe('DRAW')
})

test('sets a walk over result from the submenu with the mouse', async ({ page }) => {
  await page.getByTestId('result-dropdown-2').click()
  const ctxMenu = page.getByTestId('result-context-menu')
  await expect(ctxMenu).toBeVisible()

  await ctxMenu.getByTestId('result-context-submenu').hover()
  await ctxMenu
    .getByTestId('result-context-submenu-items')
    .getByRole('button', { name: 'Svart vinst' })
    .click()

  await expect(ctxMenu).not.toBeVisible()
  await expect.poll(() => resultOf(page, 1, 2)).toBe('BLACK_WIN_WO')
})

test('opens Editera poäng from the result menu', async ({ page }) => {
  await page.getByTestId('data-table').locator('tbody tr').first().click({ button: 'right' })
  await page
    .getByTestId('result-context-menu')
    .getByRole('button', { name: 'Editera poäng' })
    .click()

  await expect(page.getByTestId('dialog-title')).toHaveText('Sätt poängresultat')
})

test('pairs the next round from the Lotta menu after all results are in', async ({ page }) => {
  for (const board of [1, 2]) {
    await page.getByTestId(`result-dropdown-${board}`).click()
    await page
      .getByTestId('result-context-menu')
      .getByRole('button', { name: /^Vit vinst/ })
      .click()
    await expect.poll(() => resultOf(page, 1, board)).toBe('WHITE_WIN')
  }

  await page.getByTestId('menu-bar').getByRole('button', { name: 'Lotta' }).click()
  await page.getByTestId('menu-dropdown').getByText('Lotta nästa rond').click()

  await expect
    .poll(async () => (await apiClient(page).get(`/api/tournaments/${tid}`)).roundsPlayed)
    .toBe(2)
})

test('shows why saving tournament settings failed', async ({ page }) => {
  // "Antal ronder" 0 is rejected by validation (must be at least 1); the error
  // must be shown in the dialog instead of Spara silently doing nothing.
  await page.getByTestId('menu-bar').getByRole('button', { name: 'Turnering' }).click()
  await page.getByTestId('menu-dropdown').getByText('Editera').click()
  await page.getByTestId('tournament-nr-of-rounds-input').fill('0')
  await page.getByRole('button', { name: 'Spara' }).click()

  await expect(page.getByTestId('tournament-save-error')).toBeVisible()
})

test('imports players from a tab-separated file', async ({ page }) => {
  const fileInput = page.locator('input[type="file"][accept*=".tsv"]')
  await fileInput.setInputFiles({
    name: 'spelare.tsv',
    mimeType: 'text/tab-separated-values',
    buffer: Buffer.from('Efternamn\tFörnamn\tKlubb\tGrupp\nÖstlund\tPer\tSK Röktest\t2\n'),
  })

  await expect(
    page
      .getByTestId('toast')
      .filter({ hasText: '1 nya spelare tillagda som tillgängliga spelare.' }),
  ).toBeVisible()
  const pool = await apiClient(page).get('/api/players')
  expect(pool.find((p: { lastName: string }) => p.lastName === 'Östlund')).toMatchObject({
    firstName: 'Per',
    club: 'SK Röktest',
    playerGroup: '2',
  })
})

test.describe('rating choice chosen in the tournament dialog', () => {
  // Regression: the dialog saved the Swedish label, so every choice but ELO read
  // all ratings as 0: no ratings shown and round 1 seeded by name, not rating.
  test('given "Blixt-ELO annars ELO" is chosen when creating the tournament, when round 1 is paired, then ratings are shown and seeding follows them', async ({
    page,
  }) => {
    await page.goto('/')
    await waitForApi(page)
    await page.getByTestId('menu-bar').getByRole('button', { name: 'Turnering' }).click()
    await page.getByTestId('menu-dropdown').getByText('Ny', { exact: true }).click()
    const dialog = page.getByTestId('dialog-overlay')
    await dialog.getByTestId('tournament-name-input').fill('Blixtkväll')
    await dialog.getByTestId('tournament-group-input').fill('A')
    await dialog
      .getByTestId('tournament-rating-choice-select')
      .selectOption({ label: 'Blixt-ELO annars ELO' })
    await dialog.getByRole('button', { name: 'Spara' }).click()
    await expect(dialog).not.toBeVisible()

    const $ = apiClient(page)
    const created = (await $.get('/api/tournaments')).find(
      (t: { name: string }) => t.name === 'Blixtkväll',
    )
    // Alphabetical order (Andersson, Berg, Carlsson, Dahl) is the reverse of the
    // effective rating order, so name-order seeding cannot pass by accident.
    const players = [
      { lastName: 'Andersson', firstName: 'Anna', ratingI: 1500, ratingB: 0 },
      { lastName: 'Berg', firstName: 'Bo', ratingI: 1900, ratingB: 0 },
      { lastName: 'Carlsson', firstName: 'Cia', ratingI: 1700, ratingB: 1990 },
      { lastName: 'Dahl', firstName: 'Dan', ratingI: 2105, ratingB: 2080 },
    ]
    for (const p of players) {
      await $.post(`/api/tournaments/${created.id}/players`, {
        ...p,
        ratingN: 0,
        ratingQ: 0,
        ratingK: 0,
        ratingKQ: 0,
        ratingKB: 0,
        clubIndex: 0,
        title: '',
        sex: '',
        federation: 'SWE',
        fideId: 0,
        ssfId: 0,
        playerGroup: '',
        withdrawnFromRound: -1,
        manualTiebreak: 0,
      })
    }
    await page.reload()
    await waitForApi(page)
    // No round yet, so there is no pairings table to wait for (selectTournament does).
    const selector = page.getByTestId('tournament-selector').locator('select').first()
    await selector.locator('option', { hasText: 'Blixtkväll' }).waitFor({ state: 'attached' })
    await selector.selectOption('Blixtkväll')

    await page.getByTestId('menu-bar').getByRole('button', { name: 'Lotta', exact: true }).click()
    await page.getByTestId('menu-dropdown').getByText('Lotta nästa rond').click()

    // Effective ratings: Dahl 2080 (blitz), Carlsson 1990 (blitz), Berg 1900
    // (ELO fallback), Andersson 1500 (ELO fallback). The dialog's default system
    // is Nordisk Schweizer: round 1 pairs top half vs bottom half, seed 1–3 and
    // 2–4. Name-order seeding would instead give Andersson–Carlsson, Berg–Dahl.
    const board1 = page.locator('tr[data-board-nr="1"]').first()
    const board2 = page.locator('tr[data-board-nr="2"]').first()
    await expect(board1).toContainText('Dahl')
    await expect(board1).toContainText('Berg')
    await expect(board1).toContainText('2080')
    await expect(board1).toContainText('1900')
    await expect(board2).toContainText('Carlsson')
    await expect(board2).toContainText('Andersson')
    await expect(board2).toContainText('1990')
  })
})
