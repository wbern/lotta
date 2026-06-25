/**
 * TDD acceptance spec for ADR-0002 — the active round in the URL must always
 * reference an existing round (or be cleared). Today the view does NOT reconcile
 * against the data after several context-changing actions, so ?round dangles at a
 * round that no longer exists. These three scenarios share one invariant and one
 * systemic fix (a derive-and-validate selection layer).
 */

import {
  ALL_DRAWS,
  apiClient,
  createTournament,
  pairRound,
  setResults,
  waitForApi,
} from './api-helpers'
import { expect, test } from './fixtures'
import { selectTournament } from './helpers'

const PLAYERS = [
  { firstName: 'A', lastName: 'Ett' },
  { firstName: 'B', lastName: 'Två' },
  { firstName: 'C', lastName: 'Tre' },
  { firstName: 'D', lastName: 'Fyra' },
]

/**
 * Create a tournament with `rounds` rounds. The earlier rounds are fully played
 * (results recorded so the next round can be paired); the FINAL round is left
 * paired-but-unscored, so the last undoable action is that round's pairing.
 */
async function makeTournamentWithRounds(
  page: import('@playwright/test').Page,
  name: string,
  rounds: number,
) {
  const $ = apiClient(page)
  const { tid } = await createTournament(
    $,
    { name, group: 'A', pairingSystem: 'Monrad', nrOfRounds: 9 },
    PLAYERS,
  )
  // Play the earlier rounds fully (results recorded), then leave the final round
  // paired-but-unscored so the last undoable action is that round's pairing.
  for (let r = 1; r < rounds; r++) {
    const round = await pairRound($, tid)
    await setResults($, tid, r, round.games, ALL_DRAWS)
  }
  if (rounds >= 1) await pairRound($, tid)
  return tid
}

function roundParam(page: import('@playwright/test').Page) {
  return new URL(page.url()).searchParams.get('round')
}

function roundSelect(page: import('@playwright/test').Page) {
  return page.getByTestId('tournament-selector').locator('select').nth(2)
}

test('switching tournaments resets a round that does not exist in the new one', async ({
  page,
}) => {
  await page.goto('/')
  await waitForApi(page)
  await makeTournamentWithRounds(page, 'VS-A', 2)
  await createTournament(
    apiClient(page),
    { name: 'VS-B', group: 'A', pairingSystem: 'Monrad', nrOfRounds: 9 },
    PLAYERS,
  ) // draft, 0 rounds
  await page.goto('/')

  await selectTournament(page, 'VS-A')
  await roundSelect(page).selectOption('2')
  await expect.poll(() => roundParam(page)).toBe('2')

  // Switch to VS-B, which has no round 2.
  await page.getByTestId('tournament-selector').locator('select').first().selectOption('VS-B')

  // Invariant: the round must not still point at A's round 2.
  await expect.poll(() => roundParam(page)).not.toBe('2')
})

test('unpairing the last round clears the now-deleted round from the URL', async ({ page }) => {
  await page.goto('/')
  await waitForApi(page)
  await makeTournamentWithRounds(page, 'VS-Unpair', 2)
  await page.goto('/')

  await selectTournament(page, 'VS-Unpair')
  await roundSelect(page).selectOption('2')
  await expect.poll(() => roundParam(page)).toBe('2')

  // Ångra lottning (unpair last round) removes round 2.
  await page.getByTestId('menu-bar').getByRole('button', { name: 'Lotta' }).click()
  await page.getByTestId('menu-dropdown').getByText('Ångra lottning').click()
  await page
    .getByTestId('dialog-overlay')
    .getByRole('button', { name: 'OK' })
    .click({ force: true })

  await expect.poll(() => roundParam(page)).not.toBe('2')
})

test('undoing a pairing clears the now-deleted round from the URL', async ({ page }) => {
  await page.goto('/')
  await waitForApi(page)
  await makeTournamentWithRounds(page, 'VS-Undo', 2) // last undoable action = pair round 2
  await page.goto('/')

  await selectTournament(page, 'VS-Undo')
  await roundSelect(page).selectOption('2')
  await expect.poll(() => roundParam(page)).toBe('2')

  // Undo the round-2 pairing.
  await page.getByTestId('menu-bar').getByRole('button', { name: 'Redigera' }).click()
  await page.getByTestId('menu-dropdown').getByRole('button', { name: 'Ångra' }).click()

  await expect.poll(() => roundParam(page)).not.toBe('2')
})
