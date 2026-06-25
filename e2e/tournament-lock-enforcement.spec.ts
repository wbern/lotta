/**
 * TDD acceptance spec for ADR-0004 — fields locked in the UI must be enforced at
 * the repository layer too. showELO/showGroup are disabled in chess4 mode in the
 * UI but are absent from the lock set and unchecked in tournaments.update(), so a
 * direct api PUT on a locked chess4 tournament persists values the UI forbids.
 */

import { apiClient, createTournament, ensureClubs, pairRound, waitForApi } from './api-helpers'
import { expect, test } from './fixtures'

test('showELO/showGroup cannot be enabled on a locked chess4 tournament via the api', async ({
  page,
}) => {
  await page.goto('/')
  await waitForApi(page)
  const $ = apiClient(page)

  const clubIds = await ensureClubs($, [{ name: 'Klubb Alfa' }, { name: 'Klubb Beta' }])
  const { tid } = await createTournament(
    $,
    {
      name: 'Lås-test',
      group: 'A',
      pairingSystem: 'Monrad',
      initialPairing: 'Slumpad',
      nrOfRounds: 5,
      chess4: true,
      pointsPerGame: 4,
      barredPairing: true,
      showELO: false,
      showGroup: false,
      ratingChoice: 'ELO',
      selectedTiebreaks: ['SSF Buchholz'],
    },
    [
      { firstName: 'A', lastName: 'Ett', clubIndex: clubIds[0] },
      { firstName: 'B', lastName: 'Två', clubIndex: clubIds[1] },
    ],
  )

  // Pair round 1 → the tournament is now locked.
  await pairRound($, tid)

  // Direct api PUT flipping the presentation flags, keeping every locked scoring
  // field identical (so the existing guards don't reject the whole update).
  const showELOAfter = await page.evaluate(async (id) => {
    const api = (
      window as unknown as {
        __lottaApi: {
          updateTournament: (id: number, req: Record<string, unknown>) => Promise<unknown>
          getTournament: (id: number) => Promise<{ showELO: boolean }>
        }
      }
    ).__lottaApi
    await api.updateTournament(id, {
      name: 'Lås-test',
      group: 'A',
      pairingSystem: 'Monrad',
      initialPairing: 'Slumpad',
      nrOfRounds: 5,
      barredPairing: true,
      compensateWeakPlayerPP: false,
      pointsPerGame: 4,
      chess4: true,
      ratingChoice: 'ELO',
      showELO: true,
      showGroup: true,
      federation: 'SWE',
      selectedTiebreaks: ['SSF Buchholz'],
    })
    const t = await api.getTournament(id)
    return t.showELO
  }, tid)

  // Expected: the locked tournament rejects the presentation change.
  expect(showELOAfter).toBe(false)
})
