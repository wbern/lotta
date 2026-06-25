/**
 * TDD bug spec (user report, 2026-06-25):
 *
 *   "Och igår när jag skulle trycka på Spara eller Skapa-knappen ... efter att
 *    ha gjort en ny turnering så hände det inget. Alltså gick det inte att skapa
 *    en ny turnering, så vi fick köra på vanliga Lotta istället.
 *    Jag körde på jobbdatorn (någon Dell-grej)."
 *
 * Pressing Spara appeared to do nothing — no tournament, no feedback — on a
 * locked-down work machine. The happy path works on a normal machine, so the
 * symptom is a save that cannot complete while the UI stays silent.
 *
 * Root cause: src/components/dialogs/TournamentDialog.tsx handleSave() does
 *   createMutation.mutate(form, { onSuccess: ... })   // <-- no onError
 * When api.createTournament() rejects (withSave() -> saveDatabase() ->
 * IndexedDB put() throws, e.g. blocked storage / out of quota) the dialog just
 * sits there with zero feedback.
 *
 * Expected behaviour: when the save fails, the user must be told it failed.
 * This test asserts that, so it FAILS against today's code (red). It goes green
 * once handleSave surfaces the error (e.g. via the existing
 * data-testid="tournament-save-error" line, or an equivalent message).
 */

import { expect, test } from './fixtures'
import {
  armStorageFailure,
  expectSaveFailureFeedback,
  installStorageFailure,
} from './storage-failure'

test.describe('Creating a tournament gives feedback when the save fails', () => {
  test('a failed storage write surfaces an error to the user', async ({ page }) => {
    // Simulate a locked-down / out-of-quota browser store: make IndexedDB
    // writes throw (gated so boot + DB load are unaffected; we arm it just
    // before the create save).
    await installStorageFailure(page)

    await page.goto('/')
    await page.getByTestId('menu-bar').getByRole('button', { name: 'Turnering' }).click()
    await page.getByTestId('menu-dropdown').getByText('Ny').click()
    const dialog = page.getByTestId('dialog-overlay')
    await expect(dialog).toBeVisible()

    // Fill BOTH required fields — validation passes, so this is the real
    // "I filled everything in and pressed Spara" scenario.
    await dialog.getByTestId('tournament-name-input').fill('Jobb-turneringen')
    await dialog.getByTestId('tournament-group-input').fill('A')

    await armStorageFailure(page)

    await dialog.getByRole('button', { name: 'Spara' }).click()

    // Expected: the user is told the tournament could not be saved, via the shared
    // save-failure surface (ADR-0001). The dialog stays open so the work isn't lost.
    await expectSaveFailureFeedback(page)
    await expect(dialog).toBeVisible()
  })
})
