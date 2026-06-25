/**
 * TDD bug spec — "silent save failure" family, Player Pool dialog actions.
 * Each test forces an IndexedDB write failure and asserts the user is told the
 * save failed. RED today (the handlers in PlayerPoolDialog.tsx pass only
 * onSuccess, no onError); green once each surfaces feedback (the app convention
 * is a toast, e.g. sv.player.saveFailed = "Kunde inte spara ändringarna.").
 *
 * Handlers (all missing onError): PlayerPoolDialog.tsx handleAdd:113,
 * handleUpdate:129, handleDelete:141, onRenameClub:237, onDeleteClub:238.
 */

import { apiClient, ensureClubs, seedHeroTournament, waitForApi } from './api-helpers'
import { expect, test } from './fixtures'
import {
  armStorageFailure,
  expectSaveFailureFeedback,
  installStorageFailure,
} from './storage-failure'

async function openPlayerPool(page: import('@playwright/test').Page) {
  await page.getByTestId('menu-bar').getByRole('button', { name: 'Spelare' }).click()
  await page
    .getByTestId('menu-dropdown')
    .getByRole('button', { name: 'Spelarpool', exact: true })
    .click()
  const dialog = page.getByTestId('dialog-overlay')
  await expect(dialog).toBeVisible()
  return dialog
}

test('adding a pool player gives feedback when the save fails', async ({ page }) => {
  await installStorageFailure(page)
  await page.goto('/')

  const dialog = await openPlayerPool(page)
  await dialog.getByRole('button', { name: 'Skapa eller editera spelare' }).click()
  await dialog.getByTestId('first-name-input').fill('Test')
  await dialog.getByTestId('last-name-input').fill('Spelare')

  await armStorageFailure(page)
  await dialog.getByTestId('pool-add-player').click()

  await expectSaveFailureFeedback(page)
})

test('updating a pool player gives feedback when the save fails', async ({ page }) => {
  await installStorageFailure(page)
  await page.goto('/')
  await seedHeroTournament(page)
  await page.goto('/')

  const dialog = await openPlayerPool(page)
  await dialog.getByTestId('data-table').locator('tbody tr').first().click()
  await dialog.getByRole('button', { name: 'Editera', exact: true }).click()
  await dialog.getByTestId('first-name-input').fill('ÄndratNamn')

  await armStorageFailure(page)
  await dialog.getByTestId('update-player').click()

  await expectSaveFailureFeedback(page)
})

test('deleting a pool player gives feedback when the save fails', async ({ page }) => {
  await installStorageFailure(page)
  await page.goto('/')
  await seedHeroTournament(page)
  await page.goto('/')

  const dialog = await openPlayerPool(page)
  await dialog.getByTestId('data-table').locator('tbody tr').first().click()

  await armStorageFailure(page)
  await dialog.getByTestId('delete-from-pool').click()

  await expectSaveFailureFeedback(page)
})

test('renaming a club gives feedback when the save fails', async ({ page }) => {
  await installStorageFailure(page)
  await page.goto('/')
  await seedHeroTournament(page)
  await page.goto('/')

  const dialog = await openPlayerPool(page)
  await dialog.getByTestId('data-table').locator('tbody tr').first().click()
  await dialog.getByRole('button', { name: 'Editera', exact: true }).click()

  // Club rename is a native prompt(); answer it, then arm and click the
  // club-rename button.
  page.once('dialog', (d) => d.accept('Nytt Klubbnamn'))
  await armStorageFailure(page)
  await dialog.getByTestId('club-rename').click()

  await expectSaveFailureFeedback(page)
})

test('deleting a club gives feedback when the save fails', async ({ page }) => {
  await installStorageFailure(page)
  await page.goto('/')
  await waitForApi(page)
  // An empty club (no members) so the delete itself succeeds in-memory and the
  // failure is the SAVE — not a foreign-key integrity error (that is ADR-0003).
  await ensureClubs(apiClient(page), [{ name: 'Tom Klubb' }])
  await seedHeroTournament(page)
  await page.goto('/')

  const dialog = await openPlayerPool(page)
  await dialog.getByTestId('data-table').locator('tbody tr').first().click()
  await dialog.getByRole('button', { name: 'Editera', exact: true }).click()
  // Point the club selector at the empty club, then delete that one.
  await dialog.getByTestId('club-select').selectOption({ label: 'Tom Klubb' })

  // Club delete is a native confirm(); accept it, then arm and click club-delete.
  page.once('dialog', (d) => d.accept())
  await armStorageFailure(page)
  await dialog.getByTestId('club-delete').click()

  await expectSaveFailureFeedback(page)
})
