/* eslint local/no-class-locators: "off" -- structural traversal (.live-tab-*) */
/* eslint no-restricted-syntax: "off" -- demo video needs waitForTimeout for pacing */

import type { Page } from '@playwright/test'
import {
  apiClient,
  createTournament,
  ensureClubs,
  type PlayerInput,
  pairRound,
  waitForApi,
} from './api-helpers'
import { expect, test } from './fixtures'

// ---------------------------------------------------------------------------
// Two clubs, 8 players — 4 per club, giving 4 boards per round
// ---------------------------------------------------------------------------
const CLUBS = [{ name: 'Skara SK' }, { name: 'Lidk\u00f6ping SS' }]

const PLAYERS: PlayerInput[] = [
  // Skara SK (clubIndex set after ensureClubs)
  { lastName: 'Svensson', firstName: 'Anna', ratingI: 1800, clubIndex: 0 },
  { lastName: 'Lindberg', firstName: 'Maria', ratingI: 1650, clubIndex: 0 },
  { lastName: 'Andersson', firstName: 'Klas', ratingI: 1550, clubIndex: 0 },
  { lastName: '\u00d6berg', firstName: 'Sofia', ratingI: 1480, clubIndex: 0 },
  // Lidk\u00f6ping SS
  { lastName: 'Johansson', firstName: 'Erik', ratingI: 1750, clubIndex: 0 },
  { lastName: 'Nilsson', firstName: 'Karl', ratingI: 1700, clubIndex: 0 },
  { lastName: 'Pettersson', firstName: 'Lena', ratingI: 1520, clubIndex: 0 },
  { lastName: 'Karlsson', firstName: 'Oskar', ratingI: 1450, clubIndex: 0 },
]

// ---------------------------------------------------------------------------
// Reusable helpers (subset from vydelning.spec.ts)
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
  { bg: '#1e2d4a', text: '#7cb3f0', arrow: '#1e2d4a' }, // client 0: blue
  { bg: '#3a1e4a', text: '#c49df0', arrow: '#3a1e4a' }, // client 1: purple
]

function generateGridHtml(): string {
  const panels = [
    { id: 'host', type: 'desktop' as const },
    { id: 'client-0', type: 'mobile' as const },
    { id: 'client-1', type: 'mobile' as const },
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
<html><head><title>Lotta - Delning Klubbvy</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#e8e8ed; }
  .grid {
    display:flex; align-items:flex-end; justify-content:center;
    gap:40px; width:100vw; height:100vh; padding:40px 40px 48px;
  }
  .bubble {
    align-self: flex-start;
    position: relative;
    padding: 7px 16px;
    border-radius: 10px;
    font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
    margin-bottom: 12px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    pointer-events: none;
  }
  .bubble-arrow {
    position: absolute;
    bottom: -7px;
    left: 14px;
    width: 0; height: 0;
    border-left: 7px solid transparent;
    border-right: 7px solid transparent;
    border-top: 7px solid;
  }
  .screen { position:relative; }
  .boot-logo {
    position:absolute; inset:0; z-index:0;
    display:flex; align-items:center; justify-content:center;
    background:#111;
  }
  .screen img { position:relative; z-index:1; }
  .device.desktop {
    flex:3; height:100%;
    display:flex; flex-direction:column; align-items:center;
    justify-content:flex-end;
  }
  .device.desktop .monitor {
    width:100%; max-height:100%;
    display:flex; flex-direction:column;
    background: linear-gradient(170deg, #303035 0%, #1c1c1e 100%);
    border-radius: 12px;
    border: 2px solid #48484a;
    box-shadow: 0 12px 40px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2),
      inset 0 1px 0 rgba(255,255,255,0.08);
    padding: 10px 10px 0 10px;
    aspect-ratio: 16 / 10;
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
// Grid helpers
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

async function demoClick(page: Page, locator: import('@playwright/test').Locator) {
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
// Test
// ---------------------------------------------------------------------------

test.describe('Delning club-filtered spectator view', () => {
  test.setTimeout(180_000)

  test('host + two phones with club-filtered view', async ({ browser }) => {
    const baseURL = 'https://localhost:5174'

    // ── Grid page for composited video ────────────────────────────────
    const gridCtx = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      recordVideo: {
        dir: 'test-results/delning-videos/',
        size: { width: 1920, height: 1080 },
      },
    })
    const gridPage = await gridCtx.newPage()
    await gridPage.setContent(generateGridHtml())

    // ── Panels ──────────────────────────────────────────────────────
    const hostPanel = { id: 'host', page: null as Page | null }
    const phone0Panel = { id: 'client-0', page: null as Page | null }
    const phone1Panel = { id: 'client-1', page: null as Page | null }
    const allPanels = [hostPanel, phone0Panel, phone1Panel]

    // ── Host context ────────────────────────────────────────────────
    const hostCtx = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 1280, height: 800 },
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

    // ── Host: load app ──────────────────────────────────────────────
    await setStatus(gridPage, 'host', 'Laddar appen...')
    await hostPage.goto(`${baseURL}/`)
    await waitForApi(hostPage)
    await dismissBanner(hostPage)

    // ── Host: create clubs + tournament with club assignments ───────
    await setStatus(gridPage, 'host', 'Skapar turnering med 2 klubbar...')
    const $ = apiClient(hostPage)
    const clubIds = await ensureClubs($, CLUBS)

    // Assign clubIndex based on club membership
    const players = PLAYERS.map((p, i) => ({
      ...p,
      clubIndex: i < 4 ? clubIds[0] : clubIds[1],
    }))

    const { tid } = await createTournament(
      $,
      {
        name: 'Klubb-GP 2025',
        pairingSystem: 'Monrad',
        nrOfRounds: 5,
      },
      players,
    )
    await pairRound($, tid)

    await hostPage.reload()
    await waitForApi(hostPage)
    await dismissBanner(hostPage)

    // ── Host: select tournament ─────────────────────────────────────
    await setStatus(gridPage, 'host', 'V\u00e4ljer turnering...')
    const sel = hostPage.getByTestId('tournament-selector').locator('select').first()
    await sel.locator('option', { hasText: 'Klubb-GP 2025' }).waitFor({ state: 'attached' })
    await demoClick(hostPage, sel)
    await sel.selectOption('Klubb-GP 2025')
    await hostPage.waitForTimeout(400)

    // ── Host: start Live ────────────────────────────────────────────
    await setStatus(gridPage, 'host', 'Startar Live-delning...')
    await demoClick(hostPage, hostPage.getByTestId('tab-headers').getByText('Live (Beta)'))
    await expect(hostPage.locator('.live-tab-container')).toBeVisible()
    await demoClick(hostPage, hostPage.locator('button', { hasText: 'Starta Live' }))
    await expect(hostPage.locator('.live-tab-hosting')).toBeVisible()
    await hostPage.waitForTimeout(500)

    // ── Host: get URLs from Live tabs ─────────────────────────────────
    // Delning tab is already active — extract the view URL
    const viewUrlEl = hostPage.locator('.live-tab-links .live-tab-url').first()
    await expect(viewUrlEl).toBeVisible()
    const baseViewUrl = (await viewUrlEl.textContent())!
    expect(baseViewUrl).toContain('share=view')
    expect(baseViewUrl).toContain('token=')

    // Switch to Vydelning subtab for the referee share URL
    await demoClick(hostPage, hostPage.getByRole('tab', { name: 'Dela vy' }))
    const refUrlEl = hostPage.getByTestId('vydelning-url')
    await expect(refUrlEl).toBeVisible()
    const refShareUrl = (await refUrlEl.textContent())!
    expect(refShareUrl).toContain('share=full')

    // Switch back to Delning
    await demoClick(hostPage, hostPage.getByRole('tab', { name: 'Delning', exact: true }))

    // ── Host: generate club code for Skara SK ───────────────────────
    await setStatus(gridPage, 'host', 'Genererar klubbkod...')
    await expect(hostPage.getByTestId('club-codes')).toBeVisible()

    const skaraCheckbox = hostPage
      .locator('.live-tab-club-checkbox', { hasText: 'Skara SK' })
      .locator('input[type="checkbox"]')
    await skaraCheckbox.check()
    await expect(hostPage.getByTestId('club-code-value')).toBeVisible()
    const skaraFormatted = (await hostPage.getByTestId('club-code-value').textContent())!
    const skaraCode = skaraFormatted.replace(/\s/g, '')
    await setStatus(gridPage, 'host', `Skara SK: kod ${skaraFormatted}`)
    await hostPage.waitForTimeout(800)

    await setStatus(gridPage, 'host', 'Skickar koden till Skara SK!')
    await hostPage.waitForTimeout(1000)

    // ── Host: go to pairings ────────────────────────────────────────
    await demoClick(hostPage, hostPage.getByTestId('tab-headers').getByText('Lottning & resultat'))
    await expect(hostPage.getByTestId('data-table')).toBeVisible()
    await hostPage.waitForTimeout(400)

    // ── Create phones ───────────────────────────────────────────────
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

    const { ctx: phone0Ctx, page: phone0Page } = await createPhone('dark')
    const { ctx: phone1Ctx, page: phone1Page } = await createPhone('light')
    phone0Panel.page = phone0Page
    phone1Panel.page = phone1Page

    // Phone 0: Skara SK spectator — enters code via in-app dialog
    await setStatus(gridPage, 'client-0', 'Ansluter som \u00e5sk\u00e5dare...')
    await phone0Page.goto(baseViewUrl)

    // Phone 1: referee — full access, no club code needed
    await setStatus(gridPage, 'client-1', 'Ansluter som domare...')
    await phone1Page.goto(refShareUrl)

    // Phone 0: wait for club code dialog and type the code digit-by-digit so
    // the auto-format animation is captured in the demo video
    const codeDialog = phone0Page.getByTestId('club-code-dialog')
    await expect(codeDialog).toBeVisible({ timeout: 45_000 })
    await setStatus(gridPage, 'client-0', `Anger klubbkod ${skaraFormatted}...`)
    await gridPage.waitForTimeout(800)
    const codeInput = phone0Page.getByPlaceholder('### ###')
    await codeInput.pressSequentially(skaraCode, { delay: 200 })
    await expect(codeInput).toHaveValue(skaraFormatted)
    await gridPage.waitForTimeout(600)
    await phone0Page.getByTestId('club-code-submit').click()

    // Wait for phone 0 spectator layout
    await expect(phone0Page.getByTestId('spectator-pairings')).toBeVisible({ timeout: 45_000 })

    // Wait for phone 1 referee — sees full tournament UI with data table
    await expect(
      phone1Page.getByTestId('tournament-selector').locator('option', { hasText: 'Klubb-GP 2025' }),
    ).toBeAttached({ timeout: 45_000 })
    await gridPage.waitForTimeout(800)

    // ── Verify: phone 0 shows Skara SK badge ────────────────────────
    await setStatus(gridPage, 'client-0', 'Ser Skara SK:s lottning!')
    await expect(phone0Page.locator('.spectator-club-badge')).toContainText('Skara SK')
    await gridPage.waitForTimeout(1000)

    // ── Verify: phone 1 has full referee access ─────────────────────
    await setStatus(gridPage, 'client-1', 'Full \u00e5tkomst som domare!')
    await gridPage.waitForTimeout(1000)

    // ── Verify: name redaction on phone 0 (Skara SK) ────────────────
    const phone0Table = phone0Page.getByTestId('spectator-pairings')
    const phone0Rows = phone0Table.locator('tbody tr')
    const phone0Count = await phone0Rows.count()
    expect(phone0Count).toBeGreaterThan(0)

    await setStatus(gridPage, 'client-0', 'Motst\u00e5ndarnas namn \u00e4r dolda!')
    await gridPage.waitForTimeout(1500)

    await setStatus(gridPage, 'client-1', 'Domaren ser alla namn!')
    await gridPage.waitForTimeout(1500)

    // ── Host: enter results ─────────────────────────────────────────
    await setStatus(gridPage, 'host', 'Rapporterar resultat...')

    // Enter result on board 1 via right-click
    const hostRow0 = hostPage.getByTestId('data-table').locator('tbody tr').first()
    await hostRow0.click({ button: 'right' })
    await hostPage.waitForTimeout(250)
    const menu = hostPage.locator('.context-menu')
    await expect(menu).toBeVisible()
    await demoClick(hostPage, menu.getByText('Vit vinst').first())
    await hostPage.waitForTimeout(500)

    await setStatus(gridPage, 'host', 'Bord 1: 1-0!')
    await hostPage.waitForTimeout(500)

    // Enter result on board 2
    const hostRow1 = hostPage.getByTestId('data-table').locator('tbody tr').nth(1)
    await hostRow1.click({ button: 'right' })
    await hostPage.waitForTimeout(250)
    const menu2 = hostPage.locator('.context-menu')
    await expect(menu2).toBeVisible()
    await demoClick(hostPage, menu2.getByText('Remi').first())
    await hostPage.waitForTimeout(500)

    await setStatus(gridPage, 'host', 'Bord 2: remi!')

    // ── Verify: results sync to both phones ─────────────────────────
    await setStatus(gridPage, 'client-0', 'Resultat synkas...')
    await setStatus(gridPage, 'client-1', 'Resultat synkas...')

    // Wait for result to appear on spectator phone
    await expect(phone0Table.locator('tbody')).toContainText(/1-0|\u00bd-\u00bd/, {
      timeout: 15_000,
    })

    await setStatus(gridPage, 'client-0', 'Resultat uppdaterade!')
    await setStatus(gridPage, 'client-1', 'Domaren ser ocks\u00e5!')
    await gridPage.waitForTimeout(2000)

    // ── Host: pair round 2 ──────────────────────────────────────────
    await setStatus(gridPage, 'host', 'Dags f\u00f6r rond 2!')

    // Enter remaining results first (boards 3 & 4)
    for (let i = 2; i < 4; i++) {
      const row = hostPage.getByTestId('data-table').locator('tbody tr').nth(i)
      await row.click({ button: 'right' })
      await hostPage.waitForTimeout(200)
      const m = hostPage.locator('.context-menu')
      await expect(m).toBeVisible()
      await demoClick(hostPage, m.getByText('Svart vinst').first())
      await hostPage.waitForTimeout(300)
    }
    await hostPage.waitForTimeout(500)

    await setStatus(gridPage, 'host', 'Alla resultat inne, lottar rond 2...')
    await hostPage.getByTestId('menu-bar').getByRole('button', { name: 'Lotta' }).click()
    await hostPage.waitForTimeout(300)
    await hostPage.getByRole('button', { name: 'Lotta n\u00e4sta rond' }).click()
    await hostPage.waitForTimeout(1500)

    const roundSelect = hostPage.getByTestId('tournament-selector').locator('select').nth(2)
    await expect(roundSelect.locator('option', { hasText: 'Rond 2' })).toBeAttached({
      timeout: 10_000,
    })
    await roundSelect.selectOption({ label: 'Rond 2' })
    await hostPage.waitForTimeout(500)
    await setStatus(gridPage, 'host', 'Rond 2 lottad!')

    // ── Verify: spectator auto-updates to round 2 ───────────────────
    await setStatus(gridPage, 'client-0', 'V\u00e4ntar p\u00e5 rond 2...')
    await setStatus(gridPage, 'client-1', 'V\u00e4ntar p\u00e5 rond 2...')

    await expect(phone0Page.locator('.spectator-round')).toContainText('Rond 2', {
      timeout: 15_000,
    })

    await setStatus(gridPage, 'client-0', 'Rond 2 \u00e4r h\u00e4r!')
    await setStatus(gridPage, 'client-1', 'Ny rond synlig!')
    await gridPage.waitForTimeout(2000)

    // ── Final hold ──────────────────────────────────────────────────
    await setStatus(gridPage, 'host', '\u00c5sk\u00e5dare + domare f\u00f6ljer med!')
    await setStatus(gridPage, 'client-0', 'Skara SK ser sin klubb!')
    await setStatus(gridPage, 'client-1', 'Domaren har full kontroll!')
    await gridPage.waitForTimeout(3000)

    // ── Cleanup ─────────────────────────────────────────────────────
    clearInterval(captureLoop)
    await phone0Page.close()
    await phone0Ctx.close()
    await phone1Page.close()
    await phone1Ctx.close()
    await hostPage.close()
    await hostCtx.close()
    await gridPage.close()
    await gridCtx.close()
  })
})
