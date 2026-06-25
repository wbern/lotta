/**
 * TDD bug spec (user report, 2026-06-25):
 *
 *   "Om man väljer schackfyrans poängsystem klickas automatiskt rutan
 *    'detta är en Schackfyran-tävling' i och alla inställningar låser sig.
 *    Jag vill kunna ha 3-2-1-systemet utan att det ska behöva vara en
 *    schackfyran-tävling."
 *
 * Expected behaviour: choosing the 3-2-1 point system from the Poängsystem
 * dropdown should set ONLY the scoring. It must NOT auto-enable "schack4an"
 * mode and must NOT disable the other pairing settings. Being a Schackfyran
 * tournament is a separate decision (the "Detta är en schack4an-tävling"
 * checkbox).
 *
 * Acceptance spec for ADR-0006 (scoring system is independent of the Schackfyran
 * format). The decision is settled: any scoring — including 3-2-1 — is selectable
 * without the tournament being a Schackfyran/chess4 tournament. These tests FAIL
 * against today's code and go green once selecting the 3-2-1 scoring is decoupled
 * from chess4 mode in src/components/dialogs/TournamentDialog.tsx
 * (handlePresetChange -> handleChess4Toggle(true)) and scoring is derived from a
 * config rather than the chess4 boolean in src/domain/scoring.ts.
 *
 * NOTE: this drives the dropdown's 3-2-1 option (current value 'schack4an'). If
 * the implementation renames/splits that option, update the selectOption value
 * below — the assertions (chess4 off, settings editable) stay the same.
 */

import { expect, test } from './fixtures'

test.describe('3-2-1 point system is selectable without becoming a Schackfyran tournament', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('menu-bar').getByRole('button', { name: 'Turnering' }).click()
    await page.getByTestId('menu-dropdown').getByText('Ny').click()
    await expect(page.getByTestId('dialog-overlay')).toBeVisible()
  })

  test('choosing 3-2-1 scoring does NOT auto-enable schack4an mode', async ({ page }) => {
    const dialog = page.getByTestId('dialog-overlay')
    const chess4Checkbox = dialog.getByTestId('tournament-chess4-checkbox')

    await expect(chess4Checkbox).not.toBeChecked()

    await dialog.getByTestId('tournament-point-system-select').selectOption('schack4an')

    // Expected: picking the 3-2-1 scoring leaves "schack4an-tävling" OFF.
    await expect(chess4Checkbox).not.toBeChecked()
  })

  test('choosing 3-2-1 scoring keeps the other pairing settings editable', async ({ page }) => {
    const dialog = page.getByTestId('dialog-overlay')

    await dialog.getByTestId('tournament-point-system-select').selectOption('schack4an')

    // Expected: the user can still choose pairing system, order, rating,
    // tiebreaks and compensate-weak — nothing gets locked by the scoring choice.
    await expect(dialog.getByTestId('tournament-pairing-system-select')).toBeEnabled()
    await expect(dialog.getByTestId('tournament-initial-pairing-select')).toBeEnabled()
    await expect(dialog.getByTestId('tournament-rating-choice-select')).toBeEnabled()
    await expect(dialog.getByTestId('tournament-tiebreak-available-list')).toBeEnabled()
    await expect(dialog.getByTestId('tournament-tiebreak-selected-list')).toBeEnabled()
    await expect(dialog.getByTestId('tournament-compensate-weak-checkbox')).toBeEnabled()
  })
})
