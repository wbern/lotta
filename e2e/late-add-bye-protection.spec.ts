/**
 * Late-add bye protection: when a player is added mid-tournament and the
 * next round has an odd active count, the bye should NOT be assigned to
 * the late-add in their debut round (default), unless the arbiter
 * explicitly opts out.
 *
 * The setup:
 *   - Monrad + Rating, 6 starting players → R1 = 3 boards, no bye.
 *   - All R1 results entered (so scores differ).
 *   - Late-add 1 player → 7 active → R2 must assign a bye.
 *
 * Without protection, findByePlayer picks the lowest-scoring player who
 * hasn't had a bye — a freshly-added player at score 0 is the obvious
 * candidate. The protection logic excludes debutants on the first pass and
 * forces the bye onto a non-debutant.
 *
 * Run: pnpm exec playwright test --project=late-add-bye-protection
 */
import { type Browser, expect, type Page, test } from '@playwright/test'

type LottaApi = {
  createTournament: (dto: unknown) => Promise<{ id: number }>
  addTournamentPlayer: (
    tid: number,
    dto: unknown,
  ) => Promise<{ id: number; addedAtRound: number; protectFromByeInDebut: boolean }>
  pairNextRound: (tid: number) => Promise<{
    games: Array<{
      boardNr: number
      whitePlayer: { id: number } | null
      blackPlayer: { id: number } | null
    }>
  }>
  setResult: (
    tid: number,
    roundNr: number,
    boardNr: number,
    req: { resultType: string },
  ) => Promise<unknown>
}

declare global {
  interface Window {
    __lottaApi: LottaApi
  }
}

const BASE_DTO = {
  group: 'late-add-bye',
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

async function freshPage(browser: Browser) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto('/')
  await page.waitForFunction(() => window.__lottaApi != null, null, { timeout: 30_000 })
  return { context, page }
}

async function runByeScenario(page: Page, name: string, protectLateAdd: boolean) {
  return page.evaluate(
    async ({ baseDto, name, protectLateAdd }) => {
      const t = await window.__lottaApi.createTournament({ ...baseDto, name })

      // 6 original players — even count → R1 has no bye.
      const originalIds: number[] = []
      for (let i = 0; i < 6; i++) {
        const p = await window.__lottaApi.addTournamentPlayer(t.id, {
          firstName: `F${String(i).padStart(3, '0')}`,
          lastName: `L${String(i).padStart(3, '0')}`,
          ratingI: 2000 - i * 100,
          clubIndex: 0,
          federation: 'SWE',
          withdrawnFromRound: -1,
        })
        originalIds.push(p.id)
      }

      const r1 = await window.__lottaApi.pairNextRound(t.id)

      // Enter R1 results so scores differ — every white wins. This makes
      // the lowest-rated original player end R1 at 0 and the late-add at 0;
      // findByePlayer picks the LAST sorted entry (lowest score, ties
      // broken by lotNr), so the late-add must be excluded by protection.
      for (const g of r1.games) {
        await window.__lottaApi.setResult(t.id, 1, g.boardNr, { resultType: 'WHITE_WIN' })
      }

      const lateAdd = await window.__lottaApi.addTournamentPlayer(t.id, {
        firstName: 'Late',
        lastName: 'Arrival',
        ratingI: 1500,
        clubIndex: 0,
        federation: 'SWE',
        withdrawnFromRound: -1,
        protectFromByeInDebut: protectLateAdd,
      })

      const r2 = await window.__lottaApi.pairNextRound(t.id)

      const byeGame = r2.games.find((g) => !g.whitePlayer || !g.blackPlayer) ?? null
      const byePlayerId = byeGame
        ? (byeGame.whitePlayer?.id ?? byeGame.blackPlayer?.id ?? null)
        : null

      return {
        originalIds,
        lateAddId: lateAdd.id,
        lateAddedAtRound: lateAdd.addedAtRound,
        lateProtect: lateAdd.protectFromByeInDebut,
        r2BoardCount: r2.games.length,
        byePlayerId,
      }
    },
    { baseDto: BASE_DTO, name, protectLateAdd },
  )
}

test.describe('Late-add bye protection', () => {
  test.setTimeout(60_000)

  test('default-protected late-add does NOT receive the R2 bye', async ({ browser }) => {
    const { context, page } = await freshPage(browser)
    const result = await runByeScenario(page, 'protected-late-add', true)
    await context.close()

    expect(result.lateAddedAtRound, 'late-add should be stamped at addedAtRound=1').toBe(1)
    expect(result.lateProtect, 'protectFromByeInDebut should round-trip true').toBe(true)
    expect(result.byePlayerId, 'R2 must have a bye game with exactly one player').not.toBeNull()
    expect(
      result.byePlayerId,
      'protected late-add must not be the R2 bye recipient — it is their debut round',
    ).not.toBe(result.lateAddId)
    expect(
      result.originalIds,
      'bye must fall on one of the original (non-debutant) players',
    ).toContain(result.byePlayerId)
  })

  test('opt-out late-add (protectFromByeInDebut=false) IS eligible for the R2 bye', async ({
    browser,
  }) => {
    const { context, page } = await freshPage(browser)
    const result = await runByeScenario(page, 'optout-late-add', false)
    await context.close()

    expect(result.lateProtect, 'protectFromByeInDebut should round-trip false').toBe(false)
    expect(
      result.byePlayerId,
      'with protection disabled, the late-add (lowest score, no prior bye) gets the bye',
    ).toBe(result.lateAddId)
  })
})
