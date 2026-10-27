import { waitForApi } from './api-helpers'
import { expect, test } from './fixtures'

test.describe('Vad är nytt dialog', () => {
  test('opens from Hjälp menu and renders changelog entries', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)

    await page.getByTestId('menu-bar').getByRole('button', { name: 'Hjälp' }).click()
    await page.waitForTimeout(400)
    await page.getByTestId('menu-dropdown').getByText('Vad är nytt').click()
    await page.waitForTimeout(500)

    await expect(page.getByTestId('dialog-title').filter({ hasText: 'Vad är nytt' })).toBeVisible()
    // Only releases newer than the running version are listed. When HEAD is the
    // latest tag there are none, which is a valid state, not an empty dialog.
    await expect(
      page
        .getByTestId('changelog-group')
        .first()
        .or(page.getByText('Inga nya ändringar sedan din version.')),
    ).toBeVisible()
  })

  test('reveals older entries when clicking "Visa tidigare versioner"', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)

    await page.getByTestId('menu-bar').getByRole('button', { name: 'Hjälp' }).click()
    await page.waitForTimeout(400)
    await page.getByTestId('menu-dropdown').getByText('Vad är nytt').click()
    await page.waitForTimeout(500)

    await expect(page.getByTestId('dialog-title').filter({ hasText: 'Vad är nytt' })).toBeVisible()

    const expandLink = page.getByRole('button', { name: 'Visa tidigare versioner' })
    await expect(expandLink).toBeVisible()
    const initialCount = await page.getByTestId('changelog-group').count()
    await expandLink.click()

    await expect
      .poll(() => page.getByTestId('changelog-group').count())
      .toBeGreaterThan(initialCount)
    await expect(expandLink).toBeHidden()

    await page.waitForTimeout(1500)
  })

  test('checks for updates via Hjälp menu and shows status', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)

    await page.getByTestId('menu-bar').getByRole('button', { name: 'Hjälp' }).click()
    await page.waitForTimeout(400)
    await page.getByTestId('menu-dropdown').getByText('Sök efter uppdateringar').click()
    await page.waitForTimeout(500)

    // The update check reports through toasts (a3c25a7), not a dialog. The dev
    // server registers no service worker, so this is the expected outcome here.
    await expect(
      page.getByTestId('toast').filter({ hasText: 'Ingen uppdateringstjänst registrerad ännu.' }),
    ).toBeVisible()
  })
})
