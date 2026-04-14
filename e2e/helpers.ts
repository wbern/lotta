import { expect, type Page } from '@playwright/test'

/**
 * Wait for tournaments to load in the dropdown, then select one by name.
 * Waits for the option to appear before selecting (API data must load first).
 */
export async function selectTournament(page: Page, name: string) {
  const sel = page.getByTestId('tournament-selector').locator('select').first()
  await sel.locator('option', { hasText: name }).waitFor({ state: 'attached' })
  await sel.selectOption(name)
  await expect(page.getByTestId('data-table')).toBeVisible()
}

/**
 * Wait for tournaments to load — useful when you need the dropdown populated
 * but don't want to select a specific tournament.
 */
export async function waitForTournaments(page: Page) {
  const sel = page.getByTestId('tournament-selector').locator('select').first()
  // Wait until more than just the "---" default option exists
  await expect(sel.locator('option')).not.toHaveCount(1)
}
