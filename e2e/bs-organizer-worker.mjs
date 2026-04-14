/* eslint-disable */
// Standalone organizer process — runs outside BrowserStack SDK scope.
// Launched via child_process.fork() from browserstack-p2p.spec.ts.
import { chromium } from '@playwright/test'

const P2P_BASE = 'https://localhost:5174'
const PLAYERS = [
  { lastName: 'Eriksson', firstName: 'Anna', ratingI: 1800 },
  { lastName: 'Svensson', firstName: 'Erik', ratingI: 1700 },
  { lastName: 'Johansson', firstName: 'Karin', ratingI: 1600 },
  { lastName: 'Karlsson', firstName: 'Lars', ratingI: 1500 },
]

async function main() {
  const browser = await chromium.launch({
    args: ['--disable-features=WebRtcHideLocalIpsWithMdns', '--no-sandbox'],
  })

  const ctx = await browser.newContext({
    ignoreHTTPSErrors: true,
    recordVideo: { dir: 'test-results/browserstack-p2p-organizer/' },
  })
  const page = await ctx.newPage()

  await page.goto(P2P_BASE)
  await page.waitForFunction(() => window.__lottaApi != null, undefined, {
    timeout: 30_000,
  })

  // Create tournament and pair round 1 via in-browser API
  const tid = await page.evaluate(async (players) => {
    const api = window.__lottaApi
    const t = await api.createTournament({
      name: 'BrowserStack-test',
      pairingSystem: 'Monrad',
      initialPairing: 'Rating',
      nrOfRounds: 3,
      barredPairing: false,
      compensateWeakPlayerPP: false,
      pointsPerGame: 1,
      chess4: false,
      ratingChoice: 'ELO',
      showELO: true,
      showGroup: false,
      group: 'Snapshot',
    })
    for (const p of players) {
      await api.addTournamentPlayer(t.id, {
        firstName: p.firstName,
        lastName: p.lastName,
        ratingI: p.ratingI || 0,
        ratingN: 0,
        ratingQ: 0,
        ratingB: 0,
        ratingK: 0,
        ratingKQ: 0,
        ratingKB: 0,
        clubIndex: 0,
        title: '',
        sex: '',
        federation: 'SWE',
        fideId: 0,
        ssfId: 0,
        playerGroup: '',
        withdrawnFromRound: -1,
        manualTiebreak: 0,
        birthdate: '',
      })
    }
    await api.pairNextRound(t.id, true)
    return t.id
  }, PLAYERS)

  // Reload to pick up tournament in UI
  await page.reload()
  await page.waitForFunction(() => window.__lottaApi != null, undefined, {
    timeout: 30_000,
  })

  // Select tournament
  const sel = page.getByTestId('tournament-selector').locator('select').first()
  await sel.locator('option', { hasText: 'BrowserStack-test' }).waitFor({ state: 'attached' })
  await sel.selectOption('BrowserStack-test')
  await page.getByTestId('data-table').waitFor({ state: 'visible' })

  // Start Live hosting
  await page.getByTestId('tab-headers').getByText('Live (Beta)').click()
  await page.locator('.live-tab-container').waitFor({ state: 'visible' })
  await page.locator('button', { hasText: 'Starta Live' }).click()
  await page.locator('.live-tab-hosting').waitFor({ state: 'visible' })

  // Extract referee share URL from "Dela vy" subtab
  await page.getByRole('tab', { name: 'Dela vy' }).click()
  const refUrlEl = page.getByTestId('vydelning-url')
  await refUrlEl.waitFor({ state: 'visible' })
  const shareUrl = await refUrlEl.textContent()

  // Navigate to pairings tab (ready for result entry)
  await page.getByTestId('tab-headers').getByText('Lottning & resultat').click()
  await page.getByTestId('data-table').waitFor({ state: 'visible' })

  process.send({ type: 'ready', shareUrl, tid })

  // ── IPC command handler ─────────────────────────────────────────────
  process.on('message', async (msg) => {
    try {
      switch (msg.type) {
        case 'enter-result': {
          const btn = page.getByTestId(`result-dropdown-${msg.boardNr}`)
          await btn.scrollIntoViewIfNeeded()
          await btn.click()
          await page.waitForTimeout(500)
          const menu = page.locator('.context-menu')
          await menu.waitFor({ state: 'visible' })
          await menu.getByText(msg.resultText).first().click()
          await page.waitForTimeout(500)
          process.send({ type: 'result-entered' })
          break
        }

        case 'pair-round': {
          await page.getByTestId('menu-bar').getByRole('button', { name: 'Lotta' }).click()
          await page.waitForTimeout(500)
          await page.getByRole('button', { name: 'Lotta nästa rond' }).click()
          await page.waitForTimeout(1500)
          process.send({ type: 'round-paired' })
          break
        }

        case 'select-round': {
          const roundSel = page.getByTestId('tournament-selector').locator('select').nth(2)
          await roundSel
            .locator('option', { hasText: `Rond ${msg.roundNr}` })
            .waitFor({ state: 'attached', timeout: 30_000 })
          await roundSel.selectOption({ label: `Rond ${msg.roundNr}` })
          await page.waitForTimeout(500)
          process.send({ type: 'round-selected' })
          break
        }

        case 'check-results': {
          let count = 0
          const deadline = Date.now() + 30_000
          while (Date.now() < deadline) {
            count = await page.evaluate(
              async ({ tid, roundNr }) => {
                const api = window.__lottaApi
                const round = await api.getRound(tid, roundNr)
                return round.games.filter(
                  (g) => g.whitePlayer && g.blackPlayer && g.resultType !== 'NO_RESULT',
                ).length
              },
              { tid, roundNr: msg.roundNr },
            )
            if (count >= (msg.expectedCount || 0)) break
            await new Promise((r) => setTimeout(r, 1000))
          }
          process.send({ type: 'results-checked', count })
          break
        }

        case 'shutdown': {
          await ctx.close()
          await browser.close()
          process.exit(0)
        }
      }
    } catch (err) {
      process.send({ type: 'error', message: err.message })
    }
  })
}

main().catch((err) => {
  console.error('Organizer worker error:', err)
  process.send?.({ type: 'error', message: err.message })
  process.exit(1)
})
