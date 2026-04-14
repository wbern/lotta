/* eslint local/no-class-locators: "off" -- structural traversal (.context-menu) */

import { type Page } from '@playwright/test'
import { type ChildProcess, fork, spawn } from 'child_process'
import { resolve } from 'path'
import { expect, test } from './fixtures'

// ── JS-based UI helpers ────────────────────────────────────────────────────
// BrowserStack's CDP proxy hangs on native Playwright actions (click,
// selectOption, scrollIntoViewIfNeeded) AND on page.waitForTimeout() for real
// mobile devices. All referee interactions use page.evaluate() instead, which
// goes through Runtime.evaluate and works reliably.

/** In-browser delay — avoids CDP-level waitForTimeout which can hang */
async function jsDelay(page: Page, ms: number) {
  await page.evaluate((t) => new Promise((r) => setTimeout(r, t)), ms)
}

async function jsClick(page: Page, selector: string) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement | null
    el?.click()
  }, selector)
  await jsDelay(page, 300)
}

async function jsClickByText(page: Page, selector: string, text: string) {
  await page.evaluate(
    ({ sel, txt }) => {
      const els = document.querySelectorAll(sel)
      for (const el of els) {
        if (el.textContent?.includes(txt)) {
          ;(el as HTMLElement).click()
          return
        }
      }
    },
    { sel: selector, txt: text },
  )
  await jsDelay(page, 300)
}

async function jsSelect(page: Page, testId: string, optionText: string, nth = 0) {
  await page.evaluate(
    ({ tid, txt, n }) => {
      const selects = document.querySelectorAll(
        `[data-testid="${tid}"] select`,
      ) as NodeListOf<HTMLSelectElement>
      const select = selects[n]
      if (!select) return
      const opt = Array.from(select.options).find((o) => o.text.includes(txt))
      if (opt) {
        select.value = opt.value
        select.dispatchEvent(new Event('change', { bubbles: true }))
      }
    },
    { tid: testId, txt: optionText, n: nth },
  )
  await jsDelay(page, 300)
}

async function enterResult(page: Page, boardNr: number, resultText: string) {
  // Wait for the dropdown to be in the DOM before clicking
  await page
    .getByTestId(`result-dropdown-${boardNr}`)
    .waitFor({ state: 'visible', timeout: 10_000 })
  await jsClick(page, `[data-testid="result-dropdown-${boardNr}"]`)
  await jsDelay(page, 500)
  // Retry click if context menu didn't open (can happen during React re-renders)
  const menuVisible = await page
    .locator('.context-menu')
    .isVisible()
    .catch(() => false)
  if (!menuVisible) {
    await jsClick(page, `[data-testid="result-dropdown-${boardNr}"]`)
    await jsDelay(page, 500)
  }
  await page.locator('.context-menu').waitFor({ state: 'visible', timeout: 10_000 })
  await jsClickByText(page, '.context-menu button', resultText)
  await jsDelay(page, 500)
}

async function dismissBanner(page: Page) {
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button')
    for (const b of btns) {
      if (b.textContent?.trim() === 'OK') {
        b.click()
        return
      }
    }
  })
  await jsDelay(page, 300)
}

// ── Worker IPC helper ───────────────────────────────────────────────────────

function sendCommand(
  worker: ChildProcess,
  msg: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      worker.off('message', handler)
      reject(new Error(`Worker command timed out: ${String(msg.type)}`))
    }, 60_000)

    function handler(response: Record<string, unknown>) {
      clearTimeout(timeout)
      worker.off('message', handler)
      if (response.type === 'error') reject(new Error(response.message as string))
      else resolve(response)
    }

    worker.on('message', handler)
    worker.send(msg)
  })
}

// ── ngrok tunnel helper ─────────────────────────────────────────────────────

interface NgrokTunnel {
  process: ChildProcess
  publicUrl: string
}

async function startNgrok(port: number): Promise<NgrokTunnel> {
  const ngrok = spawn('ngrok', ['http', `https://localhost:${port}`], {
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: false,
  })

  ngrok.stderr?.on('data', (d: Buffer) => console.log(`[ngrok:err] ${d.toString().trim()}`))

  const deadline = Date.now() + 15_000
  let publicUrl = ''
  while (Date.now() < deadline) {
    try {
      const res = await fetch('http://127.0.0.1:4040/api/tunnels')
      const data = (await res.json()) as { tunnels: { public_url: string }[] }
      const tunnel = data.tunnels.find((t) => t.public_url.startsWith('https://'))
      if (tunnel) {
        publicUrl = tunnel.public_url
        break
      }
    } catch {
      // ngrok not ready yet
    }
    await new Promise((r) => setTimeout(r, 500))
  }

  if (!publicUrl) {
    ngrok.kill()
    throw new Error('ngrok failed to start within 15s')
  }

  // Verify tunnel works locally before sending BrowserStack device to it
  const verify = await fetch(publicUrl, {
    headers: { 'ngrok-skip-browser-warning': 'true' },
  }).catch((e: Error) => e)
  if (verify instanceof Error) {
    ngrok.kill()
    throw new Error(`ngrok tunnel unreachable locally: ${verify.message}`)
  }
  console.log(
    `[ngrok] Tunnel verified (${verify.status}): ${publicUrl} → https://localhost:${port}`,
  )

  return { process: ngrok, publicUrl }
}

function stopNgrok(tunnel: NgrokTunnel) {
  try {
    tunnel.process.kill()
  } catch {
    // already dead
  }
}

// ── Test ────────────────────────────────────────────────────────────────────

test.describe('BrowserStack P2P', () => {
  test.setTimeout(180_000)

  test('referee syncs results with organizer via P2P', async ({ browser }) => {
    const ngrok = await startNgrok(5174)

    const worker = fork(resolve('e2e/bs-organizer-worker.mjs'), [], {
      stdio: ['pipe', 'inherit', 'inherit', 'ipc'],
    })

    try {
      const { shareUrl } = await new Promise<{ shareUrl: string; tid: number }>(
        (resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Organizer setup timed out')), 60_000)
          worker.on('message', (msg: Record<string, unknown>) => {
            if (msg.type === 'ready') {
              clearTimeout(timeout)
              resolve(msg as unknown as { shareUrl: string; tid: number })
            }
            if (msg.type === 'error') {
              clearTimeout(timeout)
              reject(new Error(msg.message as string))
            }
          })
          worker.on('exit', (code) => {
            if (code !== 0) {
              clearTimeout(timeout)
              reject(new Error(`Worker exited with code ${code}`))
            }
          })
        },
      )

      // Rewrite share URL: replace localhost with ngrok public URL
      const refShareUrl = shareUrl.replace(/https?:\/\/localhost:\d+/, ngrok.publicUrl)
      console.log(`[BS] Organizer share URL: ${shareUrl}`)
      console.log(`[BS] Referee ngrok URL:   ${refShareUrl}`)

      // ── BrowserStack referee (real device) ────────────────────────────
      // Note: extraHTTPHeaders not used — unsupported on iOS/Safari via BrowserStack.
      // The ngrok interstitial is handled below via JS click.
      const refContext = await browser.newContext({
        ignoreHTTPSErrors: true,
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      })
      const refPage = await refContext.newPage()

      await refPage.goto(refShareUrl, { timeout: 60_000 })

      // ngrok free tier shows an interstitial — click through via JS
      // (native Playwright click hangs on BrowserStack's CDP proxy)
      const clicked = await refPage.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find((b) =>
          b.textContent?.includes('Visit Site'),
        )
        if (btn) {
          btn.click()
          return true
        }
        return false
      })
      if (clicked) {
        console.log('[BS] Clicked through ngrok interstitial, waiting for app...')
        await refPage.waitForFunction(() => document.title === 'Lotta', undefined, {
          timeout: 30_000,
        })
      }

      const title = await refPage.title()
      console.log(`[BS] Page loaded: "${title}"`)

      // Wait for P2P connection — tournament data syncs via MQTT + WebRTC
      console.log('[BS] Waiting for P2P connection...')
      await expect(
        refPage
          .getByTestId('tournament-selector')
          .locator('option', { hasText: 'BrowserStack-test' }),
      ).toBeAttached({ timeout: 120_000 })
      console.log('[BS] P2P connected — tournament data received')
      console.log('[BS] Dismissing banner...')
      await dismissBanner(refPage)
      console.log('[BS] Banner dismissed')
      // Select tournament and navigate to pairings
      console.log('[BS] Selecting tournament...')
      await jsSelect(refPage, 'tournament-selector', 'BrowserStack-test', 0)
      console.log('[BS] Tournament selected, clicking pairings tab...')
      await jsClickByText(refPage, '[data-testid="tab-headers"] *', 'Lottning & resultat')
      console.log('[BS] Pairings tab clicked, waiting for data table...')
      await expect(refPage.getByTestId('data-table')).toBeVisible({ timeout: 30_000 })
      console.log('[BS] Pairings tab visible')
      // ════════════════════════════════════════════════════════════════
      // ROUND 1: Host enters board 1, referee enters board 2
      // ════════════════════════════════════════════════════════════════

      // Host enters board 1: Vit vinst (1-0)
      console.log('[BS] R1: Host entering board 1...')
      await sendCommand(worker, { type: 'enter-result', boardNr: 1, resultText: 'Vit vinst' })
      console.log('[BS] R1: Host entered board 1, waiting for sync...')

      // Referee sees host's result synced
      await expect(refPage.getByTestId('data-table').locator('tbody tr').first()).toContainText(
        '1-0',
        { timeout: 30_000 },
      )
      console.log('[BS] R1: Referee sees board 1 synced (1-0)')

      // Small delay to let React re-render settle after sync
      await jsDelay(refPage, 1000)

      // Referee enters board 2: Svart vinst (0-1)
      console.log('[BS] R1: Referee entering board 2...')
      await enterResult(refPage, 2, 'Svart vinst')
      console.log('[BS] R1: Referee entered board 2')

      // Verify host received referee's result
      console.log('[BS] R1: Checking host received results...')
      const r1 = await sendCommand(worker, {
        type: 'check-results',
        roundNr: 1,
        expectedCount: 2,
      })
      expect(r1.count).toBe(2)
      console.log('[BS] Round 1 complete — bidirectional P2P sync verified')

      await refPage.close()
      await refContext.close()
    } finally {
      try {
        worker.send({ type: 'shutdown' })
        await new Promise<void>((resolve) => {
          const t = setTimeout(() => {
            worker.kill()
            resolve()
          }, 5000)
          worker.on('exit', () => {
            clearTimeout(t)
            resolve()
          })
        })
      } catch {
        worker.kill()
      }
      stopNgrok(ngrok)
    }
  })
})
