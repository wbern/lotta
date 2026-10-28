/**
 * End-to-end confirmation of the UX-solidification fixes, driven through the
 * real UI the way an arbiter uses it. Each test is the acceptance check for one
 * fix; unit tests cover the details, these prove the user-visible outcome.
 */

import { apiClient, createTournament, pairRound, waitForApi } from './api-helpers'
import { expect, test } from './fixtures'
import { selectTournament } from './helpers'

const FOUR = [
  { lastName: 'Andersson', firstName: 'Anna', ratingI: 1500 },
  { lastName: 'Berg', firstName: 'Bo', ratingI: 1900 },
  { lastName: 'Carlsson', firstName: 'Cia', ratingI: 1700 },
  { lastName: 'Dahl', firstName: 'Dan', ratingI: 2105 },
]

function menu(page: import('@playwright/test').Page, name: string) {
  return page.getByTestId('menu-bar').getByRole('button', { name, exact: true })
}

function tab(page: import('@playwright/test').Page, label: string) {
  return page.getByTestId('tab-headers').getByText(label, { exact: true })
}

test('(1) withdrawing a player shows "(utgått rN)" in Ställning right away, without pairing another round', async ({
  page,
}) => {
  await page.goto('/')
  await waitForApi(page)
  const $ = apiClient(page)
  const { tid } = await createTournament(
    $,
    { name: 'Utgång', pairingSystem: 'Monrad', nrOfRounds: 3 },
    FOUR,
  )
  await pairRound($, tid)
  await page.reload()
  await waitForApi(page)
  await selectTournament(page, 'Utgång')

  // Load Ställning first so its data is cached, as when an arbiter checks it mid-event.
  await tab(page, 'Ställning').click()
  await expect(page.getByTestId('data-table')).toContainText('Dan Dahl')
  await expect(page.getByTestId('data-table')).not.toContainText('utgått')

  await menu(page, 'Spelare').click()
  await page
    .getByTestId('menu-dropdown')
    .getByRole('button', { name: 'Turneringsspelare', exact: true })
    .click()
  const dialog = page.getByTestId('dialog-overlay')
  await dialog.getByRole('button', { name: 'Turneringsspelare', exact: true }).click()
  await dialog.getByTestId('data-table').first().getByText('Dan Dahl').dblclick()
  await dialog.getByTestId('withdrawn-checkbox').check()
  await expect(dialog.getByTestId('withdrawn-round-input')).toHaveValue('2')
  await dialog.getByTestId('update-player').click()
  await dialog.getByRole('button', { name: 'Stäng' }).click()

  await expect(page.getByTestId('data-table')).toContainText('Dan Dahl (utgått r2)')
  expect((await $.get(`/api/tournaments/${tid}`)).roundsPlayed).toBe(1)
})

test('(2) following the start-page steps literally gets a tournament paired', async ({ page }) => {
  await page.goto('/')
  await waitForApi(page)
  const steps = page.locator('.empty-state-step-path')
  await expect(steps).toHaveText([
    'Turnering → Ny',
    'Spelare → Turneringsspelare',
    'Lotta → Lotta nästa rond',
  ])

  // Step 1: Turnering → Ny
  await menu(page, 'Turnering').click()
  await page.getByTestId('menu-dropdown').getByText('Ny', { exact: true }).click()
  const newDialog = page.getByTestId('dialog-overlay')
  await newDialog.getByTestId('tournament-name-input').fill('Stegvis')
  await newDialog.getByTestId('tournament-group-input').fill('A')
  await newDialog.getByRole('button', { name: 'Spara' }).click()
  await expect(newDialog).not.toBeVisible()

  // Step 2: Spelare → Turneringsspelare, add two players there
  await menu(page, 'Spelare').click()
  await page
    .getByTestId('menu-dropdown')
    .getByRole('button', { name: 'Turneringsspelare', exact: true })
    .click()
  const dialog = page.getByTestId('dialog-overlay')
  for (const [first, last] of [
    ['Anna', 'Andersson'],
    ['Bo', 'Berg'],
  ]) {
    await dialog.getByRole('button', { name: 'Skapa eller editera spelare' }).click()
    await dialog.getByTestId('first-name-input').fill(first)
    await dialog.getByTestId('last-name-input').fill(last)
    await dialog.getByTestId('add-player').click()
    await expect(dialog.getByTestId('data-table').first()).toContainText(`${first} ${last}`)
  }
  await dialog.getByRole('button', { name: 'Stäng' }).click()

  // Step 3: Lotta → Lotta nästa rond
  await menu(page, 'Lotta').click()
  await page.getByTestId('menu-dropdown').getByText('Lotta nästa rond').click()

  await expect(page.locator('tr[data-board-nr="1"]').first()).toContainText('Andersson')
  await expect(page.locator('tr[data-board-nr="1"]').first()).toContainText('Berg')
  await expect(page.getByTestId('pair-error')).toHaveCount(0)
})

test('(3) Historik names the round of a result entered in an earlier round', async ({ page }) => {
  await page.goto('/')
  await waitForApi(page)
  const $ = apiClient(page)
  await createTournament($, { name: 'Historik', pairingSystem: 'Berger', nrOfRounds: 3 }, FOUR)
  const tid = (await $.get('/api/tournaments')).find(
    (t: { name: string }) => t.name === 'Historik',
  ).id
  await pairRound($, tid)
  await page.reload()
  await waitForApi(page)
  await selectTournament(page, 'Historik')

  const roundSelect = page.getByTestId('tournament-selector').locator('select').last()
  await roundSelect.selectOption('2')
  await page.getByTestId('result-dropdown-1').click()
  await page.getByTestId('result-context-menu').getByRole('button', { name: /^Remi/ }).click()

  await menu(page, 'Redigera').click()
  await page.getByTestId('menu-dropdown').getByText('Historik...').click()
  // Historik lists the newest entry first.
  await expect(page.locator('.timeline-entry').first()).toContainText('Ange resultat')
  await expect(page.locator('.timeline-entry').first()).toContainText('Rond 2, Bord 1: ½-½')
})

test('(4) pairing a Berger tournament shows round 1, not the last round', async ({ page }) => {
  await page.goto('/')
  await waitForApi(page)
  const $ = apiClient(page)
  await createTournament($, { name: 'Allsvensk', pairingSystem: 'Berger', nrOfRounds: 3 }, FOUR)
  await page.reload()
  await waitForApi(page)
  const selector = page.getByTestId('tournament-selector').locator('select').first()
  await selector.locator('option', { hasText: 'Allsvensk' }).waitFor({ state: 'attached' })
  await selector.selectOption('Allsvensk')

  await menu(page, 'Lotta').click()
  await page.getByTestId('menu-dropdown').getByText('Lotta nästa rond').click()

  await expect(page).toHaveURL(/round=1(&|$)/)
  await expect(page.getByTestId('tournament-selector').locator('select').last()).toHaveValue('1')
  await expect(page.getByTestId('status-bar')).toContainText('Rond 1/3')
})

test('(5) the Spelare tab shows the rating the tournament uses, same as Lottning', async ({
  page,
}) => {
  await page.goto('/')
  await waitForApi(page)
  const $ = apiClient(page)
  await createTournament(
    $,
    { name: 'Blixtlista', pairingSystem: 'Monrad', nrOfRounds: 3, ratingChoice: 'BLITZ_THEN_ELO' },
    [
      { lastName: 'Dahl', firstName: 'Dan', ratingI: 2105, ratingB: 2080 },
      { lastName: 'Berg', firstName: 'Bo', ratingI: 1900, ratingB: 0 },
    ],
  )
  await page.reload()
  await waitForApi(page)
  const selector = page.getByTestId('tournament-selector').locator('select').first()
  await selector.locator('option', { hasText: 'Blixtlista' }).waitFor({ state: 'attached' })
  await selector.selectOption('Blixtlista')

  await tab(page, 'Spelare').click()
  const table = page.getByTestId('data-table')
  await expect(table.getByRole('row', { name: /Dan Dahl/ })).toContainText('2080')
  await expect(table.getByRole('row', { name: /Bo Berg/ })).toContainText('1900')
})

test('(6) a new tournament dialog with changed settings survives an outside click and Escape', async ({
  page,
}) => {
  await page.goto('/')
  await waitForApi(page)
  await menu(page, 'Turnering').click()
  await page.getByTestId('menu-dropdown').getByText('Ny', { exact: true }).click()
  const dialog = page.getByTestId('dialog-overlay')
  await dialog.getByTestId('tournament-pairing-system-select').selectOption('Berger')

  await dialog.click({ position: { x: 5, y: 5 } })
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByTestId('tournament-pairing-system-select')).toHaveValue('Berger')

  // An untouched dialog still closes on an outside click, as before.
  await dialog.getByTestId('tournament-pairing-system-select').selectOption('Nordisk Schweizer')
  await dialog.click({ position: { x: 5, y: 5 } })
  await expect(dialog).not.toBeVisible()
})
