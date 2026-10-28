/**
 * ADR-0007 acceptance spec — "stale view after a write".
 *
 * Each case makes one write through the real UI and, WITHOUT reloading, checks
 * that every other view showing that data is up to date. Before ADR-0007 each
 * writer invalidated the query keys it thought of and missed a reader, so these
 * views kept showing the old data until an unrelated write or a reload. The
 * reader under test is kept mounted (or revisited within the 5 s staleTime) so
 * nothing but a data-changed refresh can update it.
 */

import type { Page } from '@playwright/test'
import {
  apiClient,
  createTournament,
  ensureClubs,
  type PlayerInput,
  pairRound,
  waitForApi,
} from './api-helpers'
import { expect, test } from './fixtures'
import { selectTournament } from './helpers'

const PLAYERS: PlayerInput[] = [
  { lastName: 'Svensson', firstName: 'Anna', ratingI: 1800 },
  { lastName: 'Johansson', firstName: 'Erik', ratingI: 1750 },
  { lastName: 'Nilsson', firstName: 'Karl', ratingI: 1700 },
  { lastName: 'Lindberg', firstName: 'Maria', ratingI: 1650 },
]

async function setup(
  page: Page,
  opts: { name: string; chess4?: boolean; clubs?: { name: string; chess4Members?: number }[] },
) {
  await page.goto('/')
  await waitForApi(page)
  const $ = apiClient(page)
  const clubIds = opts.clubs ? await ensureClubs($, opts.clubs) : []
  const players = PLAYERS.map((p, i) =>
    clubIds.length > 0 ? { ...p, clubIndex: clubIds[i % clubIds.length] } : p,
  )
  const { tid, addedPlayers } = await createTournament(
    $,
    {
      name: opts.name,
      pairingSystem: 'Monrad',
      nrOfRounds: 3,
      chess4: opts.chess4,
      pointsPerGame: opts.chess4 ? 4 : 1,
    },
    players,
  )
  const round = await pairRound($, tid)
  await page.reload()
  await waitForApi(page)
  await selectTournament(page, opts.name)
  return { tid, $, round, addedPlayers }
}

async function openTab(page: Page, label: string) {
  await page.getByTestId('tab-headers').getByText(label, { exact: true }).click()
}

async function openTournamentPlayers(page: Page) {
  await page.getByTestId('menu-bar').getByRole('button', { name: 'Spelare' }).click()
  await page
    .getByTestId('menu-dropdown')
    .getByRole('button', { name: 'Turneringsspelare', exact: true })
    .click()
  const dialog = page.getByTestId('dialog-overlay')
  await expect(dialog).toBeVisible()
  return dialog
}

async function closeDialog(page: Page) {
  const dialog = page.getByTestId('dialog-overlay')
  await dialog.getByRole('button', { name: 'Stäng' }).click()
  await expect(dialog).not.toBeVisible()
}

const table = (page: Page) => page.getByTestId('tab-content').getByTestId('data-table')

test('renaming a club refreshes Ställning, Alfabetisk lottning and the player dialog', async ({
  page,
}) => {
  await setup(page, { name: 'Klubbyte', clubs: [{ name: 'SK Gamla' }] })
  await openTab(page, 'Ställning')
  await expect(table(page)).toContainText('SK Gamla')

  const dialog = await openTournamentPlayers(page)
  await dialog.getByTestId('data-table').locator('tbody tr').first().click()
  await dialog.getByRole('button', { name: 'Editera', exact: true }).click()
  page.once('dialog', (d) => d.accept('SK Nya'))
  await dialog.getByTestId('club-rename').click()
  await expect(dialog.getByTestId('club-select')).toContainText('SK Nya')
  await closeDialog(page)

  await expect(table(page)).toContainText('SK Nya')
  await expect(table(page)).not.toContainText('SK Gamla')

  await openTab(page, 'Alfabetisk lottning')
  await expect(table(page)).toContainText('SK Nya')
  await expect(table(page)).not.toContainText('SK Gamla')

  const reopened = await openTournamentPlayers(page)
  await expect(reopened.getByTestId('data-table')).toContainText('SK Nya')
  await expect(reopened.getByTestId('data-table')).not.toContainText('SK Gamla')
})

test('switching Namnvisning reorders names in Lottning and Ställning', async ({ page }) => {
  await setup(page, { name: 'Namnvisning' })
  await expect(table(page)).toContainText('Anna Svensson')

  await page.getByTestId('menu-bar').getByRole('button', { name: 'Inställningar' }).click()
  await page.getByTestId('menu-dropdown').getByText('Inställningar').click()
  const dialog = page.getByTestId('dialog-overlay')
  await dialog.getByTestId('name-presentation-select').selectOption('LAST_FIRST')
  await dialog.getByRole('button', { name: 'OK' }).click()
  await expect(dialog).not.toBeVisible()

  await expect(table(page)).toContainText('Svensson Anna')
  await openTab(page, 'Ställning')
  await expect(table(page)).toContainText('Svensson Anna')
})

test('deleting every board of the only round clears the round from the status bar and unblocks player removal', async ({
  page,
}) => {
  await setup(page, { name: 'Tomma ronden' })
  await expect(page.getByTestId('status-bar')).toContainText('Rond 1/3')

  // Select both boards (shift-click), then Lotta → Ta bort bord.
  await page.locator('tr[data-board-nr="1"]').first().locator('td').first().click()
  await page
    .locator('tr[data-board-nr="2"]')
    .first()
    .locator('td')
    .first()
    .click({
      modifiers: ['Shift'],
    })
  await expect(page.locator('tr[data-board-nr].selected')).toHaveCount(2)
  page.once('dialog', (d) => d.accept())
  await page.getByTestId('menu-bar').getByRole('button', { name: 'Lotta', exact: true }).click()
  await page.getByTestId('menu-dropdown').getByText('Ta bort bord').click()
  await expect(page.locator('tr[data-board-nr]')).toHaveCount(0)

  await expect(page.getByTestId('status-bar')).not.toContainText('Rond 1/3')

  const dialog = await openTournamentPlayers(page)
  await dialog.getByTestId('data-table').locator('tbody tr').first().click()
  await expect(dialog.getByTestId('remove-player')).toBeEnabled()
})

test('swapping colours with Editera bord updates Ställning', async ({ page }) => {
  const { tid, $, round } = await setup(page, { name: 'Färgbyte' })
  const board1 = round.games.find((g: { boardNr: number }) => g.boardNr === 1)
  const white = board1.whitePlayer
  const black = board1.blackPlayer
  await $.put(`/api/tournaments/${tid}/rounds/1/games/1/result`, { resultType: 'WHITE_WIN' })
  await page.reload()
  await waitForApi(page)
  await selectTournament(page, 'Färgbyte')

  // The selection survives a tab switch, so Ställning stays mounted while the
  // board is edited.
  await page.locator('tr[data-board-nr="1"]').first().locator('td').first().click()
  await openTab(page, 'Ställning')
  const leader = table(page).locator('tbody tr').first()
  await expect(leader).toContainText(white.name)

  await page.getByTestId('menu-bar').getByRole('button', { name: 'Lotta', exact: true }).click()
  await page.getByTestId('menu-dropdown').getByText('Editera bord').click()
  const dialog = page.getByTestId('dialog-overlay')
  const [whiteSelect, blackSelect] = [
    dialog.locator('select').nth(0),
    dialog.locator('select').nth(1),
  ]
  await blackSelect.selectOption('')
  await whiteSelect.selectOption({ label: black.name })
  await blackSelect.selectOption({ label: white.name })
  await dialog.getByRole('button', { name: 'Ok' }).click()
  await expect(dialog).not.toBeVisible()

  await expect(leader).toContainText(black.name)
})

test('changing a Schack4an class size updates Schack4an-ställning', async ({ page }) => {
  await setup(page, {
    name: 'Klasstorlek',
    chess4: true,
    clubs: [
      { name: 'Klass 4A', chess4Members: 20 },
      { name: 'Klass 4B', chess4Members: 20 },
    ],
  })
  await openTab(page, 'Schack4an ställning')
  const row = table(page).locator('tbody tr', { hasText: 'Klass 4A' })
  await expect(row).toContainText('20')

  await openTab(page, 'Schack4an inställningar klasstorlek')
  const input = table(page).locator('tbody tr', { hasText: 'Klass 4A' }).locator('input')
  await input.fill('25')
  await input.press('Enter')

  await openTab(page, 'Schack4an ställning')
  await expect(row.locator('td').nth(3)).toHaveText('25')
})
