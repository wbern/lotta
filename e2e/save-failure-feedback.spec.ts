/**
 * TDD bug spec — the "silent save failure" family (siblings of the create-tournament
 * bug in create-tournament-save-no-feedback.spec.ts).
 *
 * Root pattern: every DB write goes through withSave() (src/api/service-provider.ts),
 * which does the in-memory op then `await getDatabaseService().save()` ->
 * saveDatabase() -> IndexedDB put(). On a locked-down / out-of-quota browser the
 * put() throws and the mutation REJECTS. Many mutation call sites pass only an
 * onSuccess handler (no onError, no try/catch), so the user gets ZERO feedback —
 * the action silently does nothing. An audit found 16+ such actions; this spec
 * covers a representative few of the most-used ones.
 *
 * Each test forces an IndexedDB write failure and asserts the user is told the
 * save failed. They are RED today and go green once each handler surfaces the
 * error. Selectors for the expected feedback:
 *   - TournamentDialog already has data-testid="tournament-save-error"
 *   - the app has a toast system (data-testid="toast") used by sibling handlers
 *     (e.g. TournamentPlayersDialog.handleUpdate already shows sv.player.saveFailed)
 *
 * Audit summary (file:line, all missing onError/try-catch on the withSave path):
 *   PairingsTab.tsx:122 (enter/change result — toast is gated on ResultConflictError
 *     only, so a generic save failure shows nothing), TournamentDialog.tsx:276/278
 *     (update/create), SettingsDialog.tsx:48 (settings), AppLayout.tsx:175 (delete
 *     tournament), useUndo.ts:30-49 (undo/redo/restore), PlayerPoolDialog.tsx:113/129/141
 *     (pool add/update/delete), TournamentPlayersDialog.tsx:181/215/227 (add/remove),
 *     Chess4SetupTab.tsx:58 (member count), club rename/delete ×2.
 */

import { apiClient, seedHeroTournament, waitForApi } from './api-helpers'
import { expect, test } from './fixtures'
import { selectTournament } from './helpers'
import {
  armStorageFailure,
  expectSaveFailureFeedback,
  installStorageFailure,
} from './storage-failure'

test('editing a tournament gives feedback when the save fails', async ({ page }) => {
  await installStorageFailure(page)
  await page.goto('/')
  await waitForApi(page)

  // Create a tournament to edit (writes succeed — failure not armed yet).
  const $ = apiClient(page)
  const created: { id: number } = await $.post('/api/tournaments', {
    name: 'Redigera-spara-fel',
    group: 'A',
    pairingSystem: 'Monrad',
    initialPairing: 'Rating',
    nrOfRounds: 5,
    barredPairing: false,
    compensateWeakPlayerPP: false,
    pointsPerGame: 1,
    chess4: false,
    ratingChoice: 'ELO',
    showELO: true,
    showGroup: false,
    federation: 'SWE',
    selectedTiebreaks: [],
  })

  await page.goto(`/?tournamentId=${created.id}`)
  await page.getByTestId('menu-bar').getByRole('button', { name: 'Turnering' }).click()
  await page.getByTestId('menu-dropdown').getByText('Editera').click()
  const dialog = page.getByTestId('dialog-overlay')
  await expect(dialog).toBeVisible()

  await dialog.getByTestId('tournament-name-input').fill('Nytt namn')
  await armStorageFailure(page)
  await dialog.getByRole('button', { name: 'Spara' }).click()

  // Expected: the user is told the change could not be saved, via the shared
  // save-failure surface (ADR-0001).
  await expectSaveFailureFeedback(page)
})

test('saving settings gives feedback when the save fails', async ({ page }) => {
  await installStorageFailure(page)
  await page.goto('/')

  await page.getByTestId('menu-bar').getByRole('button', { name: 'Inställningar' }).click()
  await page.getByTestId('menu-dropdown').getByText('Inställningar').click()
  const dialog = page.getByTestId('dialog-overlay')
  await expect(dialog).toBeVisible()

  // Change a setting so there is something to persist.
  await dialog.getByTestId('name-presentation-select').selectOption({ index: 1 })

  await armStorageFailure(page)
  await dialog.getByRole('button', { name: 'OK' }).click()

  // Expected: feedback that the settings could not be saved. Today the dialog
  // just stays open silently (no onError, no error UI in SettingsDialog).
  await expectSaveFailureFeedback(page)
})

test('entering a result gives feedback when the save fails', async ({ page }) => {
  await installStorageFailure(page)
  await page.goto('/')
  await seedHeroTournament(page)
  await page.goto('/')
  // selectTournament resolves the round state so the result mutation has a round.
  await selectTournament(page, 'Hjälteturneringen 2025')

  // Focus + select board 1 (which has a scored result), then clear it with the
  // Space keybind — a real write that differs from the current result.
  const row = page.locator('tr[data-board-nr="1"]').first()
  await row.click()
  await armStorageFailure(page)
  await page.keyboard.press(' ')

  // Expected: a toast tells the user the result could not be saved. Today the
  // result-entry path only toasts on ResultConflictError, so a storage failure
  // is completely silent.
  await expectSaveFailureFeedback(page)
})
