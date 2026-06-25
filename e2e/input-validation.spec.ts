/**
 * TDD acceptance spec for ADR-0003 — domain invariants must be enforced at the
 * boundary, so invalid values can't be persisted from any entry path. These two
 * cases (0 rounds, blank-name player) reach persistence unguarded today.
 * (The sibling pointsPerGame=0 case lives in schack4an-coupling-edge-cases.spec.ts.)
 */

import { apiClient, waitForApi } from './api-helpers'
import { expect, test } from './fixtures'

test('cannot create a tournament with 0 rounds', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('menu-bar').getByRole('button', { name: 'Turnering' }).click()
  await page.getByTestId('menu-dropdown').getByText('Ny').click()
  const dialog = page.getByTestId('dialog-overlay')
  await expect(dialog).toBeVisible()

  await dialog.getByTestId('tournament-name-input').fill('Noll-ronder')
  await dialog.getByTestId('tournament-group-input').fill('A')
  await dialog.getByTestId('tournament-nr-of-rounds-input').fill('0')

  await dialog.getByRole('button', { name: 'Spara' }).click()

  // Expected: creation blocked (0 rounds bricks the tournament). Today it persists.
  await waitForApi(page)
  const tournaments: { name: string }[] = await apiClient(page).get('/api/tournaments')
  expect(tournaments.find((t) => t.name === 'Noll-ronder')).toBeFalsy()
})

test('cannot add a player with a blank name', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('menu-bar').getByRole('button', { name: 'Spelare' }).click()
  await page
    .getByTestId('menu-dropdown')
    .getByRole('button', { name: 'Spelarpool', exact: true })
    .click()
  const dialog = page.getByTestId('dialog-overlay')
  await expect(dialog).toBeVisible()

  await dialog.getByRole('button', { name: 'Skapa eller editera spelare' }).click()
  // A single space is truthy, so today it passes the `firstName || lastName` guard
  // (which doesn't .trim()) and a blank player is created.
  await dialog.getByTestId('first-name-input').fill('   ')
  await dialog.getByTestId('pool-add-player').click()

  // Expected: the blank name is rejected with a validation message.
  await expect(dialog.getByTestId('name-error')).toBeVisible()
})
