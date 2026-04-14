/* eslint local/no-class-locators: "off" -- structural traversal (.live-tab-*, .spectator-*, .context-menu) */
/* eslint no-restricted-syntax: "off" -- demo video needs waitForTimeout for pacing */

import type { Locator, Page } from '@playwright/test'
import {
  type ApiClient,
  apiClient,
  createTournament,
  ensureClubs,
  fetchStandings,
  type PlayerInput,
  pairRound,
  waitForApi,
} from './api-helpers'
import { expect, test } from './fixtures'

// ---------------------------------------------------------------------------
// Two clubs, 12 players — 6 per club, giving 6 boards per round initially
// ---------------------------------------------------------------------------
const CLUBS = [{ name: 'Skara SK' }, { name: 'Lidk\u00f6ping SS' }]

const PLAYERS: PlayerInput[] = [
  // Skara SK (indices 0–5, clubIndex set after ensureClubs)
  { lastName: 'Eriksson', firstName: 'Anna', ratingI: 1900, clubIndex: 0 },
  { lastName: 'Lindberg', firstName: 'Magnus', ratingI: 1780, clubIndex: 0 },
  { lastName: 'Svensson', firstName: 'Karin', ratingI: 1650, clubIndex: 0 },
  { lastName: '\u00d6berg', firstName: 'Sofia', ratingI: 1520, clubIndex: 0 },
  { lastName: 'Fransson', firstName: 'David', ratingI: 1440, clubIndex: 0 },
  { lastName: 'Bj\u00f6rk', firstName: 'Lena', ratingI: 1380, clubIndex: 0 },
  // Lidk\u00f6ping SS (indices 6–11)
  { lastName: 'Johansson', firstName: 'Erik', ratingI: 1850, clubIndex: 0 },
  { lastName: 'Nilsson', firstName: 'Karl', ratingI: 1720, clubIndex: 0 },
  { lastName: 'Pettersson', firstName: 'Lena', ratingI: 1600, clubIndex: 0 },
  { lastName: 'Karlsson', firstName: 'Oskar', ratingI: 1490, clubIndex: 0 },
  { lastName: 'Andersson', firstName: 'Maria', ratingI: 1410, clubIndex: 0 },
  { lastName: 'Holm', firstName: 'Tobias', ratingI: 1350, clubIndex: 0 },
]

// ---------------------------------------------------------------------------
// Grid helpers (reused from delning.spec.ts)
// ---------------------------------------------------------------------------

function cursorScript(): string {
  return `(() => {
  const style = document.createElement('style');
  style.textContent = \`
    #pw-cursor {
      position: fixed;
      pointer-events: none;
      z-index: 2147483647;
      display: none;
    }
    #pw-cursor.pressing { transform: scale(0.85); }
  \`;
  document.addEventListener('DOMContentLoaded', () => {
    document.head.appendChild(style);
    const c = document.createElement('div');
    c.id = 'pw-cursor';
    c.innerHTML = '<svg width="28" height="32" viewBox="0 0 28 32" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M5 4L5 26L10.5 20.5L15.5 29L19 27L14 18.5L21 17.5L5 4Z" fill="white" stroke="#222" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round"/>' +
      '</svg>';
    document.body.appendChild(c);
    document.addEventListener('mousemove', e => {
      c.style.display = 'block';
      c.style.left = e.clientX + 'px';
      c.style.top = e.clientY + 'px';
    });
    document.addEventListener('mousedown', () => c.classList.add('pressing'));
    document.addEventListener('mouseup', () => {
      setTimeout(() => c.classList.remove('pressing'), 120);
    });
  });
})()`
}

function desktopLogo(size: number): string {
  return `<svg viewBox="0 0 32 32" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <g transform="rotate(-6 16 16)">
    <rect x="2" y="2" width="12" height="11" rx="2" fill="#4ec3f0" transform="rotate(2 8 7.5)"/>
    <rect x="17" y="2" width="13" height="10" rx="2" fill="#5bd46a" transform="rotate(-1 23 7)"/>
    <rect x="3" y="16" width="11" height="13" rx="2" fill="#f7c948" transform="rotate(1 8.5 22.5)"/>
    <rect x="17" y="17" width="13" height="12" rx="2" fill="#f06050" transform="rotate(-3 23.5 23)"/>
  </g>
</svg>`
}

function phoneLogo(size: number): string {
  return `<svg viewBox="0 0 32 32" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <circle cx="15" cy="18" r="11" fill="#f7941d" />
  <circle cx="24" cy="11" r="5.5" fill="#111" />
  <path d="M15 7 Q17 1 20 3" stroke="#3d7a33" stroke-width="2" fill="none" stroke-linecap="round"/>
  <ellipse cx="18" cy="3" rx="3" ry="1.8" fill="#6abf5e" transform="rotate(25 18 3)" />
</svg>`
}

const DEVICE_COLORS = [
  { bg: '#1a3a2a', text: '#7dcea0', arrow: '#1a3a2a' }, // host: green
  { bg: '#1e2d4a', text: '#7cb3f0', arrow: '#1e2d4a' }, // referee: blue
  { bg: '#3a1e4a', text: '#c49df0', arrow: '#3a1e4a' }, // spectator: purple
]

function generateGridHtml(): string {
  const panels = [
    { id: 'host', type: 'desktop' as const },
    { id: 'referee', type: 'mobile' as const },
    { id: 'spectator', type: 'mobile' as const },
  ]
  const phoneSizes = [80, 76]
  const panelHtml = panels
    .map((p, idx) => {
      const logo = p.type === 'desktop' ? desktopLogo(80) : phoneLogo(56)
      const color = DEVICE_COLORS[idx]
      const bubbleStyle = `background:${color.bg}; color:${color.text};`
      const bubbleArrow = `border-top-color:${color.arrow};`
      const bubble = `<div class="bubble" id="bubble-${p.id}" style="${bubbleStyle} display:none;">
        <span class="bubble-arrow" style="${bubbleArrow}"></span>
      </div>`
      if (p.type === 'desktop') {
        return `
      <div class="device desktop">
        ${bubble}
        <div class="monitor">
          <div class="screen">
            <div class="boot-logo">${logo}</div>
            <img id="${p.id}-img" />
          </div>
          <div class="chin">${desktopLogo(16)}</div>
        </div>
        <div class="neck"></div>
        <div class="foot"></div>
      </div>`
      }
      const phoneIdx = idx - 1
      const heightPct = phoneSizes[phoneIdx]
      return `
      <div class="device phone" style="height:${heightPct}%">
        ${bubble}
        <div class="shell">
          <div class="earpiece"></div>
          <div class="screen">
            <div class="boot-logo">${logo}</div>
            <img id="${p.id}-img" />
          </div>
        </div>
      </div>`
    })
    .join('\n')

  return `<!DOCTYPE html>
<html><head><title>Lotta - Tournament Lifecycle</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#e8e8ed; }
  .grid {
    display:flex; align-items:flex-end; justify-content:center;
    gap:40px; width:100vw; height:100vh; padding:40px 40px 48px;
  }
  .bubble {
    align-self: flex-start; position: relative;
    padding: 7px 16px; border-radius: 10px;
    font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    font-size: 14px; font-weight: 500; white-space: nowrap;
    margin-bottom: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    pointer-events: none;
  }
  .bubble-arrow {
    position: absolute; bottom: -7px; left: 14px;
    width: 0; height: 0;
    border-left: 7px solid transparent; border-right: 7px solid transparent;
    border-top: 7px solid;
  }
  .screen { position:relative; }
  .boot-logo {
    position:absolute; inset:0; z-index:0;
    display:flex; align-items:center; justify-content:center; background:#111;
  }
  .screen img { position:relative; z-index:1; }
  .device.desktop {
    flex:3; height:100%; display:flex; flex-direction:column;
    align-items:center; justify-content:flex-end;
  }
  .device.desktop .monitor {
    width:100%; max-height:100%; display:flex; flex-direction:column;
    background: linear-gradient(170deg, #303035 0%, #1c1c1e 100%);
    border-radius: 12px; border: 2px solid #48484a;
    box-shadow: 0 12px 40px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2),
      inset 0 1px 0 rgba(255,255,255,0.08);
    padding: 10px 10px 0 10px; aspect-ratio: 16 / 10;
  }
  .device.desktop .screen {
    flex:1; min-height:0; overflow:hidden; border-radius:3px; background:#000;
  }
  .device.desktop .screen img {
    width:100%; height:100%; object-fit:contain; object-position:top center; display:block;
  }
  .device.desktop .chin {
    height:26px; display:flex; justify-content:center; align-items:center; opacity:0.6;
  }
  .device.desktop .neck {
    width:50px; height:36px;
    background: linear-gradient(180deg, #2c2c2e 0%, #232326 100%);
    border-left: 1px solid #48484a; border-right: 1px solid #48484a;
  }
  .device.desktop .foot {
    width:150px; height:8px;
    background: linear-gradient(180deg, #38383a 0%, #2c2c2e 100%);
    border-radius: 2px 2px 6px 6px;
    border: 1px solid #48484a; border-top: none;
    box-shadow: 0 3px 10px rgba(0,0,0,0.25);
  }
  .device.phone {
    display:flex; flex-direction:column; align-items:center; justify-content:flex-end;
  }
  .device.phone .shell {
    height:100%; min-height:0; aspect-ratio: 9 / 19.5;
    display:flex; flex-direction:column; align-items:center;
    background: linear-gradient(170deg, #303035 0%, #1c1c1e 100%);
    border-radius: 22px; border: 3px solid #48484a;
    box-shadow: 0 12px 40px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2),
      inset 0 1px 0 rgba(255,255,255,0.1);
    padding: 10px 4px 12px 4px; overflow: hidden;
  }
  .device.phone .earpiece {
    width:36px; height:4px; background:#58585a; border-radius:2px;
    margin-bottom:5px; flex-shrink:0;
  }
  .device.phone .screen {
    flex:1; width:100%; min-height:0; overflow:hidden; border-radius:2px; background:#000;
  }
  .device.phone .screen img {
    width:100%; height:100%; object-fit:cover; object-position:top center; display:block;
  }
</style></head>
<body><div class="grid">${panelHtml}</div></body></html>`
}

// ---------------------------------------------------------------------------
// Video compositing helpers
// ---------------------------------------------------------------------------

async function setStatus(gridPage: Page, panelId: string, text: string) {
  await gridPage.evaluate(
    ([id, t]) => {
      const el = document.getElementById(`bubble-${id}`)
      if (!el) return
      if (!t) {
        el.style.display = 'none'
        return
      }
      let textNode = el.firstChild
      if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
        textNode = document.createTextNode('')
        el.insertBefore(textNode, el.firstChild)
      }
      textNode.textContent = t
      el.style.display = ''
    },
    [panelId, text],
  )
}

let capturing = false
async function capturePages(gridPage: Page, panels: { id: string; page: Page | null }[]) {
  if (capturing) return
  capturing = true
  try {
    for (const { id, page } of panels) {
      if (!page) continue
      const buf = await page.screenshot()
      await gridPage.evaluate(
        ({ id, b64 }) => {
          const img = document.getElementById(`${id}-img`) as HTMLImageElement
          if (img) img.src = `data:image/png;base64,${b64}`
        },
        { id, b64: buf.toString('base64') },
      )
    }
  } catch {
    // Page may be navigating
  }
  capturing = false
}

async function smoothMove(page: Page, toX: number, toY: number) {
  const steps = 8
  const stepDelay = 80
  const from = await page.evaluate(() => ({
    x: (window as unknown as { __pwMouseX?: number }).__pwMouseX ?? 0,
    y: (window as unknown as { __pwMouseY?: number }).__pwMouseY ?? 0,
  }))
  for (let i = 1; i <= steps; i++) {
    const x = from.x + ((toX - from.x) * i) / steps
    const y = from.y + ((toY - from.y) * i) / steps
    await page.mouse.move(x, y)
    await page.waitForTimeout(stepDelay)
  }
  await page.evaluate(
    ({ x, y }) => {
      ;(window as unknown as { __pwMouseX: number }).__pwMouseX = x
      ;(window as unknown as { __pwMouseY: number }).__pwMouseY = y
    },
    { x: toX, y: toY },
  )
}

async function demoClick(page: Page, locator: Locator) {
  await locator.scrollIntoViewIfNeeded()
  const box = await locator.boundingBox()
  if (box) {
    await smoothMove(page, box.x + box.width / 2, box.y + box.height / 2)
    await page.waitForTimeout(200)
  }
  await locator.click()
}

async function dismissBanner(page: Page) {
  try {
    const ok = page.getByRole('button', { name: 'OK', exact: true })
    await ok.click({ timeout: 2000 })
  } catch {
    // Banner not present
  }
}

// ---------------------------------------------------------------------------
// UI interaction helpers — all mutations go through the UI
// ---------------------------------------------------------------------------

/** Enter a result via the result dropdown button on a specific board */
async function enterResult(page: Page, boardNr: number, resultText: string) {
  const btn = page.getByTestId(`result-dropdown-${boardNr}`)
  await btn.scrollIntoViewIfNeeded()
  await btn.click()
  await page.waitForTimeout(250)
  const menu = page.locator('.context-menu')
  await expect(menu).toBeVisible()
  await menu.getByText(resultText).first().click()
  await page.waitForTimeout(300)
}

/**
 * Enter results on all pending (non-bye, no-result) boards via UI.
 * Uses API reads only to identify which boards need results.
 */
async function enterPendingResults(page: Page, $: ApiClient, tid: number, roundNr: number) {
  const round = await $.get(`/api/tournaments/${tid}/rounds/${roundNr}`)
  for (const g of round.games) {
    if (!g.whitePlayer || !g.blackPlayer) continue
    if (g.resultType !== 'NO_RESULT') continue
    const result = g.boardNr % 2 === 1 ? 'Vit vinst' : 'Svart vinst'
    await enterResult(page, g.boardNr, result)
  }
}

/** Pair next round via Lotta menu */
async function pairNextRound(page: Page) {
  await page.getByTestId('menu-bar').getByRole('button', { name: 'Lotta' }).click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: 'Lotta n\u00e4sta rond' }).click()
  await page.waitForTimeout(1000)
}

/** Select a round in the tournament selector dropdown */
async function selectRound(page: Page, roundNr: number) {
  const roundSel = page.getByTestId('tournament-selector').locator('select').nth(2)
  await expect(roundSel.locator('option', { hasText: `Rond ${roundNr}` })).toBeAttached({
    timeout: 15_000,
  })
  await roundSel.selectOption({ label: `Rond ${roundNr}` })
  await page.waitForTimeout(400)
}

/** Undo via Redigera → Ångra menu */
async function undoViaMenu(page: Page) {
  await page.getByTestId('menu-bar').getByRole('button', { name: 'Redigera' }).click()
  await page.waitForTimeout(300)
  const dropdown = page.getByTestId('menu-dropdown')
  await dropdown.getByText('\u00c5ngra').click()
  await page.waitForTimeout(500)
}

/** Redo via Redigera → Gör om menu */
async function redoViaMenu(page: Page) {
  await page.getByTestId('menu-bar').getByRole('button', { name: 'Redigera' }).click()
  await page.waitForTimeout(300)
  const dropdown = page.getByTestId('menu-dropdown')
  await dropdown.getByText('G\u00f6r om').click()
  await page.waitForTimeout(500)
}

/** Withdraw a player via Spelare → Turneringsspelare dialog */
async function withdrawPlayerViaUI(page: Page, playerName: string, fromRound: number) {
  await page.getByTestId('menu-bar').getByRole('button', { name: 'Spelare' }).click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: 'Turneringsspelare', exact: true }).click()
  await page.waitForTimeout(500)

  // Ensure we're on the tournament players tab (state persists across opens)
  const tpTab = page.locator('.dialog-tab', { hasText: 'Turneringsspelare' })
  await tpTab.click()
  await page.waitForTimeout(300)

  // Find and click the player row in the tournament players table
  const row = page.locator('tr', { hasText: playerName })
  await row.click()
  await page.waitForTimeout(200)

  // Switch to edit tab
  await page.getByRole('button', { name: 'Editera', exact: true }).click()
  await page.waitForTimeout(300)

  // Check withdrawal checkbox and set round
  await page.getByTestId('withdrawn-checkbox').check()
  await page.waitForTimeout(200)
  const roundInput = page.getByTestId('withdrawn-round-input')
  await roundInput.fill(String(fromRound))

  // Save and close
  await page.getByTestId('update-player').click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: 'St\u00e4ng' }).click()
  await page.waitForTimeout(300)
}

/** Wait for the spectator to show a specific round */
async function waitForSpectatorRound(spectatorPage: Page, roundNr: number) {
  await expect(spectatorPage.locator('.spectator-round')).toContainText(`Rond ${roundNr}`, {
    timeout: 20_000,
  })
}

/** Navigate to the pairings tab */
async function goToPairings(page: Page) {
  await page.getByTestId('tab-headers').getByText('Lottning & resultat').click()
  await page.waitForTimeout(300)
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

test.describe('Tournament lifecycle — 7 rounds with P2P sync', () => {
  test.setTimeout(300_000)

  test('host + referee + club spectator across 7 rounds', async ({ browser }) => {
    const baseURL = 'https://localhost:5174'

    // ── Grid page for composited video ──────────────────────────────
    const gridCtx = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      recordVideo: {
        dir: 'test-results/lifecycle-videos/',
        size: { width: 1920, height: 1080 },
      },
    })
    const gridPage = await gridCtx.newPage()
    await gridPage.setContent(generateGridHtml())

    // ── Panels ────────────────────────────────────────────────────
    const hostPanel = { id: 'host', page: null as Page | null }
    const refPanel = { id: 'referee', page: null as Page | null }
    const specPanel = { id: 'spectator', page: null as Page | null }
    const allPanels = [hostPanel, refPanel, specPanel]

    // ── Host context ──────────────────────────────────────────────
    const hostCtx = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 950, height: 850 },
      colorScheme: 'light',
    })
    const hostPage = await hostCtx.newPage()
    await hostPage.addInitScript(() => {
      localStorage.setItem('theme', 'light')
      document.documentElement.setAttribute('data-theme', 'light')
    })
    await hostPage.addInitScript(cursorScript())
    hostPanel.page = hostPage

    const captureLoop = setInterval(() => {
      void capturePages(gridPage, allPanels)
    }, 400)

    // ── Host: load app ──────────────────────────────────────────
    await setStatus(gridPage, 'host', 'Laddar appen...')
    await hostPage.goto(`${baseURL}/`)
    await waitForApi(hostPage)
    await dismissBanner(hostPage)

    // ── Host: create clubs + tournament (API OK — no P2P yet) ───
    await setStatus(gridPage, 'host', 'Skapar turnering med 12 spelare...')
    const $ = apiClient(hostPage)
    const clubIds = await ensureClubs($, CLUBS)
    const players = PLAYERS.map((p, i) => ({
      ...p,
      clubIndex: i < 6 ? clubIds[0] : clubIds[1],
    }))
    const { tid } = await createTournament(
      $,
      {
        name: 'GP V\u00e4stra G\u00f6taland 2025',
        pairingSystem: 'Monrad',
        nrOfRounds: 7,
        selectedTiebreaks: ['Buchholz', 'Vinster'],
      },
      players,
    )
    await pairRound($, tid) // Round 1 via API — no P2P connected yet

    await hostPage.reload()
    await waitForApi(hostPage)
    await dismissBanner(hostPage)

    // ── Host: select tournament ─────────────────────────────────
    await setStatus(gridPage, 'host', 'V\u00e4ljer turnering...')
    const sel = hostPage.getByTestId('tournament-selector').locator('select').first()
    await sel
      .locator('option', { hasText: 'GP V\u00e4stra G\u00f6taland' })
      .waitFor({ state: 'attached' })
    await sel.selectOption({ label: 'GP V\u00e4stra G\u00f6taland 2025' })
    await hostPage.waitForTimeout(400)

    // ── Host: start Live ────────────────────────────────────────
    await setStatus(gridPage, 'host', 'Startar Live-delning...')
    await demoClick(hostPage, hostPage.getByTestId('tab-headers').getByText('Live (Beta)'))
    await expect(hostPage.locator('.live-tab-container')).toBeVisible()
    await demoClick(hostPage, hostPage.locator('button', { hasText: 'Starta Live' }))
    await expect(hostPage.locator('.live-tab-hosting')).toBeVisible()
    await hostPage.waitForTimeout(500)

    // ── Extract referee share URL (Dela vy tab) ─────────────────
    await demoClick(hostPage, hostPage.getByRole('tab', { name: 'Dela vy' }))
    const refUrlEl = hostPage.getByTestId('vydelning-url')
    await expect(refUrlEl).toBeVisible()
    const refShareUrl = (await refUrlEl.textContent())!
    expect(refShareUrl).toContain('share=full')

    // ── Extract view URL and club code (Delning tab) ─────────
    await demoClick(hostPage, hostPage.getByRole('tab', { name: 'Delning', exact: true }))
    const viewUrlEl = hostPage.locator('.live-tab-links .live-tab-url').first()
    await expect(viewUrlEl).toBeVisible()
    const baseViewUrl = (await viewUrlEl.textContent())!
    expect(baseViewUrl).toContain('share=view')

    // Generate club code for Skara SK
    await expect(hostPage.getByTestId('club-codes')).toBeVisible()
    const skaraCheckbox = hostPage
      .locator('.live-tab-club-checkbox', { hasText: 'Skara SK' })
      .locator('input[type="checkbox"]')
    await skaraCheckbox.check()
    await expect(hostPage.getByTestId('club-code-value')).toBeVisible()
    const skaraClubCode = (await hostPage.getByTestId('club-code-value').textContent())!.replace(
      /\s/g,
      '',
    )

    // ── Host: go to pairings ────────────────────────────────────
    await goToPairings(hostPage)
    await expect(hostPage.getByTestId('data-table')).toBeVisible()

    // ── Connect referee phone ───────────────────────────────────
    async function createPhone(colorScheme: 'light' | 'dark') {
      const ctx = await browser.newContext({
        ignoreHTTPSErrors: true,
        viewport: { width: 375, height: 812 },
        colorScheme,
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      })
      const page = await ctx.newPage()
      await page.addInitScript((theme) => {
        localStorage.setItem('theme', theme)
        document.documentElement.setAttribute('data-theme', theme)
      }, colorScheme)
      return { ctx, page }
    }

    await setStatus(gridPage, 'referee', 'Domare ansluter...')
    const { ctx: refCtx, page: refPage } = await createPhone('dark')
    refPanel.page = refPage
    await refPage.goto(refShareUrl)

    // Wait for P2P connection (referee gets full app)
    await expect(
      refPage
        .getByTestId('tournament-selector')
        .locator('option', { hasText: 'GP V\u00e4stra G\u00f6taland' }),
    ).toBeAttached({ timeout: 45_000 })
    await dismissBanner(refPage)
    const refSel = refPage.getByTestId('tournament-selector').locator('select').first()
    await refSel.selectOption({ label: 'GP V\u00e4stra G\u00f6taland 2025' })
    await refPage.waitForTimeout(300)
    await refPage.getByTestId('tab-headers').getByText('Lottning & resultat').click()
    await expect(refPage.getByTestId('data-table')).toBeVisible()
    await setStatus(gridPage, 'referee', 'Domare ansluten!')

    // ── Connect spectator phone ─────────────────────────────────
    await setStatus(gridPage, 'spectator', 'Klubbtr\u00e4nare ansluter...')
    const { ctx: specCtx, page: specPage } = await createPhone('light')
    specPanel.page = specPage
    await specPage.goto(baseViewUrl)

    // Enter club code via in-app dialog
    const codeDialog = specPage.getByTestId('club-code-dialog')
    await expect(codeDialog).toBeVisible({ timeout: 45_000 })
    await specPage.getByPlaceholder('### ###').fill(skaraClubCode)
    await specPage.getByTestId('club-code-submit').click()

    await expect(specPage.getByTestId('spectator-pairings')).toBeVisible({ timeout: 45_000 })
    await expect(specPage.locator('.spectator-club-badge')).toContainText('Skara SK')
    await setStatus(gridPage, 'spectator', 'Skara SK-vy aktiv!')
    await gridPage.waitForTimeout(1000)

    // =================================================================
    // ROUND 1: "Misunderstanding" — Undo/Redo sync
    // =================================================================
    await setStatus(gridPage, 'host', 'Rond 1: Domare rapporterar...')

    // Ref enters board 1: Vit vinst
    await setStatus(gridPage, 'referee', 'Bord 1: Vit vinst')
    await enterResult(refPage, 1, 'Vit vinst')

    // Wait for sync to host
    await expect(hostPage.getByTestId('data-table').locator('tbody tr').first()).toContainText(
      '1-0',
      { timeout: 15_000 },
    )
    await setStatus(gridPage, 'host', 'Bord 1 synkat: 1-0')

    // Ref enters board 2: Svart vinst
    await setStatus(gridPage, 'referee', 'Bord 2: Svart vinst')
    await enterResult(refPage, 2, 'Svart vinst')

    await expect(hostPage.getByTestId('data-table').locator('tbody tr').nth(1)).toContainText(
      '0-1',
      { timeout: 15_000 },
    )
    await setStatus(gridPage, 'host', 'Bord 2 synkat: 0-1')
    await gridPage.waitForTimeout(500)

    // Host: "Wait, those were wrong!" — undo twice via menu
    await setStatus(gridPage, 'host', 'Fel resultat! \u00c5ngrar 2 resultat...')
    await undoViaMenu(hostPage)
    await undoViaMenu(hostPage)

    // Verify host cleared (API read — verification only)
    await expect
      .poll(async () => {
        const r = await $.get(`/api/tournaments/${tid}/rounds/1`)
        return r.games.filter((g: any) => g.resultType !== 'NO_RESULT').length
      })
      .toBe(0)
    await setStatus(gridPage, 'host', 'B\u00e5da resultat \u00e5ngrade!')

    // Redo one — re-apply board 1
    await setStatus(gridPage, 'host', 'G\u00f6r om bord 1...')
    await redoViaMenu(hostPage)

    await expect
      .poll(async () => {
        const r = await $.get(`/api/tournaments/${tid}/rounds/1`)
        return r.games.filter((g: any) => g.resultType !== 'NO_RESULT').length
      })
      .toBe(1)
    await setStatus(gridPage, 'host', 'Bord 1 \u00e5ter: 1-0, bord 2 tomt')

    // Wait for ref to see the undo effect — board 2 should be cleared
    await setStatus(gridPage, 'referee', 'V\u00e4ntar p\u00e5 synk efter \u00e5ngra...')
    await expect(refPage.getByTestId('data-table').locator('tbody tr').first()).toContainText(
      '1-0',
      { timeout: 15_000 },
    )

    // Host enters remaining results via UI
    await setStatus(gridPage, 'host', 'Anger r\u00e4tt resultat...')
    await enterPendingResults(hostPage, $, tid, 1)

    // Verify spectator sees round 1 results
    await waitForSpectatorRound(specPage, 1)
    await setStatus(gridPage, 'spectator', 'Rond 1 resultat synkade!')
    await gridPage.waitForTimeout(1000)

    // =================================================================
    // ROUND 2: Player withdrawal → bye
    // =================================================================
    await setStatus(gridPage, 'host', 'Rond 2: Tobias Holm utg\u00e5r...')
    await withdrawPlayerViaUI(hostPage, 'Holm, Tobias', 2)

    // Pair round 2 via UI menu
    await goToPairings(hostPage)
    await pairNextRound(hostPage)
    await selectRound(hostPage, 2)

    await setStatus(gridPage, 'host', '11 spelare, 1 bye. Anger resultat...')
    await enterPendingResults(hostPage, $, tid, 2)

    // Ref sees round 2
    await selectRound(refPage, 2)
    await setStatus(gridPage, 'referee', 'Rond 2 synkad!')

    // Spectator auto-updates
    await waitForSpectatorRound(specPage, 2)
    await setStatus(gridPage, 'spectator', 'Rond 2 med bye!')

    // Verify standings (API read — verification only)
    const standings2 = await fetchStandings($, tid, 2)
    expect(standings2.length).toBe(12)
    await gridPage.waitForTimeout(800)

    // =================================================================
    // ROUND 3: Another withdrawal, ref enters everything
    // =================================================================
    await setStatus(gridPage, 'host', 'Rond 3: David Fransson utg\u00e5r...')
    await withdrawPlayerViaUI(hostPage, 'Fransson, David', 3)

    await goToPairings(hostPage)
    await pairNextRound(hostPage)
    await selectRound(hostPage, 3)

    // Ref should see round 3 via P2P sync (no reload needed!)
    await selectRound(refPage, 3)
    await setStatus(gridPage, 'referee', 'Domare anger alla resultat...')

    // Ref enters all results from phone
    const round3 = await $.get(`/api/tournaments/${tid}/rounds/3`)
    const playableR3 = round3.games.filter((g: any) => g.whitePlayer && g.blackPlayer)

    for (let i = 0; i < playableR3.length; i++) {
      const resultText = i % 2 === 0 ? 'Vit vinst' : 'Svart vinst'
      await enterResult(refPage, playableR3[i].boardNr, resultText)
      await setStatus(gridPage, 'referee', `Bord ${i + 1}: ${resultText}`)
    }

    // Wait for host to see all results
    await setStatus(gridPage, 'host', 'V\u00e4ntar p\u00e5 synk fr\u00e5n domare...')
    await expect
      .poll(async () => {
        const r = await $.get(`/api/tournaments/${tid}/rounds/3`)
        return r.games.filter(
          (g: any) => g.whitePlayer && g.blackPlayer && g.resultType !== 'NO_RESULT',
        ).length
      })
      .toBe(playableR3.length)
    await setStatus(gridPage, 'host', 'Rond 3 klar!')

    // Spectator
    await waitForSpectatorRound(specPage, 3)
    await setStatus(gridPage, 'spectator', 'Rond 3 uppdaterad!')
    await gridPage.waitForTimeout(800)

    // =================================================================
    // ROUND 4: Simultaneous entry — host + ref
    // =================================================================
    await setStatus(gridPage, 'host', 'Rond 4: Parallell rapportering...')
    await pairNextRound(hostPage)
    await selectRound(hostPage, 4)

    await selectRound(refPage, 4)

    const round4 = await $.get(`/api/tournaments/${tid}/rounds/4`)
    const playableR4 = round4.games.filter((g: any) => g.whitePlayer && g.blackPlayer)

    // Host enters first 2 boards via UI
    await setStatus(gridPage, 'host', 'V\u00e4rd: bord 1-2...')
    for (let i = 0; i < Math.min(2, playableR4.length); i++) {
      await enterResult(hostPage, playableR4[i].boardNr, 'Vit vinst')
    }

    // Ref enters remaining boards from phone
    await setStatus(gridPage, 'referee', 'Domare: bord 3+...')
    for (let i = 2; i < playableR4.length; i++) {
      const resultText = i % 2 === 0 ? 'Remi' : 'Vit vinst'
      await enterResult(refPage, playableR4[i].boardNr, resultText)
    }

    // Wait for all to sync
    await expect
      .poll(async () => {
        const r = await $.get(`/api/tournaments/${tid}/rounds/4`)
        return r.games.filter(
          (g: any) => g.whitePlayer && g.blackPlayer && g.resultType !== 'NO_RESULT',
        ).length
      })
      .toBe(playableR4.length)

    await setStatus(gridPage, 'host', 'Rond 4 klar \u2014 inga konflikter!')
    await waitForSpectatorRound(specPage, 4)
    await setStatus(gridPage, 'spectator', 'Rond 4 synkad!')
    await gridPage.waitForTimeout(800)

    // =================================================================
    // ROUND 5: Wrong result correction + chat
    // =================================================================
    await setStatus(gridPage, 'host', 'Rond 5: Felrapportering + chatt...')
    await pairNextRound(hostPage)
    await selectRound(hostPage, 5)

    await selectRound(refPage, 5)

    // Ref enters wrong result on board 1
    await setStatus(gridPage, 'referee', 'Bord 1: Vit vinst (FEL!)')
    await enterResult(refPage, 1, 'Vit vinst')

    // Wait for sync to host
    await expect(hostPage.getByTestId('data-table').locator('tbody tr').first()).toContainText(
      '1-0',
      { timeout: 15_000 },
    )

    // Host corrects via undo (goes through UI → useMutation → P2P broadcast)
    await setStatus(gridPage, 'host', '\u00c5ngrar \u2014 det var svart vinst!')
    await undoViaMenu(hostPage)

    // Enter correct result via UI
    await enterResult(hostPage, 1, 'Svart vinst')

    // Wait for ref to see correction
    await expect(refPage.getByTestId('data-table').locator('tbody tr').first()).toContainText(
      '0-1',
      { timeout: 15_000 },
    )
    await setStatus(gridPage, 'referee', 'Korrigerat: 0-1!')

    // Host sends chat message
    await setStatus(gridPage, 'host', 'Skickar chattmeddelande...')
    await demoClick(hostPage, hostPage.getByTestId('tab-headers').getByText('Live (Beta)'))
    await demoClick(hostPage, hostPage.getByRole('tab', { name: 'Chatt' }))
    const chatInput = hostPage.locator('.live-chat-input input')
    await chatInput.fill('Korrigerade bord 1, det var svart vinst')
    await hostPage.locator('.live-chat-input button').click()
    await hostPage.waitForTimeout(500)

    // Verify ref sees chat (full mode)
    await setStatus(gridPage, 'referee', 'Kontrollerar chatt...')
    const chatToggle = refPage.locator('.client-chat-toggle')
    if (await chatToggle.isVisible()) {
      await chatToggle.click()
      await expect(refPage.locator('.client-chat-panel')).toContainText('Korrigerade bord 1', {
        timeout: 10_000,
      })
      await setStatus(gridPage, 'referee', 'Chattmeddelande mottaget!')
    }

    // Verify spectator does NOT have chat
    await expect(specPage.locator('.client-chat-toggle')).not.toBeVisible()
    await setStatus(gridPage, 'spectator', 'Ingen chatt i \u00e5sk\u00e5darl\u00e4ge')

    // Enter remaining results via UI
    await goToPairings(hostPage)
    await enterPendingResults(hostPage, $, tid, 5)

    await waitForSpectatorRound(specPage, 5)
    await setStatus(gridPage, 'spectator', 'Rond 5 klar!')
    await gridPage.waitForTimeout(800)

    // =================================================================
    // ROUND 6: Third withdrawal + announcement
    // =================================================================
    await setStatus(gridPage, 'host', 'Rond 6: Maria Andersson utg\u00e5r...')
    await withdrawPlayerViaUI(hostPage, 'Andersson, Maria', 6)

    await goToPairings(hostPage)
    await pairNextRound(hostPage)
    await selectRound(hostPage, 6)

    await setStatus(gridPage, 'host', '9 spelare, 4 bord + bye')
    await enterPendingResults(hostPage, $, tid, 6)

    // Send announcement
    await setStatus(gridPage, 'host', 'Skickar meddelande...')
    await demoClick(hostPage, hostPage.getByTestId('tab-headers').getByText('Live (Beta)'))
    await demoClick(hostPage, hostPage.getByRole('tab', { name: 'Delning', exact: true }))
    const announceInput = hostPage.locator('.live-tab-announce input')
    if (await announceInput.isVisible()) {
      await announceInput.fill('Rond 6 klar, en runda kvar!')
      await hostPage.locator('.live-tab-announce button').click()
      await hostPage.waitForTimeout(500)

      // Check spectator sees announcement
      await setStatus(gridPage, 'spectator', 'Meddelande mottaget!')
      const announcement = specPage.locator('.client-announcement')
      if (await announcement.isVisible({ timeout: 10_000 }).catch(() => false)) {
        await expect(announcement).toContainText('en runda kvar')
      }
    }

    await waitForSpectatorRound(specPage, 6)
    await setStatus(gridPage, 'spectator', 'Rond 6 klar!')
    await gridPage.waitForTimeout(800)

    // =================================================================
    // ROUND 7: Connection drop + recovery
    // =================================================================
    await setStatus(gridPage, 'host', 'Rond 7: Tappad anslutning!')
    await goToPairings(hostPage)
    await pairNextRound(hostPage)
    await selectRound(hostPage, 7)

    // Enter first 2 results while online — should sync normally
    await setStatus(gridPage, 'host', 'Matar in 2 resultat online...')
    const r7 = await $.get(`/api/tournaments/${tid}/rounds/${7}`)
    const r7Boards = r7.games.filter(
      (g: { whitePlayer: unknown; blackPlayer: unknown }) => g.whitePlayer && g.blackPlayer,
    )
    // Enter boards 1-2
    for (const g of r7Boards.slice(0, 2)) {
      const result = g.boardNr % 2 === 1 ? 'Vit vinst' : 'Svart vinst'
      await enterResult(hostPage, g.boardNr, result)
    }

    // Navigate ref to round 7 and wait for results
    await selectRound(refPage, 7)
    await setStatus(gridPage, 'referee', 'Verifierar synk före nertid...')
    for (const g of r7Boards.slice(0, 2)) {
      const expected = g.boardNr % 2 === 1 ? '1-0' : '0-1'
      await expect(refPage.getByTestId(`result-dropdown-${g.boardNr}`)).toContainText(expected, {
        timeout: 15_000,
      })
    }
    await setStatus(gridPage, 'referee', '2 resultat synkade!')

    // ── Host goes offline ──
    await setStatus(gridPage, 'host', '⚡ Anslutning tappad!')
    await hostCtx.setOffline(true)
    await hostPage.waitForTimeout(2000)

    // Enter board 3 result while offline (local only, no broadcast)
    if (r7Boards.length > 2) {
      await setStatus(gridPage, 'host', 'Matar in resultat offline...')
      const offlineBoard = r7Boards[2]
      const result = offlineBoard.boardNr % 2 === 1 ? 'Vit vinst' : 'Svart vinst'
      await enterResult(hostPage, offlineBoard.boardNr, result)
      await setStatus(gridPage, 'host', 'Bord 3 sparat lokalt')
    }

    // ── Host comes back online ──
    await setStatus(gridPage, 'host', '🔄 Återansluter...')
    await hostCtx.setOffline(false)

    // Give MQTT/WebRTC time to re-establish connections
    await hostPage.waitForTimeout(5000)
    await setStatus(gridPage, 'host', 'Nätverket åter — väntar på P2P...')

    // Enter remaining results
    await setStatus(gridPage, 'host', 'Matar in resterande resultat...')
    await enterPendingResults(hostPage, $, tid, 7)

    // Verify all results synced to ref after reconnection
    await setStatus(gridPage, 'referee', 'Verifierar synk efter återanslutning...')
    for (const g of r7Boards) {
      const expected = g.boardNr % 2 === 1 ? '1-0' : '0-1'
      await expect(refPage.getByTestId(`result-dropdown-${g.boardNr}`)).toContainText(expected, {
        timeout: 15_000,
      })
    }
    await setStatus(gridPage, 'referee', 'Alla resultat synkade efter återanslutning!')

    // Verify spectator
    await waitForSpectatorRound(specPage, 7)
    await setStatus(gridPage, 'spectator', 'Sista ronden synkad!')

    // Host checks standings
    await setStatus(gridPage, 'host', 'Kontrollerar slutst\u00e4llning...')
    await demoClick(
      hostPage,
      hostPage.getByTestId('tab-headers').getByText('St\u00e4llning', { exact: true }),
    )
    await expect(hostPage.getByTestId('data-table')).toBeVisible()
    await hostPage.waitForTimeout(1000)

    // Verify final standings via API (read-only verification)
    const finalStandings = await fetchStandings($, tid, 7)
    expect(finalStandings.length).toBe(12)

    // Verify all 7 rounds have complete results
    for (let r = 1; r <= 7; r++) {
      const round = await $.get(`/api/tournaments/${tid}/rounds/${r}`)
      for (const g of round.games) {
        if (g.whitePlayer && g.blackPlayer) {
          expect(g.resultType).not.toBe('NO_RESULT')
        }
      }
    }

    await setStatus(gridPage, 'host', 'Turnering klar \u2014 alla 7 ronder!')
    await setStatus(gridPage, 'referee', 'Bra jobbat!')
    await setStatus(gridPage, 'spectator', 'Skara SK-resultaten kompletta!')
    await gridPage.waitForTimeout(3000)

    // ── Cleanup ─────────────────────────────────────────────────
    clearInterval(captureLoop)
    await refPage.close()
    await refCtx.close()
    await specPage.close()
    await specCtx.close()
    await hostPage.close()
    await hostCtx.close()
    await gridPage.close()
    await gridCtx.close()
  })
})
