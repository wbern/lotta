/**
 * Late-add reshuffle: characterize what happens when a single player is
 * added to an already-paired round and the only available "fix" path is
 * used (unpair → pair next round).
 *
 * Two scenarios, two outcomes:
 *
 *   A. Monrad + Rating (adult tournament): the pairing algorithm with a
 *      stable rating-based ordering naturally produces a minimal-impact
 *      result — almost every pair from the pre-add round survives.
 *
 *   B. Monrad + Slumpad + chess4 (Schackfyran convention, today's case):
 *      the random initial pairing re-rolls on every pair() call, so
 *      virtually every pair changes regardless of how many players were
 *      added. The cascade isn't caused by the algorithm being unstable —
 *      it's caused by the destructive unpair-and-repair recipe being the
 *      only path available when the arbiter just wants to slot in a late
 *      player.
 *
 * Run: pnpm exec playwright test --project=late-add-reshuffle
 */
import { type Browser, expect, type Page, test } from '@playwright/test'

type LottaApi = {
  createTournament: (dto: unknown) => Promise<{ id: number }>
  addTournamentPlayer: (tid: number, dto: unknown) => Promise<{ id: number }>
  pairNextRound: (tid: number) => Promise<{
    games: Array<{
      boardNr: number
      whitePlayer: { id: number } | null
      blackPlayer: { id: number } | null
    }>
  }>
  unpairLastRound: (tid: number, confirm: boolean) => Promise<void>
}

declare global {
  interface Window {
    __lottaApi: LottaApi
  }
}

const RATING_DTO = {
  group: 'late-add',
  pairingSystem: 'Monrad',
  initialPairing: 'Rating',
  nrOfRounds: 5,
  barredPairing: false,
  compensateWeakPlayerPP: false,
  pointsPerGame: 1,
  chess4: false,
  ratingChoice: 'ELO',
  showELO: true,
  showGroup: false,
}

const SCHACKFYRAN_DTO = {
  group: 'late-add',
  pairingSystem: 'Monrad',
  initialPairing: 'Slumpad',
  nrOfRounds: 5,
  barredPairing: false,
  compensateWeakPlayerPP: false,
  pointsPerGame: 4,
  chess4: true,
  ratingChoice: 'ELO',
  showELO: true,
  showGroup: false,
}

async function freshPage(browser: Browser) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto('/')
  await page.waitForFunction(() => window.__lottaApi != null, null, { timeout: 30_000 })
  return { context, page }
}

function pairKey(white: number | null, black: number | null): string {
  if (white == null || black == null) return `bye:${white ?? black}`
  const lo = Math.min(white, black)
  const hi = Math.max(white, black)
  return `${lo}-${hi}`
}

async function runLateAddScenario(page: Page, baseDto: object, name: string, n: number) {
  return page.evaluate(
    async ({ baseDto, name, n }) => {
      const t = await window.__lottaApi.createTournament({ ...baseDto, name })

      for (let i = 0; i < n; i++) {
        await window.__lottaApi.addTournamentPlayer(t.id, {
          firstName: `F${String(i).padStart(3, '0')}`,
          lastName: `L${String(i).padStart(3, '0')}`,
          ratingI: 2000 - i,
          clubIndex: 0,
          federation: 'SWE',
          withdrawnFromRound: -1,
        })
      }

      const before = await window.__lottaApi.pairNextRound(t.id)

      await window.__lottaApi.addTournamentPlayer(t.id, {
        firstName: 'Late',
        lastName: 'Arrival',
        ratingI: 1500,
        clubIndex: 0,
        federation: 'SWE',
        withdrawnFromRound: -1,
      })

      await window.__lottaApi.unpairLastRound(t.id, true)
      const after = await window.__lottaApi.pairNextRound(t.id)

      return {
        beforeGames: before.games.map((g) => ({
          boardNr: g.boardNr,
          white: g.whitePlayer?.id ?? null,
          black: g.blackPlayer?.id ?? null,
        })),
        afterGames: after.games.map((g) => ({
          boardNr: g.boardNr,
          white: g.whitePlayer?.id ?? null,
          black: g.blackPlayer?.id ?? null,
        })),
      }
    },
    { baseDto, name, n },
  )
}

function survivalRate(
  before: { white: number | null; black: number | null }[],
  after: { white: number | null; black: number | null }[],
) {
  const beforeKeys = new Set(before.map((g) => pairKey(g.white, g.black)))
  const afterKeys = new Set(after.map((g) => pairKey(g.white, g.black)))
  const surviving = [...beforeKeys].filter((k) => afterKeys.has(k))
  return { rate: surviving.length / beforeKeys.size, surviving, total: beforeKeys.size }
}

test.describe('Late-add reshuffle', () => {
  test.setTimeout(120_000)

  test('Monrad + Rating: late-add naturally produces a minimal-impact patch', async ({
    browser,
  }) => {
    const { context, page } = await freshPage(browser)
    const N = 51
    const result = await runLateAddScenario(page, RATING_DTO, 'rating-stable', N)
    await context.close()

    const { rate, surviving, total } = survivalRate(result.beforeGames, result.afterGames)

    // Rating-based ordering is stable: the new lowest-rated player slots
    // in next to the previous bye, leaving the existing top-of-table pairs
    // untouched. This is the desired minimal-impact behavior — and it
    // already happens for free under Rating, no fix needed.
    expect(
      rate,
      `Monrad+Rating should preserve almost all pairings after a low-rated late add. ` +
        `Got ${surviving.length}/${total} = ${(rate * 100).toFixed(1)}% surviving.`,
    ).toBeGreaterThan(0.8)
  })

  test('Monrad + Slumpad + chess4 (Schackfyran): late-add reshuffles the entire round', async ({
    browser,
  }) => {
    const { context, page } = await freshPage(browser)
    const N = 51
    const result = await runLateAddScenario(page, SCHACKFYRAN_DTO, 'schackfyran-cascade', N)
    await context.close()

    const { rate, surviving, total } = survivalRate(result.beforeGames, result.afterGames)

    // Slumpad re-rolls the player order on every pair() call, so virtually
    // no pair from the pre-add round survives. This is what happened in
    // today's Schackfyran R1 (1/57 = 1.8% survived). The bug isn't that
    // the algorithm is wrong — it's that the only path to add a player
    // forces a complete reshuffle, which means re-printing pairings,
    // re-announcing, and physically relocating every child.
    expect(
      rate,
      `Schackfyran (Slumpad) should reshuffle the majority of pairings after any unpair+repair. ` +
        `Got ${surviving.length}/${total} = ${(rate * 100).toFixed(1)}% surviving.`,
    ).toBeLessThan(0.2)

    const newPlayerIds = result.afterGames
      .flatMap((g) => [g.white, g.black])
      .filter((x): x is number => x != null)
    const beforePlayerIds = new Set(
      result.beforeGames.flatMap((g) => [g.white, g.black]).filter((x): x is number => x != null),
    )
    const newPlayerCount = newPlayerIds.filter((id) => !beforePlayerIds.has(id)).length
    expect(newPlayerCount, 'late-arrival should appear in the post-pair board set').toBe(1)
  })
})
