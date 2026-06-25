/**
 * TDD bug spec — edge cases in the Schack4an / chess4 coupling and scoring config
 * (siblings of schack4an-points-locks-settings.spec.ts).
 *
 * These assert the expected behaviour, so they are RED against today's code.
 *
 * 1) EDIT-mode untoggle leaves chess4's forced pairing settings stuck.
 *    src/components/dialogs/TournamentDialog.tsx restores pairing settings from a
 *    `preChess4` snapshot when chess4 is turned off (:233-238). But the EDIT load
 *    effect (:100-171) never seeds `preChess4`, so for an existing chess4
 *    tournament the snapshot is null and unchecking restores nothing — the
 *    pairing system / initial order / tiebreaks stay at Monrad / Slumpad /
 *    SSF Buchholz (the chess4-forced values), which the same untoggle in CREATE
 *    mode would have reset to the non-chess4 defaults. Verified live.
 *
 * 2) Points-per-game accepts invalid values. The "Anpassad" ppg input has only an
 *    HTML min={1} hint and handleSave (:270-285) validates name/group only, so a
 *    tournament can be created with pointsPerGame = 0 (verified: the API/repo
 *    accept it), which makes all result scoring collapse to zero. Creation should
 *    be blocked / flagged.
 */

import { apiClient, waitForApi } from './api-helpers'
import { expect, test } from './fixtures'

test('unchecking schack4an in edit mode restores the non-chess4 defaults', async ({ page }) => {
  await page.goto('/')
  await waitForApi(page)

  // An existing Schack4an tournament (draft — round 1 not yet paired, so editable).
  const $ = apiClient(page)
  const created: { id: number } = await $.post('/api/tournaments', {
    name: 'Schack4an-redigering',
    group: 'A',
    pairingSystem: 'Monrad',
    initialPairing: 'Slumpad',
    nrOfRounds: 7,
    barredPairing: true,
    compensateWeakPlayerPP: false,
    pointsPerGame: 4,
    chess4: true,
    ratingChoice: 'ELO',
    showELO: false,
    showGroup: false,
    federation: 'SWE',
    selectedTiebreaks: ['SSF Buchholz'],
  })

  await page.goto(`/?tournamentId=${created.id}`)
  await page.getByTestId('menu-bar').getByRole('button', { name: 'Turnering' }).click()
  await page.getByTestId('menu-dropdown').getByText('Editera').click()
  const dialog = page.getByTestId('dialog-overlay')
  await expect(dialog).toBeVisible()

  // Turn off "schack4an-tävling".
  await dialog.getByTestId('tournament-chess4-checkbox').uncheck()

  // Expected: pairing settings revert to the app's non-chess4 defaults — exactly
  // as the same untoggle does in CREATE mode — instead of staying stuck on the
  // chess4-forced Monrad / Slumpad / SSF Buchholz.
  await expect(dialog.getByTestId('tournament-pairing-system-select')).toHaveValue(
    'Nordisk Schweizer',
  )
  await expect(dialog.getByTestId('tournament-initial-pairing-select')).toHaveValue('Rating')
  await expect(
    dialog.getByTestId('tournament-tiebreak-selected-list').locator('option'),
  ).toHaveCount(0)
})

test('cannot create a tournament with 0 points per game', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('menu-bar').getByRole('button', { name: 'Turnering' }).click()
  await page.getByTestId('menu-dropdown').getByText('Ny').click()
  const dialog = page.getByTestId('dialog-overlay')
  await expect(dialog).toBeVisible()

  await dialog.getByTestId('tournament-name-input').fill('Noll-poäng')
  await dialog.getByTestId('tournament-group-input').fill('A')

  // Switch to the manual point system and set an invalid points-per-game of 0.
  await dialog.getByTestId('tournament-point-system-select').selectOption('manual')
  await dialog.getByTestId('tournament-points-per-game-input').fill('0')

  await dialog.getByRole('button', { name: 'Spara' }).click()

  // Expected: creation is blocked (invalid scoring) — no such tournament is
  // persisted. Today it is created with pointsPerGame=0 (scoring collapses to 0).
  await waitForApi(page)
  const tournaments: { name: string }[] = await apiClient(page).get('/api/tournaments')
  expect(tournaments.find((t) => t.name === 'Noll-poäng')).toBeFalsy()
})
