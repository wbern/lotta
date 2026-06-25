/**
 * TDD bug spec — "silent save failure" family, menu/action-based writes that have
 * no error feedback. RED today; green once each surfaces feedback.
 *
 * Handlers (no onError / no try-catch on the withSave path):
 *   - delete tournament: AppLayout.tsx confirmDelete (~175)
 *   - undo / redo: AppLayout.tsx (~65-78, promise void'd) + useUndo.ts (~30-49)
 *   - chess4 member count: Chess4SetupTab.tsx saveMembers (~58)
 *   - delete board: AppLayout.tsx handleDeleteBoard (~253, await deleteGame, no catch)
 */

import {
  apiClient,
  createTournament,
  ensureClubs,
  seedHeroTournament,
  waitForApi,
} from './api-helpers'
import { expect, test } from './fixtures'
import { selectTournament } from './helpers'
import {
  armStorageFailure,
  expectSaveFailureFeedback,
  installStorageFailure,
} from './storage-failure'

test('deleting a tournament gives feedback when the save fails', async ({ page }) => {
  await installStorageFailure(page)
  await page.goto('/')
  await waitForApi(page)

  // Unpaired (draft) tournament → delete confirm needs no name-typing.
  const { tid } = await createTournament(
    apiClient(page),
    { name: 'Radera-mig', group: 'A', pairingSystem: 'Monrad', nrOfRounds: 5 },
    [],
  )
  await page.goto(`/?tournamentId=${tid}`)

  await page.getByTestId('menu-bar').getByRole('button', { name: 'Turnering' }).click()
  await page
    .getByTestId('menu-dropdown')
    .getByRole('button', { name: 'Ta bort', exact: true })
    .click()
  const dialog = page.getByTestId('dialog-overlay')
  await expect(dialog).toBeVisible()

  await armStorageFailure(page)
  await dialog.getByRole('button', { name: 'OK' }).click({ force: true })

  await expectSaveFailureFeedback(page)
})

test('undo gives feedback when the save fails', async ({ page }) => {
  await installStorageFailure(page)
  await page.goto('/')
  await seedHeroTournament(page)
  await page.goto('/')
  await selectTournament(page, 'Hjälteturneringen 2025')

  await armStorageFailure(page)
  await page.getByTestId('menu-bar').getByRole('button', { name: 'Redigera' }).click()
  await page.getByTestId('menu-dropdown').getByRole('button', { name: 'Ångra' }).click()

  await expectSaveFailureFeedback(page)
})

test('redo gives feedback when the save fails', async ({ page }) => {
  await installStorageFailure(page)
  await page.goto('/')
  await seedHeroTournament(page)
  await page.goto('/')
  await selectTournament(page, 'Hjälteturneringen 2025')

  // Undo once (storage still healthy) so a redo entry exists.
  await page.getByTestId('menu-bar').getByRole('button', { name: 'Redigera' }).click()
  await page.getByTestId('menu-dropdown').getByRole('button', { name: 'Ångra' }).click()

  // Reopen the menu and wait until "Gör om" is enabled (undo settled).
  await page.getByTestId('menu-bar').getByRole('button', { name: 'Redigera' }).click()
  const redo = page.getByTestId('menu-dropdown').getByRole('button', { name: 'Gör om' })
  await expect(redo).toBeEnabled()

  await armStorageFailure(page)
  await redo.click()

  await expectSaveFailureFeedback(page)
})

test('editing a chess4 club member count gives feedback when the save fails', async ({ page }) => {
  await installStorageFailure(page)
  await page.goto('/')
  await waitForApi(page)
  const $ = apiClient(page)

  const clubIds = await ensureClubs($, [{ name: 'Klubb Alfa' }, { name: 'Klubb Beta' }])
  const { tid } = await createTournament(
    $,
    { name: 'Chess4-medlem', group: 'A', pairingSystem: 'Monrad', nrOfRounds: 5, chess4: true },
    [
      { firstName: 'A', lastName: 'Ett', clubIndex: clubIds[0] },
      { firstName: 'B', lastName: 'Två', clubIndex: clubIds[1] },
    ],
  )
  await page.goto(`/?tournamentId=${tid}&tab=chess4-setup`)

  // Inline member-count edit saves on blur; the value must differ from current.
  const input = page
    .getByTestId('data-table')
    .locator('tbody tr')
    .first()
    .locator('input[type="number"]')
  await input.fill('7')

  await armStorageFailure(page)
  await input.blur()

  await expectSaveFailureFeedback(page)
})

test('deleting a board gives feedback when the save fails', async ({ page }) => {
  await installStorageFailure(page)
  await page.goto('/')
  await seedHeroTournament(page)
  await page.goto('/')
  await selectTournament(page, 'Hjälteturneringen 2025')

  // Select a board, then Lotta → "Ta bort bord" (native confirm()).
  await page.locator('tr[data-board-nr="1"]').first().click()
  await page.getByTestId('menu-bar').getByRole('button', { name: 'Lotta' }).click()
  page.once('dialog', (d) => d.accept())
  await armStorageFailure(page)
  await page.getByTestId('menu-dropdown').getByText('Ta bort bord').click()

  await expectSaveFailureFeedback(page)
})
