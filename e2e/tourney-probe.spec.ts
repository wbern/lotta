/**
 * Tournament-day interaction probe.
 *
 * Walks through interactions that the operator instructions classify as
 * "safe to do freely" (results, walkovers, postponed games, lagstorlek
 * tweaks) plus a handful of normal navigation flows. Looks for breakage,
 * empty UI states, score desync, or anything that doesn't match the
 * operator's mental model.
 *
 * Run: pnpm exec playwright test --project=tourney-probe
 */
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { test } from '@playwright/test'

const TOURNAMENT_ID = 4

type RoundDto = {
  roundNr: number
  hasAllResults: boolean
  games: Array<{
    boardNr: number
    whitePlayer: { id: number; name: string } | null
    blackPlayer: { id: number; name: string } | null
    resultType: string
    whiteScore: number
    blackScore: number
    resultDisplay: string
  }>
}

type LottaApi = {
  listTournaments: () => Promise<Array<{ id: number; name: string; chess4?: boolean }>>
  getTournament: (id: number) => Promise<Record<string, unknown>>
  pairNextRound: (id: number) => Promise<RoundDto>
  unpairLastRound: (id: number) => Promise<unknown>
  setResult: (
    id: number,
    round: number,
    board: number,
    req: { resultType: string },
  ) => Promise<unknown>
  getStandings: (
    id: number,
    round?: number,
  ) => Promise<
    Array<{ place: number; name: string; score: number; tiebreaks: Record<string, string> }>
  >
  getChess4Standings: (
    id: number,
    round?: number,
  ) => Promise<
    Array<{
      place: number
      club: string
      playerCount: number
      chess4Members: number
      score: number
    }>
  >
  getClubStandings: (
    id: number,
    round?: number,
  ) => Promise<Array<{ place: number; club: string; score: number }>>
  publishHtml: (id: number, what: string, round?: number) => Promise<Blob>
  listClubs: () => Promise<Array<{ id: number; name: string; chess4Members: number }>>
  renameClub?: (id: number, name: string) => Promise<unknown>
  restoreDbBytes: (bytes: Uint8Array) => Promise<void>
  exportDbBytes: () => Uint8Array
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
    .map((f) => ({ full: join(dir, f), mtime: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
  if (candidates.length === 0) throw new Error(`No lotta-backup*.sqlite in ${dir}`)
  return candidates[0].full
}

test.describe('Tournament probe — safe interactions', () => {
  test.setTimeout(5 * 60_000)

  test('exercise results, postponements, navigation, chess4 formula', async ({ browser }) => {
    const findings: Array<{ probe: string; severity: 'info' | 'warn' | 'bug'; detail: string }> = []
    const note = (s: string) => console.log(s)
    const finding = (probe: string, severity: 'info' | 'warn' | 'bug', detail: string) => {
      findings.push({ probe, severity, detail })
      note(`  [${severity.toUpperCase()}] ${probe}: ${detail}`)
    }

    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    const outDir = join(process.cwd(), 'test-results', 'tourney-probe', ts)
    mkdirSync(outDir, { recursive: true })

    const context = await browser.newContext()
    const page = await context.newPage()
    page.on('pageerror', (err) => finding('pageerror', 'bug', err.message))
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text()
        if (text.includes('Failed to load resource')) return
        // sql.js WASM streaming compile aborts on rapid full-page reloads —
        // ArrayBuffer fallback succeeds. Dev-only churn from page.goto loops.
        if (text.includes('wasm streaming compile failed')) return
        if (text.includes('falling back to ArrayBuffer')) return
        finding('console.error', 'warn', text)
      }
    })

    await page.goto('/')
    await page.waitForFunction(() => window.__lottaApi != null, null, { timeout: 30_000 })

    const backupBytes = readFileSync(findLatestBackup())
    await page.evaluate(async (b64) => {
      const bin = atob(b64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      await window.__lottaApi.restoreDbBytes(bytes)
    }, backupBytes.toString('base64'))

    const tournaments = await page.evaluate(() => window.__lottaApi.listTournaments())
    note(`Backup tournaments: ${tournaments.map((t) => `${t.id}:${t.name}`).join(', ')}`)

    // --- PROBE 1: Tournament 3 (no rounds yet) — pair round 1 of 131 players ---
    note('\n=== Probe 1: pair round 1 on a fresh 131-player tournament ===')
    try {
      const t0 = Date.now()
      const r1 = await page.evaluate((id) => window.__lottaApi.pairNextRound(id), 3)
      const ms = Date.now() - t0
      note(`  paired ${r1.games.length} games in ${ms}ms`)
      if (ms > 5000) finding('pair-r1', 'warn', `slow: ${ms}ms for 131 players`)
      // 131 odd → expect 1 bye
      const byes = r1.games.filter((g) => g.blackPlayer == null).length
      if (byes !== 1) finding('pair-r1', 'bug', `expected 1 bye for 131 players, got ${byes}`)
    } catch (e) {
      finding('pair-r1', 'bug', `pairNextRound threw: ${(e as Error).message}`)
    }

    // --- PROBE 2: result-type roundtrip on tournament 4 round 3 ---
    note('\n=== Probe 2: cycle a result through every type, verify standings reflect it ===')
    const r3 = await page.evaluate((id) => window.__lottaApi.pairNextRound(id), TOURNAMENT_ID)
    const probeBoard = r3.games.find((g) => g.blackPlayer != null)!.boardNr
    const whitePlayerName = r3.games.find((g) => g.boardNr === probeBoard)!.whitePlayer!.name
    note(`  using board ${probeBoard} (white: ${whitePlayerName})`)

    const types = [
      'WHITE_WIN',
      'BLACK_WIN',
      'DRAW',
      'WHITE_WIN_WO',
      'BLACK_WIN_WO',
      'DOUBLE_WO',
      'POSTPONED',
      'CANCELLED',
      'NO_RESULT',
    ]
    for (const type of types) {
      try {
        const probeGame = await page.evaluate(
          async ({ id, round, board, type }) => {
            await window.__lottaApi.setResult(id, round, board, { resultType: type })
            const api = window.__lottaApi as unknown as {
              getRound: (id: number, r: number) => Promise<RoundDto>
            }
            const r = await api.getRound(id, round)
            return r.games.find((g) => g.boardNr === board)!
          },
          { id: TOURNAMENT_ID, round: 3, board: probeBoard, type },
        )
        note(
          `  ${type.padEnd(15)} → ${probeGame.whiteScore}-${probeGame.blackScore} display="${probeGame.resultDisplay}" type=${probeGame.resultType}`,
        )
      } catch (e) {
        finding('result-cycle', 'bug', `setResult ${type} threw: ${(e as Error).message}`)
      }
    }

    // --- PROBE 3: postponed game in r3 — does pairing r4 still work? ---
    note('\n=== Probe 3: leave one POSTPONED in r3, fill rest, pair r4 ===')
    try {
      const round = 3
      // Leave probeBoard as POSTPONED, set rest to alternating results
      await page.evaluate(
        async ({ id, round, leaveBoard }) => {
          await window.__lottaApi.setResult(id, round, leaveBoard, { resultType: 'POSTPONED' })
        },
        { id: TOURNAMENT_ID, round, leaveBoard: probeBoard },
      )
      const filled = await page.evaluate(
        async ({ id, round, skip }) => {
          const api = window.__lottaApi as unknown as {
            getRound: (id: number, r: number) => Promise<RoundDto>
          }
          const r = await api.getRound(id, round)
          let count = 0
          for (const g of r.games) {
            if (g.boardNr === skip) continue
            if (g.resultType !== 'NO_RESULT' && g.resultType !== 'WHITE_WIN_WO') {
              continue // skip already-set (incl bye)
            }
            await window.__lottaApi.setResult(id, round, g.boardNr, {
              resultType: g.boardNr % 2 === 0 ? 'WHITE_WIN' : 'BLACK_WIN',
            })
            count++
          }
          return count
        },
        { id: TOURNAMENT_ID, round, skip: probeBoard },
      )
      note(`  filled ${filled} other boards`)

      const r4 = await page.evaluate((id) => window.__lottaApi.pairNextRound(id), TOURNAMENT_ID)
      note(`  r4 paired ${r4.games.length} games — postponed in r3 did NOT block pairing ✓`)

      // Are the two postponed players paired with each other in r4?
      const r3Postponed = await page.evaluate(
        ({ id, board }) => {
          const api = window.__lottaApi as unknown as {
            getRound: (id: number, r: number) => Promise<RoundDto>
          }
          return api.getRound(id, 3).then((r) => r.games.find((g) => g.boardNr === board))
        },
        { id: TOURNAMENT_ID, board: probeBoard },
      )
      const wId = r3Postponed!.whitePlayer!.id
      const bId = r3Postponed!.blackPlayer!.id
      const r4PairOfWhite = r4.games.find(
        (g) => g.whitePlayer?.id === wId || g.blackPlayer?.id === wId,
      )
      const r4OppOfWhite =
        r4PairOfWhite?.whitePlayer?.id === wId
          ? r4PairOfWhite?.blackPlayer?.id
          : r4PairOfWhite?.whitePlayer?.id
      if (r4OppOfWhite === bId) {
        finding(
          'postponed-rematch',
          'warn',
          `postponed r3 pair (W:${wId} vs B:${bId}) was paired AGAIN in r4 — Monrad treated postponement as no-history`,
        )
      } else {
        note(`  postponed players got fresh opponents in r4 ✓`)
      }
    } catch (e) {
      finding('postponed', 'bug', `flow threw: ${(e as Error).message}`)
    }

    // --- PROBE 4: chess4 standings formula sanity ---
    note('\n=== Probe 4: chess4 club formula = round((40/max(10, lagstorlek)) × poäng) ===')
    try {
      const c4 = await page.evaluate(
        (id) => window.__lottaApi.getChess4Standings(id),
        TOURNAMENT_ID,
      )
      const cs = await page.evaluate((id) => window.__lottaApi.getClubStandings(id), TOURNAMENT_ID)
      const csByClub = new Map(cs.map((c) => [c.club, c.score]))
      let mismatches = 0
      for (const e of c4.slice(0, 20)) {
        const points = csByClub.get(e.club) ?? 0
        const expected = Math.round((40 / Math.max(10, e.chess4Members)) * points)
        if (expected !== e.score) {
          mismatches++
          finding(
            'chess4-formula',
            'bug',
            `${e.club}: expected ${expected}, got ${e.score} (members=${e.chess4Members}, points=${points})`,
          )
        }
      }
      if (mismatches === 0) note(`  formula matches for top 20 clubs ✓`)
    } catch (e) {
      finding('chess4-formula', 'bug', `threw: ${(e as Error).message}`)
    }

    // --- PROBE 5: out-of-range round navigation ---
    note('\n=== Probe 5: navigate to standings round=999 ===')
    try {
      await page.goto(`/?tournamentId=${TOURNAMENT_ID}&tab=standings&round=999`, {
        waitUntil: 'domcontentloaded',
      })
      await page.waitForFunction(() => window.__lottaApi != null, null, { timeout: 30_000 })
      await page.waitForTimeout(1500)
      const tableRows = await page.locator('table tbody tr').count()
      note(`  loaded — ${tableRows} table rows (page didn't crash; route appears to clamp)`)
    } catch (e) {
      finding('round-oob', 'warn', `nav threw: ${(e as Error).message}`)
    }

    // --- PROBE 5b: postponed scoring in standings (3-3 pairing vs 0-0 actual) ---
    note('\n=== Probe 5b: standings should NOT count POSTPONED 3-3 toward player score ===')
    try {
      const probe = await page.evaluate(
        async ({ id, round, board }) => {
          await window.__lottaApi.setResult(id, round, board, { resultType: 'POSTPONED' })
          const api = window.__lottaApi as unknown as {
            getRound: (id: number, r: number) => Promise<RoundDto>
          }
          const r = await api.getRound(id, round)
          const g = r.games.find((g) => g.boardNr === board)!
          const wId = g.whitePlayer!.id
          const bId = g.blackPlayer!.id
          const standings = await window.__lottaApi.getStandings(id, round)
          const allPlayers = await (
            window.__lottaApi as unknown as {
              listTournamentPlayers: (
                id: number,
              ) => Promise<Array<{ id: number; firstName: string; lastName: string }>>
            }
          ).listTournamentPlayers(id)
          const wName = allPlayers.find((p) => p.id === wId)
          const bName = allPlayers.find((p) => p.id === bId)
          const w = standings.find((s) => s.name.includes(wName!.lastName))
          const b = standings.find((s) => s.name.includes(bName!.lastName))
          return { game: { wScore: g.whiteScore, bScore: g.blackScore }, w, b }
        },
        { id: TOURNAMENT_ID, round: 3, board: probeBoard },
      )
      note(
        `  game pairing-scores: ${probe.game.wScore}-${probe.game.bScore}; standings: white="${probe.w?.name}" pts=${probe.w?.score}, black="${probe.b?.name}" pts=${probe.b?.score}`,
      )
      // Sanity: player's standings score for the postponed round should not include the 3 pairing-points.
      // We can't compare vs ground truth here without re-summing, so we just print to inspect.
    } catch (e) {
      finding('postponed-scoring', 'bug', `threw: ${(e as Error).message}`)
    }

    // --- PROBE 5c: try to pair beyond the configured last round ---
    note('\n=== Probe 5c: pair past nrOfRounds — should error or noop ===')
    try {
      const { configured, paired, error } = await page.evaluate(async (id) => {
        const t = await window.__lottaApi.getTournament(id)
        const configuredRounds = (t as { nrOfRounds: number }).nrOfRounds
        // Set nrOfRounds to current roundsPlayed so the next pair would exceed it.
        const api = window.__lottaApi as unknown as {
          listRounds: (id: number) => Promise<RoundDto[]>
        }
        const rs = await api.listRounds(id)
        const played = rs.length
        await window.__lottaApi.updateTournament(id, { ...t, nrOfRounds: played })
        let paired = false
        let error: string | null = null
        try {
          await window.__lottaApi.pairNextRound(id)
          paired = true
        } catch (e) {
          error = (e as Error).message
        }
        // restore
        await window.__lottaApi.updateTournament(id, { ...t, nrOfRounds: configuredRounds })
        return { configured: configuredRounds, paired, error }
      }, TOURNAMENT_ID)
      if (paired) {
        finding(
          'pair-past-end',
          'bug',
          `pairNextRound succeeded past nrOfRounds (configured=${configured}); should refuse`,
        )
      } else {
        note(`  refused with: ${error ?? '(unknown)'} ✓`)
      }
    } catch (e) {
      finding('pair-past-end', 'warn', `threw: ${(e as Error).message}`)
    }

    // --- PROBE 5d: result persistence across full reload ---
    note('\n=== Probe 5d: set a result, reload, confirm it persisted to IndexedDB ===')
    try {
      const SENTINEL_BOARD = probeBoard
      await page.evaluate(
        ({ id, round, board }) =>
          window.__lottaApi.setResult(id, round, board, { resultType: 'WHITE_WIN_WO' }),
        { id: TOURNAMENT_ID, round: 3, board: SENTINEL_BOARD },
      )
      await page.reload()
      await page.waitForFunction(() => window.__lottaApi != null, null, { timeout: 30_000 })
      const after = await page.evaluate(
        ({ id, round, board }) => {
          const api = window.__lottaApi as unknown as {
            getRound: (id: number, r: number) => Promise<RoundDto>
          }
          return api.getRound(id, round).then((r) => r.games.find((g) => g.boardNr === board))
        },
        { id: TOURNAMENT_ID, round: 3, board: SENTINEL_BOARD },
      )
      if (after?.resultType !== 'WHITE_WIN_WO') {
        finding(
          'persistence',
          'bug',
          `expected WHITE_WIN_WO after reload, got ${after?.resultType}`,
        )
      } else {
        note(`  result survived full reload as ${after.resultType} (${after.resultDisplay}) ✓`)
      }
    } catch (e) {
      finding('persistence', 'bug', `threw: ${(e as Error).message}`)
    }

    // --- PROBE 6: rapid tournament switch ---
    note('\n=== Probe 6: rapid switch between all 4 tournaments ===')
    try {
      for (let i = 0; i < 12; i++) {
        const id = (i % 4) + 1
        await page.goto(`/?tournamentId=${id}&tab=standings`, { waitUntil: 'domcontentloaded' })
      }
      // Settle: wait for the API to re-attach after the last navigation.
      await page.waitForFunction(() => window.__lottaApi != null, null, { timeout: 30_000 })
      // Confirm DB still answers a basic query.
      const sanityCount = await page.evaluate(() =>
        window.__lottaApi.listTournaments().then((ts) => ts.length),
      )
      note(`  12 rapid switches survived; listTournaments returned ${sanityCount} ✓`)
    } catch (e) {
      finding('rapid-switch', 'bug', `threw: ${(e as Error).message}`)
    }

    // --- PROBE 7: cross-table render time for 118 players ---
    note('\n=== Probe 7: cross-table render time for 118 players ===')
    try {
      const { html, ms } = await page.evaluate(async (id) => {
        const t0 = performance.now()
        const blob = await window.__lottaApi.publishHtml(id, 'cross-table')
        const text = await blob.text()
        return { html: text, ms: Math.round(performance.now() - t0) }
      }, TOURNAMENT_ID)
      writeFileSync(join(outDir, 'cross-table.html'), html, 'utf-8')
      note(`  rendered ${html.length} bytes in ${ms}ms`)
      if (ms > 2000) finding('cross-table-perf', 'warn', `slow: ${ms}ms for 118 players`)
    } catch (e) {
      finding('cross-table', 'bug', `threw: ${(e as Error).message}`)
    }

    // --- PROBE 8: unpair last round (Ångra lottning) — does it discard results? ---
    note('\n=== Probe 8: unpair r4, then re-pair, see what r3 results survived ===')
    try {
      await page.evaluate((id) => window.__lottaApi.unpairLastRound(id), TOURNAMENT_ID)
      const after = await page.evaluate(
        ({ id }) => {
          const api = window.__lottaApi as unknown as {
            listRounds: (id: number) => Promise<RoundDto[]>
          }
          return api.listRounds(id)
        },
        { id: TOURNAMENT_ID },
      )
      note(`  rounds remaining after unpair: ${after.length}`)
      // Re-pair r4
      const newR4 = await page.evaluate((id) => window.__lottaApi.pairNextRound(id), TOURNAMENT_ID)
      note(`  re-paired r${newR4.roundNr} with ${newR4.games.length} games`)
      // Are r3 results intact?
      const r3After = await page.evaluate(
        ({ id }) => {
          const api = window.__lottaApi as unknown as {
            getRound: (id: number, r: number) => Promise<RoundDto>
          }
          return api.getRound(id, 3)
        },
        { id: TOURNAMENT_ID },
      )
      const r3Decided = r3After.games.filter((g) => g.resultType !== 'NO_RESULT').length
      note(`  r3 still has ${r3Decided}/${r3After.games.length} decided games ✓`)
    } catch (e) {
      finding('unpair', 'bug', `threw: ${(e as Error).message}`)
    }

    await context.close()

    // --- summary ---
    const summary = findings
      .map((f) => `[${f.severity.toUpperCase()}] ${f.probe}: ${f.detail}`)
      .join('\n')
    writeFileSync(join(outDir, 'findings.txt'), summary || '(no findings)\n', 'utf-8')
    note(`\n=== Summary: ${findings.length} findings, see ${outDir}/findings.txt ===`)
    note(summary || '(clean run)')
  })
})
