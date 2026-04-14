/* eslint local/no-class-locators: "off" -- structural traversal (.timeline-*, .menu-shortcut) */

import {
  type ApiClient,
  apiClient,
  clearUndoHistory,
  createTournament,
  getUndoState,
  type PlayerInput,
  pairRound,
  performRedo,
  performUndo,
  waitForApi,
} from './api-helpers'
import { expect, test } from './fixtures'

const PLAYERS_4: PlayerInput[] = [
  { lastName: 'Andersson', firstName: 'Anna', ratingI: 1800 },
  { lastName: 'Bergström', firstName: 'Bo', ratingI: 1700 },
  { lastName: 'Carlsson', firstName: 'Carin', ratingI: 1600 },
  { lastName: 'Danielsson', firstName: 'David', ratingI: 1500 },
]

let undoTestCounter = 0

/** Create a fresh tournament with a paired round and clean undo history */
async function setupUndoTest($: ApiClient) {
  await clearUndoHistory($)
  undoTestCounter++
  const { tid } = await createTournament(
    $,
    {
      name: `Undo-test-${undoTestCounter}`,
      pairingSystem: 'Monrad',
      nrOfRounds: 3,
    },
    PLAYERS_4,
  )
  const r1 = await pairRound($, tid)
  return { tid, round: r1 }
}

// ── Redigera menu ─────────────────────────────────────────────────────

test.describe('Redigera menu', () => {
  test('Redigera menu button is visible', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const redigera = page.getByTestId('menu-bar').getByRole('button', { name: 'Redigera' })
    await expect(redigera).toBeVisible()
  })

  test('dropdown shows Ångra, Gör om, and Historik', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    await page.getByTestId('menu-bar').getByRole('button', { name: 'Redigera' }).click()
    const dropdown = page.getByTestId('menu-dropdown')
    await expect(dropdown.getByText('Ångra')).toBeVisible()
    await expect(dropdown.getByText('Gör om')).toBeVisible()
    await expect(dropdown.getByText('Historik...')).toBeVisible()
    // Verify keyboard shortcut labels
    await expect(dropdown.locator('.menu-shortcut', { hasText: 'Ctrl+Z' })).toBeVisible()
    await expect(dropdown.locator('.menu-shortcut', { hasText: 'Ctrl+Y' })).toBeVisible()
  })

  test('Ångra and Gör om are disabled when undo stack is empty', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    await clearUndoHistory($)
    await page.getByTestId('menu-bar').getByRole('button', { name: 'Redigera' }).click()
    const dropdown = page.getByTestId('menu-dropdown')
    await expect(dropdown.getByRole('button', { name: /Ångra/ })).toBeDisabled()
    await expect(dropdown.getByRole('button', { name: /Gör om/ })).toBeDisabled()
  })

  test('Ångra becomes enabled after a mutation', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    await setupUndoTest($)
    await page.getByTestId('menu-bar').getByRole('button', { name: 'Redigera' }).click()
    const dropdown = page.getByTestId('menu-dropdown')
    await expect(dropdown.getByRole('button', { name: /Ångra/ })).toBeEnabled()
    await expect(dropdown.getByRole('button', { name: /Gör om/ })).toBeDisabled()
  })

  test('clicking Ångra in menu triggers undo', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const { tid } = await setupUndoTest($)

    // Set a result
    await $.put(`/api/tournaments/${tid}/rounds/1/games/1/result`, {
      resultType: 'WHITE_WIN',
    })

    // Verify it was set
    const r = await $.get(`/api/tournaments/${tid}/rounds/1`)
    expect(r.games[0].resultType).toBe('WHITE_WIN')

    // Click Ångra in menu
    await page.getByTestId('menu-bar').getByRole('button', { name: 'Redigera' }).click()
    await page.getByTestId('menu-dropdown').getByRole('button', { name: /Ångra/ }).click()

    // Poll until the DB restore completes
    await expect
      .poll(async () => {
        const round = await $.get(`/api/tournaments/${tid}/rounds/1`)
        return round.games[0].resultType
      })
      .toBe('NO_RESULT')
  })
})

// ── Undo/Redo via API ────────────────────────────────────────────────

test.describe('Undo/Redo via API', () => {
  test('undo reverts a result change', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const { tid } = await setupUndoTest($)

    await $.put(`/api/tournaments/${tid}/rounds/1/games/1/result`, {
      resultType: 'WHITE_WIN',
    })

    let r = await $.get(`/api/tournaments/${tid}/rounds/1`)
    expect(r.games[0].resultType).toBe('WHITE_WIN')

    const success = await performUndo($)
    expect(success).toBe(true)

    r = await $.get(`/api/tournaments/${tid}/rounds/1`)
    expect(r.games[0].resultType).toBe('NO_RESULT')
  })

  test('redo re-applies the undone change', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const { tid } = await setupUndoTest($)

    await $.put(`/api/tournaments/${tid}/rounds/1/games/1/result`, {
      resultType: 'WHITE_WIN',
    })

    await performUndo($)
    let r = await $.get(`/api/tournaments/${tid}/rounds/1`)
    expect(r.games[0].resultType).toBe('NO_RESULT')

    const success = await performRedo($)
    expect(success).toBe(true)

    r = await $.get(`/api/tournaments/${tid}/rounds/1`)
    expect(r.games[0].resultType).toBe('WHITE_WIN')
  })

  test('multiple undo steps work', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const { tid } = await setupUndoTest($)

    // Set result on board 1
    await $.put(`/api/tournaments/${tid}/rounds/1/games/1/result`, {
      resultType: 'WHITE_WIN',
    })
    // Set result on board 2
    await $.put(`/api/tournaments/${tid}/rounds/1/games/2/result`, {
      resultType: 'BLACK_WIN',
    })

    // Undo board 2 result
    await performUndo($)
    let r = await $.get(`/api/tournaments/${tid}/rounds/1`)
    expect(r.games[1].resultType).toBe('NO_RESULT')
    expect(r.games[0].resultType).toBe('WHITE_WIN')

    // Undo board 1 result
    await performUndo($)
    r = await $.get(`/api/tournaments/${tid}/rounds/1`)
    expect(r.games[0].resultType).toBe('NO_RESULT')
  })

  test('undo returns false when stack is empty', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    await clearUndoHistory($)

    const success = await performUndo($)
    expect(success).toBe(false)

    const state = await getUndoState($)
    expect(state.canUndo).toBe(false)
  })

  test('redo returns false when nothing to redo', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const { tid } = await setupUndoTest($)

    // Make a mutation (no prior undo, so nothing to redo)
    await $.put(`/api/tournaments/${tid}/rounds/1/games/1/result`, {
      resultType: 'WHITE_WIN',
    })

    const success = await performRedo($)
    expect(success).toBe(false)

    const state = await getUndoState($)
    expect(state.canRedo).toBe(false)
  })

  test('new mutation after undo truncates redo history', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const { tid } = await setupUndoTest($)

    // Set result on board 1
    await $.put(`/api/tournaments/${tid}/rounds/1/games/1/result`, {
      resultType: 'WHITE_WIN',
    })

    // Undo it
    await performUndo($)
    let state = await getUndoState($)
    expect(state.canRedo).toBe(true)

    // Make a different mutation (should truncate redo)
    await $.put(`/api/tournaments/${tid}/rounds/1/games/2/result`, {
      resultType: 'BLACK_WIN',
    })

    // Redo should no longer be available
    state = await getUndoState($)
    expect(state.canRedo).toBe(false)

    const success = await performRedo($)
    expect(success).toBe(false)
  })

  test('undo state labels are correct', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const { tid } = await setupUndoTest($)

    await $.put(`/api/tournaments/${tid}/rounds/1/games/1/result`, {
      resultType: 'WHITE_WIN',
    })

    let state = await getUndoState($)
    expect(state.canUndo).toBe(true)
    expect(state.undoLabel).toBe('Ange resultat')

    await performUndo($)

    state = await getUndoState($)
    expect(state.canRedo).toBe(true)
    expect(state.redoLabel).toBe('Ange resultat')
  })

  test('undo history survives page reload', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const { tid } = await setupUndoTest($)

    await $.put(`/api/tournaments/${tid}/rounds/1/games/1/result`, {
      resultType: 'WHITE_WIN',
    })

    let state = await getUndoState($)
    expect(state.canUndo).toBe(true)

    // Reload the page
    await page.reload()
    await waitForApi(page)

    // Re-create apiClient after reload
    const $2 = apiClient(page)
    state = await getUndoState($2)
    expect(state.canUndo).toBe(true)

    // Actually perform undo after reload
    const success = await performUndo($2)
    expect(success).toBe(true)

    const r = await $2.get(`/api/tournaments/${tid}/rounds/1`)
    expect(r.games[0].resultType).toBe('NO_RESULT')
  })
})

// ── Keyboard shortcuts ────────────────────────────────────────────────

test.describe('Keyboard shortcuts', () => {
  test('Ctrl+Z undoes a result', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const { tid } = await setupUndoTest($)

    await $.put(`/api/tournaments/${tid}/rounds/1/games/1/result`, {
      resultType: 'WHITE_WIN',
    })

    const r = await $.get(`/api/tournaments/${tid}/rounds/1`)
    expect(r.games[0].resultType).toBe('WHITE_WIN')

    // Trigger Ctrl+Z via keyboard
    await page.keyboard.press('Control+z')

    await expect
      .poll(async () => {
        const round = await $.get(`/api/tournaments/${tid}/rounds/1`)
        return round.games[0].resultType
      })
      .toBe('NO_RESULT')
  })

  test('Ctrl+Y redoes after undo', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const { tid } = await setupUndoTest($)

    await $.put(`/api/tournaments/${tid}/rounds/1/games/1/result`, {
      resultType: 'WHITE_WIN',
    })

    await page.keyboard.press('Control+z')

    await expect
      .poll(async () => {
        const round = await $.get(`/api/tournaments/${tid}/rounds/1`)
        return round.games[0].resultType
      })
      .toBe('NO_RESULT')

    await page.keyboard.press('Control+y')

    await expect
      .poll(async () => {
        const round = await $.get(`/api/tournaments/${tid}/rounds/1`)
        return round.games[0].resultType
      })
      .toBe('WHITE_WIN')
  })

  test('Ctrl+Shift+Z also triggers redo', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const { tid } = await setupUndoTest($)

    await $.put(`/api/tournaments/${tid}/rounds/1/games/1/result`, {
      resultType: 'WHITE_WIN',
    })

    await page.keyboard.press('Control+z')

    await expect
      .poll(async () => {
        const round = await $.get(`/api/tournaments/${tid}/rounds/1`)
        return round.games[0].resultType
      })
      .toBe('NO_RESULT')

    await page.keyboard.press('Control+Shift+z')

    await expect
      .poll(async () => {
        const round = await $.get(`/api/tournaments/${tid}/rounds/1`)
        return round.games[0].resultType
      })
      .toBe('WHITE_WIN')
  })

  test('Meta+Z undoes a result (macOS shortcut)', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const { tid } = await setupUndoTest($)

    await $.put(`/api/tournaments/${tid}/rounds/1/games/1/result`, {
      resultType: 'WHITE_WIN',
    })

    const r = await $.get(`/api/tournaments/${tid}/rounds/1`)
    expect(r.games[0].resultType).toBe('WHITE_WIN')

    await page.keyboard.press('Meta+z')

    await expect
      .poll(async () => {
        const round = await $.get(`/api/tournaments/${tid}/rounds/1`)
        return round.games[0].resultType
      })
      .toBe('NO_RESULT')
  })

  test('Ctrl+Z is no-op when nothing to undo', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    await clearUndoHistory($)

    // Should not throw or cause errors
    await page.keyboard.press('Control+z')

    // Page should still be functional
    const redigera = page.getByTestId('menu-bar').getByRole('button', { name: 'Redigera' })
    await expect(redigera).toBeVisible()
  })
})

// ── Timeline panel ──────────────────────────────────────────────────

test.describe('Timeline panel', () => {
  test('Historik menu item opens timeline panel', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    await page.getByTestId('menu-bar').getByRole('button', { name: 'Redigera' }).click()
    await page.getByTestId('menu-dropdown').getByText('Historik...').click()
    await expect(page.locator('.timeline-panel')).toBeVisible()
    await expect(page.locator('.timeline-header')).toContainText('Historik')
  })

  test('timeline shows audit entries after mutations', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const { tid } = await setupUndoTest($)

    // Set two results
    await $.put(`/api/tournaments/${tid}/rounds/1/games/1/result`, {
      resultType: 'WHITE_WIN',
    })
    await $.put(`/api/tournaments/${tid}/rounds/1/games/2/result`, {
      resultType: 'BLACK_WIN',
    })

    // Open timeline
    await page.getByTestId('menu-bar').getByRole('button', { name: 'Redigera' }).click()
    await page.getByTestId('menu-dropdown').getByText('Historik...').click()

    // Verify entries exist with labels
    const entries = page.locator('.timeline-entry')
    await expect(entries).not.toHaveCount(0)
    await expect(
      page.locator('.timeline-label', { hasText: 'Ange resultat' }).first(),
    ).toBeVisible()
  })

  test('current entry is highlighted', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    await setupUndoTest($)

    // Open timeline
    await page.getByTestId('menu-bar').getByRole('button', { name: 'Redigera' }).click()
    await page.getByTestId('menu-dropdown').getByText('Historik...').click()

    // Exactly one current entry
    await expect(page.locator('.timeline-entry--current')).toHaveCount(1)
  })

  test('Återställ hit restores to a previous point', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)
    const { tid } = await setupUndoTest($)

    // Set a result (creates an undo entry)
    await $.put(`/api/tournaments/${tid}/rounds/1/games/1/result`, {
      resultType: 'WHITE_WIN',
    })

    const r = await $.get(`/api/tournaments/${tid}/rounds/1`)
    expect(r.games[0].resultType).toBe('WHITE_WIN')

    // Open timeline
    await page.getByTestId('menu-bar').getByRole('button', { name: 'Redigera' }).click()
    await page.getByTestId('menu-dropdown').getByText('Historik...').click()

    // Click the "Återställ hit" button on a non-current entry
    const restoreBtn = page.locator('.timeline-restore').first()
    await restoreBtn.click()

    // Poll until restore completes
    await expect
      .poll(async () => {
        const round = await $.get(`/api/tournaments/${tid}/rounds/1`)
        return round.games[0].resultType
      })
      .toBe('NO_RESULT')
  })

  test('timeline panel closes when clicking overlay', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)

    await page.getByTestId('menu-bar').getByRole('button', { name: 'Redigera' }).click()
    await page.getByTestId('menu-dropdown').getByText('Historik...').click()
    await expect(page.locator('.timeline-panel')).toBeVisible()

    // Click the overlay (left edge, away from the panel)
    await page.locator('.timeline-overlay').click({ position: { x: 10, y: 300 } })
    await expect(page.locator('.timeline-panel')).not.toBeVisible()
  })

  test('timeline panel close button works', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)

    await page.getByTestId('menu-bar').getByRole('button', { name: 'Redigera' }).click()
    await page.getByTestId('menu-dropdown').getByText('Historik...').click()
    await expect(page.locator('.timeline-panel')).toBeVisible()

    await page.locator('button[aria-label="Stäng"]').click()
    await expect(page.locator('.timeline-panel')).not.toBeVisible()
  })
})
