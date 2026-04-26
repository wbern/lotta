/**
 * Curl-progression: load a real tournament backup, simulate the remaining
 * rounds with random results, and dump per-round HTML reports + the final
 * sqlite for offline research. Not run in CI.
 *
 * Run: pnpm exec playwright test --project=curl-progression
 *
 * Inputs:
 *   - Latest ~/Downloads/lotta-backup*.sqlite by mtime.
 *   - Hardcoded tournament id 4 (Regionfinal Schackfyran), 5 rounds total.
 *
 * Outputs (written to test-results/curl-progression/<timestamp>/):
 *   - round-N-pairings.html, round-N-standings.html, round-N-club.html
 *   - cross-table.html, players.html (post-final)
 *   - final.sqlite
 *   - run.log (round-by-round summary printed to stdout too)
 */
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'

const TOURNAMENT_ID = 4
const TOTAL_ROUNDS = 5
const RNG_SEED = 0xc0ffee

type ResultType = 'WHITE_WIN' | 'DRAW' | 'BLACK_WIN'

type LottaApi = {
  listTournaments: () => Promise<
    Array<{
      id: number
      name: string
      nrOfRounds: number
      roundsPlayed: number
      playerCount: number
    }>
  >
  getTournament: (id: number) => Promise<{
    id: number
    name: string
    group: string
    pairingSystem: string
    initialPairing: string
    nrOfRounds: number
    barredPairing: boolean
    compensateWeakPlayerPP: boolean
    pointsPerGame: number
    chess4: boolean
    ratingChoice: string
    showELO: boolean
    showGroup: boolean
    selectedTiebreaks?: string[]
  }>
  updateTournament: (id: number, req: unknown) => Promise<unknown>
  pairNextRound: (id: number) => Promise<{
    roundNr: number
    games: Array<{ boardNr: number; resultType: string }>
  }>
  setResult: (
    id: number,
    round: number,
    board: number,
    req: { resultType: ResultType },
  ) => Promise<unknown>
  publishHtml: (id: number, what: string, round?: number) => Promise<Blob>
  exportDbBytes: () => Uint8Array
  restoreDbBytes: (bytes: Uint8Array) => Promise<void>
}

declare global {
  interface Window {
    __lottaApi: LottaApi
  }
}

function findLatestBackup(): string {
  const dir = join(homedir(), 'Downloads')
  const candidates = readdirSync(dir)
    .filter((f) => /^lotta-backup.*\.sqlite$/i.test(f))
    .map((f) => {
      const full = join(dir, f)
      return { full, mtime: statSync(full).mtimeMs }
    })
    .sort((a, b) => b.mtime - a.mtime)
  if (candidates.length === 0) throw new Error(`No lotta-backup*.sqlite in ${dir}`)
  return candidates[0].full
}

// Tiny seeded PRNG (mulberry32). Deterministic across runs so artifacts
// are reproducible from the same backup; bump RNG_SEED to reroll.
function makeRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function rollResult(rng: () => number): ResultType {
  // 45% white, 45% black, 10% draw — chess base rates skew slightly toward
  // decisive at amateur level. Adjust if you want flatter distributions.
  const r = rng()
  if (r < 0.45) return 'WHITE_WIN'
  if (r < 0.9) return 'BLACK_WIN'
  return 'DRAW'
}

test.describe('Curl progression — random walk to final round', () => {
  test.setTimeout(10 * 60_000)

  test(`tournament ${TOURNAMENT_ID}: simulate to round ${TOTAL_ROUNDS}`, async ({ browser }) => {
    const backupPath = findLatestBackup()
    const backupBytes = readFileSync(backupPath)
    const backupB64 = backupBytes.toString('base64')

    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    const outDir = join(process.cwd(), 'test-results', 'curl-progression', ts)
    mkdirSync(outDir, { recursive: true })
    const log: string[] = []
    const note = (s: string) => {
      console.log(s)
      log.push(s)
    }
    note(`backup: ${backupPath} (${backupBytes.length} bytes)`)
    note(`output: ${outDir}`)

    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto('/')
    await page.waitForFunction(() => window.__lottaApi != null, null, { timeout: 30_000 })

    // Restore backup into the in-browser DB.
    await page.evaluate(async (b64) => {
      const bin = atob(b64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      await window.__lottaApi.restoreDbBytes(bytes)
    }, backupB64)

    const tournaments = await page.evaluate(() => window.__lottaApi.listTournaments())
    const target = tournaments.find((t) => t.id === TOURNAMENT_ID)
    expect(target, `tournament ${TOURNAMENT_ID} not found in backup`).toBeTruthy()
    note(
      `tournament: ${target!.name} — ${target!.playerCount} players, ${target!.roundsPlayed}/${target!.nrOfRounds} rounds played`,
    )

    // Truncate the configured rounds to TOTAL_ROUNDS so reports show
    // "Rond N av 5" and standings reflect a tournament ending at round 5.
    if (target!.nrOfRounds !== TOTAL_ROUNDS) {
      await page.evaluate(
        async ({ id, total }) => {
          const t = await window.__lottaApi.getTournament(id)
          await window.__lottaApi.updateTournament(id, { ...t, nrOfRounds: total })
        },
        { id: TOURNAMENT_ID, total: TOTAL_ROUNDS },
      )
      note(`adjusted nrOfRounds: ${target!.nrOfRounds} -> ${TOTAL_ROUNDS}`)
    }

    const startRound = target!.roundsPlayed + 1

    // Helper: dump a publish endpoint to a file.
    async function dump(what: string, file: string, round?: number): Promise<void> {
      const html = await page.evaluate(
        async ({ id, what, round }) => {
          const blob = await window.__lottaApi.publishHtml(id, what, round)
          return await blob.text()
        },
        { id: TOURNAMENT_ID, what, round },
      )
      writeFileSync(join(outDir, file), html, 'utf-8')
    }

    // Pre-snapshot: standings as they stood when the backup was taken.
    if (target!.roundsPlayed > 0) {
      await dump('standings', `pre-standings-after-r${target!.roundsPlayed}.html`)
      await dump('club-standings', `pre-club-standings-after-r${target!.roundsPlayed}.html`)
    }

    const rng = makeRng(RNG_SEED)

    for (let round = startRound; round <= TOTAL_ROUNDS; round++) {
      const paired = await page.evaluate((id) => window.__lottaApi.pairNextRound(id), TOURNAMENT_ID)
      expect(paired.roundNr).toBe(round)
      note(`round ${round}: paired ${paired.games.length} games`)

      await dump('pairings', `round-${round}-pairings.html`, round)
      await dump('alphabetical', `round-${round}-alphabetical.html`, round)

      // Drop random results for every game that doesn't already have one
      // (pairNextRound assigns a bye automatically with WHITE_WIN_WO; respect that).
      const assignments: Array<{ board: number; result: ResultType }> = []
      for (const g of paired.games) {
        if (g.resultType !== 'NO_RESULT') continue
        assignments.push({ board: g.boardNr, result: rollResult(rng) })
      }

      await page.evaluate(
        async ({ id, round, assignments }) => {
          for (const a of assignments) {
            await window.__lottaApi.setResult(id, round, a.board, { resultType: a.result })
          }
        },
        { id: TOURNAMENT_ID, round, assignments },
      )

      const counts = assignments.reduce(
        (acc, a) => {
          acc[a.result]++
          return acc
        },
        { WHITE_WIN: 0, DRAW: 0, BLACK_WIN: 0 } as Record<ResultType, number>,
      )
      note(
        `round ${round}: results — white ${counts.WHITE_WIN}, draw ${counts.DRAW}, black ${counts.BLACK_WIN} (${paired.games.length - assignments.length} pre-set/bye)`,
      )

      await dump('standings', `round-${round}-standings.html`, round)
      await dump('club-standings', `round-${round}-club-standings.html`, round)
    }

    // Final artifacts — post round TOTAL_ROUNDS.
    await dump('cross-table', 'cross-table.html')
    await dump('players', 'players.html')

    const finalBytes = await page.evaluate(() => Array.from(window.__lottaApi.exportDbBytes()))
    writeFileSync(join(outDir, 'final.sqlite'), Buffer.from(finalBytes))
    note(`final.sqlite: ${finalBytes.length} bytes`)

    writeFileSync(join(outDir, 'run.log'), `${log.join('\n')}\n`, 'utf-8')

    await context.close()

    // Sanity: did we actually finish?
    expect(finalBytes.length).toBeGreaterThan(0)
  })
})
