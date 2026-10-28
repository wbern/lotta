/* eslint local/no-class-locators: "off" -- structural traversal (.timeline-*) */

import {
  apiClient,
  clearUndoHistory,
  createTournament,
  type PlayerInput,
  waitForApi,
} from './api-helpers'
import { expect, test } from './fixtures'

const PLAYERS: PlayerInput[] = [
  { lastName: 'Andersson', firstName: 'Anna', ratingI: 1800 },
  { lastName: 'Bergström', firstName: 'Bo', ratingI: 1700 },
]

const RESTORE_MESSAGE =
  'Återställning ersätter ALLA turneringar, spelare och resultat i den här webbläsaren med innehållet i filen. Ta en säkerhetskopia först om du är osäker. Återställningen kan ångras via Redigera → Historik.'

async function tournamentNames(page: import('@playwright/test').Page): Promise<string[]> {
  const list: { name: string }[] = await apiClient(page).get('/api/tournaments')
  return list.map((t) => t.name)
}

test.describe('Återställ databas', () => {
  test('given a backup file, when the arbiter restores it through the warning, then the data comes back and Ctrl+Z undoes the restore', async ({
    page,
  }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)

    // Backup contains "Säkerhetskopierad"; the live data afterwards only "Nuvarande".
    const { tid } = await createTournament(
      $,
      { name: 'Säkerhetskopierad', pairingSystem: 'Monrad', nrOfRounds: 3 },
      PLAYERS,
    )
    const backupBytes: number[] = await page.evaluate(() =>
      Array.from(
        (
          window as unknown as { __lottaApi: { exportDbBytes(): Uint8Array } }
        ).__lottaApi.exportDbBytes(),
      ),
    )
    await $.del(`/api/tournaments/${tid}`)
    await createTournament(
      $,
      { name: 'Nuvarande', pairingSystem: 'Monrad', nrOfRounds: 3 },
      PLAYERS,
    )

    await page.reload()
    await waitForApi(page)
    await clearUndoHistory(apiClient(page))
    expect(await tournamentNames(page)).toEqual(['Nuvarande'])

    let fileChoosers = 0
    page.on('filechooser', () => {
      fileChoosers++
    })

    await test.step('the menu item shows the warning before any file picker', async () => {
      await page.getByTestId('menu-bar').getByRole('button', { name: 'Inställningar' }).click()
      await page.getByTestId('menu-dropdown').getByText('Återställ databas').click()

      await expect(page.getByTestId('dialog-title')).toHaveText('Återställ databas')
      await expect(page.getByText(RESTORE_MESSAGE)).toBeVisible()
      await expect(page.getByRole('button', { name: 'Välj fil…' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Avbryt' })).toBeVisible()
      expect(fileChoosers).toBe(0)
    })

    await test.step('Välj fil… opens the picker and the backup is restored', async () => {
      const chooserPromise = page.waitForEvent('filechooser')
      await page.getByRole('button', { name: 'Välj fil…' }).click()
      const chooser = await chooserPromise
      await chooser.setFiles({
        name: 'lotta-backup.sqlite',
        mimeType: 'application/x-sqlite3',
        buffer: Buffer.from(backupBytes),
      })

      await expect(page.getByTestId('dialog-title')).toHaveCount(0)
      await expect.poll(() => tournamentNames(page)).toEqual(['Säkerhetskopierad'])
      await expect(
        page.getByTestId('tournament-selector').locator('select').first().locator('option', {
          hasText: 'Säkerhetskopierad',
        }),
      ).toHaveCount(1)
    })

    await test.step('Historik shows the restore on top of the pre-restore snapshot', async () => {
      await page.getByTestId('menu-bar').getByRole('button', { name: 'Redigera' }).click()
      await page.getByTestId('menu-dropdown').getByText('Historik...').click()

      const labels = page.locator('.timeline-label')
      await expect(labels.nth(0)).toHaveText('Återställ databas')
      await expect(labels.nth(1)).toHaveText('Före återställning')
      await expect(page.locator('.timeline-detail').nth(0)).toHaveText('lotta-backup.sqlite')

      await page.locator('.timeline-close').click()
      await expect(page.locator('.timeline-panel')).not.toBeVisible()
    })

    await test.step('Ctrl+Z returns to the data from before the restore', async () => {
      await page.keyboard.press('Control+z')

      await expect.poll(() => tournamentNames(page)).toEqual(['Nuvarande'])
      await expect(
        page.getByTestId('tournament-selector').locator('select').first().locator('option', {
          hasText: 'Nuvarande',
        }),
      ).toHaveCount(1)
    })
  })

  test('given the restore warning, when the arbiter chooses Avbryt, then no file picker opens and nothing changes', async ({
    page,
  }) => {
    await page.goto('/')
    await waitForApi(page)
    await createTournament(
      apiClient(page),
      { name: 'Orörd', pairingSystem: 'Monrad', nrOfRounds: 3 },
      PLAYERS,
    )
    await page.reload()
    await waitForApi(page)

    let fileChoosers = 0
    page.on('filechooser', () => {
      fileChoosers++
    })

    await page.getByTestId('menu-bar').getByRole('button', { name: 'Inställningar' }).click()
    await page.getByTestId('menu-dropdown').getByText('Återställ databas').click()
    await page.getByRole('button', { name: 'Avbryt' }).click()

    await expect(page.getByTestId('dialog-title')).toHaveCount(0)
    expect(fileChoosers).toBe(0)
    expect(await tournamentNames(page)).toEqual(['Orörd'])
  })
})
