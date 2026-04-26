/**
 * Seed-time invariants for in-browser DB writes.
 *
 *   H1.  N concurrent addTournamentPlayer calls — every add is in memory
 *        AND survives a same-context page reload (IndexedDB ground truth).
 *   H1b. Mixed waves of concurrent add+update+remove — in-memory state
 *        and the persisted IDB snapshot agree after every wave.
 *   H3.  Removing a tournament player still referenced by a game must
 *        either fail loudly or leave no dangling FK rows behind.
 *
 * Run: pnpm exec playwright test --project=seed-corruption
 */
import { type Browser, expect, type Page, test } from '@playwright/test'
// @ts-expect-error — sql.js ships CJS without adequate ambient types here;
// we only use it for raw SQL diagnostics against the exported DB bytes.
import initSqlJs from 'sql.js'

type LottaApi = {
  createTournament: (dto: unknown) => Promise<{ id: number }>
  addTournamentPlayer: (tid: number, dto: unknown) => Promise<{ id: number }>
  updateTournamentPlayer: (tid: number, pid: number, dto: unknown) => Promise<unknown>
  removeTournamentPlayer: (tid: number, pid: number) => Promise<unknown>
  listTournamentPlayers: (
    tid: number,
  ) => Promise<Array<{ id: number; title: string; firstName: string; lastName: string }>>
  pairNextRound: (tid: number) => Promise<{
    games: Array<{ whitePlayer: { id: number } | null }>
  }>
  exportDbBytes: () => Uint8Array
}

declare global {
  interface Window {
    __lottaApi: LottaApi
  }
}

const BASE_TOURNAMENT_DTO = {
  group: 'probe',
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
  await waitForApi(page)
  return { context, page }
}

async function waitForApi(page: Page) {
  await page.waitForFunction(() => window.__lottaApi != null, null, { timeout: 30_000 })
}

test.describe('Seed corruption probes', () => {
  test.setTimeout(5 * 60_000)

  test('H1: 200 concurrent addTournamentPlayer — all persist', async ({ browser }) => {
    const { context, page } = await freshPage(browser)

    const N = 200
    const inMemory = await page.evaluate(
      async ({ n, baseDto }) => {
        const t = await window.__lottaApi.createTournament({ ...baseDto, name: 'H1' })
        const dtos = Array.from({ length: n }, (_, i) => ({
          firstName: `F${String(i).padStart(4, '0')}`,
          lastName: `L${String(i).padStart(4, '0')}`,
          ratingI: 1500 + i,
          clubIndex: 0,
          federation: 'SWE',
          withdrawnFromRound: -1,
        }))
        // FIRE WITHOUT SEQUENTIAL AWAIT — all in flight simultaneously.
        await Promise.all(dtos.map((d) => window.__lottaApi.addTournamentPlayer(t.id, d)))
        const list = await window.__lottaApi.listTournamentPlayers(t.id)
        return { tid: t.id, count: list.length }
      },
      { n: N, baseDto: BASE_TOURNAMENT_DTO },
    )

    // Same-context reload forces rehydration from whatever IDB persisted.
    await page.reload()
    await waitForApi(page)

    const afterReload = await page.evaluate(
      async (tid) => (await window.__lottaApi.listTournamentPlayers(tid)).length,
      inMemory.tid,
    )

    await context.close()

    expect(inMemory.count).toBe(N)
    expect(afterReload, `after reload, IndexedDB should contain all ${N} added players`).toBe(
      inMemory.count,
    )
  })

  test('H1b: concurrent add+update+remove waves — persistence matches memory', async ({
    browser,
  }) => {
    const { context, page } = await freshPage(browser)

    const WAVES = 8
    const PER_WAVE = 50
    const divergences: Array<{ wave: number; detail: string }> = []

    const tid = await page.evaluate(async (baseDto) => {
      const t = await window.__lottaApi.createTournament({ ...baseDto, name: 'H1b' })
      return t.id
    }, BASE_TOURNAMENT_DTO)

    for (let wave = 0; wave < WAVES; wave++) {
      // Phase 1: PER_WAVE concurrent adds. Each save() exports a different
      // snapshot and hands it to its own fresh IDB connection.
      const added: number[] = await page.evaluate(
        async ({ tid, n, wave }) => {
          const ps = Array.from({ length: n }, (_, i) =>
            window.__lottaApi.addTournamentPlayer(tid, {
              firstName: `W${wave}F${String(i).padStart(3, '0')}`,
              lastName: `W${wave}L${String(i).padStart(3, '0')}`,
              ratingI: 1500 + wave * 1000 + i,
              clubIndex: 0,
              federation: 'SWE',
              withdrawnFromRound: -1,
            }),
          )
          return (await Promise.all(ps)).map((r) => r.id)
        },
        { tid, n: PER_WAVE, wave },
      )

      // Phase 2: half updated, half removed — fired together to maximize
      // out-of-order snapshot delivery to IDB.
      const toUpdate = added.slice(0, Math.floor(added.length / 2))
      const toRemove = added.slice(Math.floor(added.length / 2))
      await page.evaluate(
        async ({ tid, toUpdate, toRemove }) => {
          const updates = toUpdate.map((pid) =>
            window.__lottaApi.updateTournamentPlayer(tid, pid, { title: 'GM' }),
          )
          const removes = toRemove.map((pid) => window.__lottaApi.removeTournamentPlayer(tid, pid))
          await Promise.all([...updates, ...removes])
        },
        { tid, toUpdate, toRemove },
      )

      const inMem = await page.evaluate(async (tid) => {
        const list = await window.__lottaApi.listTournamentPlayers(tid)
        return {
          count: list.length,
          titled: list.filter((p) => p.title === 'GM').length,
        }
      }, tid)

      await page.reload()
      await waitForApi(page)

      const persisted = await page.evaluate(async (tid) => {
        const list = await window.__lottaApi.listTournamentPlayers(tid)
        return {
          count: list.length,
          titled: list.filter((p) => p.title === 'GM').length,
        }
      }, tid)

      if (persisted.count !== inMem.count || persisted.titled !== inMem.titled) {
        divergences.push({
          wave,
          detail: `inMem=${inMem.count}/${inMem.titled}-titled persisted=${persisted.count}/${persisted.titled}-titled`,
        })
        break
      }
    }

    await context.close()

    expect(
      divergences,
      `expected no divergence between in-memory and persisted state; saw:\n${divergences.map((d) => `  - wave ${d.wave}: ${d.detail}`).join('\n')}`,
    ).toEqual([])
  })

  test('H3: remove player referenced by games — no dangling FK', async ({ browser }) => {
    const { context, page } = await freshPage(browser)

    const result = await page.evaluate(async (baseDto) => {
      const t = await window.__lottaApi.createTournament({
        ...baseDto,
        name: 'H3',
        nrOfRounds: 3,
      })
      for (let i = 0; i < 6; i++) {
        await window.__lottaApi.addTournamentPlayer(t.id, {
          firstName: `F${i}`,
          lastName: `L${i}`,
          ratingI: 1500 + i,
          clubIndex: 0,
          federation: 'SWE',
          withdrawnFromRound: -1,
        })
      }
      const round = await window.__lottaApi.pairNextRound(t.id)
      const victim = round.games[0].whitePlayer!.id
      let removeError: string | null = null
      try {
        await window.__lottaApi.removeTournamentPlayer(t.id, victim)
      } catch (e) {
        removeError = (e as Error).message
      }
      return {
        victim,
        removeError,
        bytes: Array.from(window.__lottaApi.exportDbBytes()),
      }
    }, BASE_TOURNAMENT_DTO)

    await context.close()

    // PRAGMA foreign_key_check is the authority on dangling references.
    const SQL = await initSqlJs()
    const db = new SQL.Database(Uint8Array.from(result.bytes))
    const fkCheck = (db.exec('PRAGMA foreign_key_check')[0]?.values ?? []) as unknown[][]
    const victimRow = (db.exec(
      `SELECT "index" FROM tournamentplayers WHERE "index" = ${result.victim}`,
    )[0]?.values ?? []) as unknown[][]
    const dangling = (db.exec(
      `SELECT round, boardnr, whiteplayer, blackplayer FROM tournamentgames
       WHERE whiteplayer = ${result.victim} OR blackplayer = ${result.victim}`,
    )[0]?.values ?? []) as unknown[][]
    db.close()

    if (result.removeError == null) {
      // Remove succeeded: no dangling rows, no FK violations.
      expect(fkCheck, 'PRAGMA foreign_key_check should be empty after a successful remove').toEqual(
        [],
      )
      expect(dangling, 'No tournamentgames rows should reference the removed player').toEqual([])
    } else {
      // Remove refused: lock in the contract — clear error AND player still present.
      expect(result.removeError).toMatch(/Cannot remove player/)
      expect(victimRow.length, 'victim should still exist when remove was refused').toBe(1)
    }
  })
})
