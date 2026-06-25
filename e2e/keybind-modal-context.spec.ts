/**
 * TDD acceptance spec for ADR-0005 — global keyboard handlers must be modal-aware.
 * The PairingsTab result/Delete keybinds guard only on document.activeElement
 * being a board row, and the Dialog does no focus management — so opening an edit
 * dialog by double-clicking a row leaves the row focused, and a result key then
 * mutates the board hidden behind the dialog.
 */

import { seedHeroTournament } from './api-helpers'
import { expect, test } from './fixtures'
import { selectTournament } from './helpers'

test('result keybinds do not fire while an edit dialog is open over the board', async ({
  page,
}) => {
  await page.goto('/')
  await seedHeroTournament(page)
  await page.goto('/')
  await selectTournament(page, 'Hjälteturneringen 2025')

  const result = page.getByTestId('result-dropdown-1')
  const before = (await result.textContent())?.trim()

  // Select + focus board 1, then double-click to open the board editor dialog
  // (which does not move focus away from the row).
  const row = page.locator('tr[data-board-nr="1"]').first()
  await row.click()
  await row.dblclick()
  await expect(page.getByTestId('dialog-overlay')).toBeVisible()

  // Space = "no result" keybind; it would clear the board behind the dialog.
  await page.keyboard.press(' ')
  // Give any (erroneous) mutation time to land.
  await page.waitForTimeout(700)

  const after = (await result.textContent())?.trim()
  // Expected: the underlying board result is unchanged while a modal is open.
  expect(after).toBe(before)
})
