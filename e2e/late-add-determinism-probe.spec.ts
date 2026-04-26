/**
 * Probe: is Schackfyran (Slumpad) pairing deterministic across
 * unpair → pair, with NO player changes?
 *
 * If user's claim is correct, two consecutive (pair → unpair → pair)
 * cycles on the same player set should produce identical pair sets.
 *
 * If the code's `Math.random()` in assignLotNumbers is the truth, the
 * second pairing diverges.
 *
 * Run: pnpm exec playwright test --project=late-add-determinism-probe
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

const SCHACKFYRAN_DTO = {
  group: 'determinism-probe',
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

test.describe('Slumpad determinism probe', () => {
  test.setTimeout(120_000)

  test('pair → unpair → pair (no player changes) — does pair set match?', async ({ browser }) => {
    const { context, page } = await freshPage(browser)
    const N = 51

    const result = await page.evaluate(
      async ({ baseDto, n }) => {
        const t = await window.__lottaApi.createTournament({ ...baseDto, name: 'no-add-probe' })
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
        const a = await window.__lottaApi.pairNextRound(t.id)
        await window.__lottaApi.unpairLastRound(t.id, true)
        const b = await window.__lottaApi.pairNextRound(t.id)
        return {
          a: a.games.map((g) => ({
            white: g.whitePlayer?.id ?? null,
            black: g.blackPlayer?.id ?? null,
          })),
          b: b.games.map((g) => ({
            white: g.whitePlayer?.id ?? null,
            black: g.blackPlayer?.id ?? null,
          })),
        }
      },
      { baseDto: SCHACKFYRAN_DTO, n: N },
    )
    await context.close()

    const aKeys = new Set(result.a.map((g) => pairKey(g.white, g.black)))
    const bKeys = new Set(result.b.map((g) => pairKey(g.white, g.black)))
    const surviving = [...aKeys].filter((k) => bKeys.has(k))
    const rate = surviving.length / aKeys.size

    console.log(
      `[probe] Slumpad pair→unpair→pair: ${surviving.length}/${aKeys.size} = ${(rate * 100).toFixed(1)}% pairings preserved across the no-op cycle`,
    )

    // Don't assert; this is a probe — we want to see what actually happens.
    expect(aKeys.size).toBeGreaterThan(0)
    expect(bKeys.size).toBeGreaterThan(0)
  })
})
