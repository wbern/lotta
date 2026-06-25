/**
 * TDD bug spec — "silent save failure" family, Tournament Players dialog.
 * RED today; the handlers pass only onSuccess. Note the sibling handler in the
 * SAME file (handleUpdate, TournamentPlayersDialog.tsx:202) ALREADY shows
 * showToast({ message: sv.player.saveFailed }) on error — so the expected
 * feedback (and message "Kunde inte spara ändringarna.") is established here.
 *
 * Handlers missing onError: handleAdd:181, handleAddFromPool:215, handleRemove:227.
 */

import { apiClient, createTournament, waitForApi } from './api-helpers'
import { expect, test } from './fixtures'
import {
  armStorageFailure,
  dismissStorageWarning,
  expectSaveFailureFeedback,
  installStorageFailure,
} from './storage-failure'

async function openTournamentPlayers(page: import('@playwright/test').Page) {
  await dismissStorageWarning(page)
  await page.getByTestId('menu-bar').getByRole('button', { name: 'Spelare' }).click()
  await page
    .getByTestId('menu-dropdown')
    .getByRole('button', { name: 'Turneringsspelare', exact: true })
    .click()
  const dialog = page.getByTestId('dialog-overlay')
  await expect(dialog).toBeVisible()
  return dialog
}

test('adding a new tournament player gives feedback when the save fails', async ({ page }) => {
  await installStorageFailure(page)
  await page.goto('/')
  await waitForApi(page)

  const { tid } = await createTournament(
    apiClient(page),
    { name: 'TP-add', group: 'A', pairingSystem: 'Monrad', nrOfRounds: 5 },
    [],
  )
  await page.goto(`/?tournamentId=${tid}`)

  const dialog = await openTournamentPlayers(page)
  await dialog.getByRole('button', { name: 'Skapa eller editera spelare' }).click()
  await dialog.getByTestId('first-name-input').fill('Ny')
  await dialog.getByTestId('last-name-input').fill('Turneringsspelare')

  await armStorageFailure(page)
  await dialog.getByTestId('add-player').click()

  await expectSaveFailureFeedback(page)
})

test('adding players from the pool gives feedback when the save fails', async ({ page }) => {
  await installStorageFailure(page)
  await page.goto('/')
  await waitForApi(page)
  const $ = apiClient(page)

  // Tournament with one player + an extra pool-only player that stays "available".
  const { tid } = await createTournament(
    $,
    { name: 'TP-pool', group: 'A', pairingSystem: 'Monrad', nrOfRounds: 5 },
    [{ firstName: 'Med', lastName: 'Iturnering' }],
  )
  await $.post('/api/players', {
    firstName: 'Pool',
    lastName: 'Tillgänglig',
    ratingI: 0,
    clubIndex: 0,
    federation: 'SWE',
    withdrawnFromRound: -1,
    manualTiebreak: 0,
  })
  await page.goto(`/?tournamentId=${tid}`)

  const dialog = await openTournamentPlayers(page)
  await dialog.getByRole('button', { name: 'Spelarpool', exact: true }).click()
  await dialog.getByTestId('data-table').locator('tbody tr').first().click()

  // The irrelevant storage-warning toast can overlap this footer button; by now
  // it has appeared, so dismiss it before clicking.
  await dismissStorageWarning(page)
  await armStorageFailure(page)
  await dialog.getByTestId('add-from-pool').click()

  await expectSaveFailureFeedback(page)
})

test('removing a tournament player gives feedback when the save fails', async ({ page }) => {
  await installStorageFailure(page)
  await page.goto('/')
  await waitForApi(page)

  // Draft tournament (no rounds paired) so the remove button is enabled.
  const { tid } = await createTournament(
    apiClient(page),
    { name: 'TP-remove', group: 'A', pairingSystem: 'Monrad', nrOfRounds: 5 },
    [
      { firstName: 'En', lastName: 'Spelare' },
      { firstName: 'Två', lastName: 'Spelare' },
    ],
  )
  await page.goto(`/?tournamentId=${tid}`)

  const dialog = await openTournamentPlayers(page)
  await dialog.getByTestId('data-table').locator('tbody tr').first().click()

  await armStorageFailure(page)
  await dialog.getByTestId('remove-player').click()

  await expectSaveFailureFeedback(page)
})
