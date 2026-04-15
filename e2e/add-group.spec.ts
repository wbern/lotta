import { expect, test } from './fixtures'

async function createTournament(
  page: import('@playwright/test').Page,
  name: string,
  group: string,
) {
  await page.getByTestId('menu-bar').getByRole('button', { name: 'Turnering' }).click()
  await page.getByTestId('menu-dropdown').getByText('Ny').click()
  const dialog = page.getByTestId('dialog-overlay')
  await dialog.getByTestId('tournament-name-input').fill(name)
  await dialog.getByTestId('tournament-group-input').fill(group)
  await dialog.getByRole('button', { name: 'Spara' }).click()
  await expect(dialog).not.toBeVisible()
}

test.describe('Add group menu flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('"Lägg till grupp" is disabled when no tournament exists', async ({ page }) => {
    await page.getByTestId('menu-bar').getByRole('button', { name: 'Turnering' }).click()
    const addGroupBtn = page
      .getByTestId('menu-dropdown')
      .getByRole('button', { name: 'Lägg till grupp' })
    await expect(addGroupBtn).toBeDisabled()
  })

  test('opens AddGroupDialog preselected to current tournament, then spawns TournamentDialog prefilled with name', async ({
    page,
  }) => {
    await createTournament(page, 'Vårspelen 2026', 'Grupp A')

    await page.getByTestId('menu-bar').getByRole('button', { name: 'Turnering' }).click()
    await page.getByTestId('menu-dropdown').getByRole('button', { name: 'Lägg till grupp' }).click()

    const addGroupDialog = page.getByTestId('dialog-overlay')
    await expect(addGroupDialog.getByTestId('dialog-title')).toHaveText('Lägg till grupp')

    const nameSelect = addGroupDialog.getByTestId('add-group-name-select')
    await expect(nameSelect).toHaveValue('Vårspelen 2026')

    await addGroupDialog.getByTestId('add-group-confirm').click()

    const tournamentDialog = page.getByTestId('dialog-overlay')
    await expect(tournamentDialog.getByTestId('dialog-title')).toHaveText('Turneringsinställningar')
    await expect(tournamentDialog.getByTestId('tournament-name-input')).toHaveValue(
      'Vårspelen 2026',
    )
    await expect(tournamentDialog.getByTestId('tournament-group-input')).toHaveValue('')
  })

  test('copies settings from selected preset tournament', async ({ page }) => {
    await createTournament(page, 'Vårspelen 2026', 'Grupp A')

    // Create a chess4 tournament to serve as a preset source
    await page.getByTestId('menu-bar').getByRole('button', { name: 'Turnering' }).click()
    await page.getByTestId('menu-dropdown').getByText('Ny').click()
    const newDialog = page.getByTestId('dialog-overlay')
    await newDialog.getByTestId('tournament-name-input').fill('Schack4an 2026')
    await newDialog.getByTestId('tournament-group-input').fill('Öppen')
    await newDialog.getByTestId('tournament-point-system-select').selectOption('schack4an')
    await newDialog.getByRole('button', { name: 'Spara' }).click()
    await expect(newDialog).not.toBeVisible()

    // Open add-group and select the chess4 tournament as preset
    await page.getByTestId('menu-bar').getByRole('button', { name: 'Turnering' }).click()
    await page.getByTestId('menu-dropdown').getByRole('button', { name: 'Lägg till grupp' }).click()

    const addGroupDialog = page.getByTestId('dialog-overlay')
    await addGroupDialog.getByTestId('add-group-name-select').selectOption('Vårspelen 2026')
    await addGroupDialog
      .getByTestId('add-group-preset-select')
      .selectOption({ label: 'Schack4an 2026 / Öppen' })
    await addGroupDialog.getByTestId('add-group-confirm').click()

    const tournamentDialog = page.getByTestId('dialog-overlay')
    await expect(tournamentDialog.getByTestId('tournament-name-input')).toHaveValue(
      'Vårspelen 2026',
    )
    await expect(tournamentDialog.getByTestId('tournament-group-input')).toHaveValue('')
    await expect(tournamentDialog.getByTestId('tournament-point-system-select')).toHaveValue(
      'schack4an',
    )
  })

  test('Avbryt in AddGroupDialog closes without opening TournamentDialog', async ({ page }) => {
    await createTournament(page, 'Vårspelen 2026', 'Grupp A')

    await page.getByTestId('menu-bar').getByRole('button', { name: 'Turnering' }).click()
    await page.getByTestId('menu-dropdown').getByRole('button', { name: 'Lägg till grupp' }).click()

    const addGroupDialog = page.getByTestId('dialog-overlay')
    await expect(addGroupDialog.getByTestId('dialog-title')).toHaveText('Lägg till grupp')

    await addGroupDialog.getByRole('button', { name: 'Avbryt' }).click()

    await expect(page.getByTestId('dialog-overlay')).not.toBeVisible()
  })
})
