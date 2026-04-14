/* eslint local/no-class-locators: "off" -- structural traversal (.live-tab-*) */
/* eslint no-restricted-syntax: "off" -- demo video needs waitForTimeout for pacing */

import type { Locator, Page } from '@playwright/test'
import { apiClient, createTournament, type PlayerInput, pairRound, waitForApi } from './api-helpers'
import { expect, test } from './fixtures'

const PLAYERS: PlayerInput[] = [
  { lastName: 'Eriksson', firstName: 'Anna', ratingI: 1800 },
  { lastName: 'Svensson', firstName: 'Erik', ratingI: 1700 },
  { lastName: 'Johansson', firstName: 'Karin', ratingI: 1600 },
  { lastName: 'Karlsson', firstName: 'Lars', ratingI: 1500 },
]

const STRESS_PLAYERS: PlayerInput[] = [
  { lastName: 'Andersson', firstName: 'Magnus', ratingI: 2100 },
  { lastName: 'Carlsen', firstName: 'Nils', ratingI: 2050 },
  { lastName: 'Lindberg', firstName: 'Sara', ratingI: 1980 },
  { lastName: 'Nilsson', firstName: 'Oskar', ratingI: 1950 },
  { lastName: 'Pettersson', firstName: 'Eva', ratingI: 1900 },
  { lastName: 'Bergström', firstName: 'Johan', ratingI: 1870 },
  { lastName: 'Lundqvist', firstName: 'Elin', ratingI: 1820 },
  { lastName: 'Wikström', firstName: 'Henrik', ratingI: 1790 },
  { lastName: 'Holmberg', firstName: 'Maria', ratingI: 1750 },
  { lastName: 'Fransson', firstName: 'David', ratingI: 1720 },
  { lastName: 'Björk', firstName: 'Lena', ratingI: 1680 },
  { lastName: 'Ekström', firstName: 'Anton', ratingI: 1640 },
  { lastName: 'Sjöberg', firstName: 'Klara', ratingI: 1610 },
  { lastName: 'Nyström', firstName: 'Filip', ratingI: 1580 },
  { lastName: 'Sandberg', firstName: 'Ida', ratingI: 1550 },
  { lastName: 'Åberg', firstName: 'Tobias', ratingI: 1520 },
  { lastName: 'Hedlund', firstName: 'Saga', ratingI: 1490 },
  { lastName: 'Dahl', firstName: 'Viktor', ratingI: 1460 },
  { lastName: 'Engström', firstName: 'Maja', ratingI: 1430 },
  { lastName: 'Forsberg', firstName: 'Axel', ratingI: 1400 },
]

// ---------------------------------------------------------------------------
// Visible cursor — injected into host & client pages so mouse is visible
// in screenshots. Red dot with white border, shrinks on click.
// ---------------------------------------------------------------------------
function cursorScript(): string {
  // Chunky outlined arrow cursor with offset shadow, inspired by flat cursor icon set
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

// ---------------------------------------------------------------------------
// Grid HTML — two panels side by side, captions below each
// ---------------------------------------------------------------------------
function gridStyles(): string {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0a0a14; font-family: system-ui, -apple-system, sans-serif; }
    .screen {
      background: #111;
      overflow: hidden;
      min-height: 0;
    }
    .screen img {
      width: 100%; height: 100%;
      object-fit: contain;
      object-position: top center;
    }
    .caption {
      background: #12121e;
      color: rgba(255,255,255,0.85);
      padding: 8px 16px;
      font-size: 15px;
      font-weight: 400;
      min-height: 40px;
      display: flex;
      align-items: center;
      gap: 10px;
      border-top: 1px solid #252540;
    }
    .label {
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-size: 12px;
      padding: 2px 8px;
      border-radius: 3px;
    }
    .label.host { background: #166534; color: #4ade80; }
    .label.client { background: #1e3a5f; color: #60a5fa; }
    .label.client-1 { background: #1e3a5f; color: #60a5fa; }
    .label.client-2 { background: #4a1e5f; color: #c084fc; }
    .label.client-3 { background: #5f3a1e; color: #fb923c; }
    .text { flex: 1; }
  `
}

function gridHtml(): string {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Lotta Vydelning</title>
  <style>
    ${gridStyles()}
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-template-rows: 1fr auto;
      width: 100vw; height: 100vh;
      gap: 3px;
    }
  </style>
</head>
<body>
  <div class="grid">
    <div class="screen"><img id="host-img" /></div>
    <div class="screen"><img id="client-img" /></div>
    <div class="caption" id="caption-host">
      <span class="label host">V\u00c4RD</span>
      <span class="text" id="caption-host-text">Laddar...</span>
    </div>
    <div class="caption" id="caption-client">
      <span class="label client">KLIENT</span>
      <span class="text" id="caption-client-text">V\u00e4ntar...</span>
    </div>
  </div>
</body>
</html>`
}

// ---------------------------------------------------------------------------
// Scenario-driven demo infrastructure
// ---------------------------------------------------------------------------

interface ClientSpec {
  type: 'desktop' | 'mobile'
  colorScheme: 'light' | 'dark'
  label: string
}

interface DemoScenario {
  name: string
  tournamentName: string
  players: PlayerInput[]
  nrOfRounds: number
  host: { colorScheme: 'light' | 'dark' }
  clients: ClientSpec[]
}

// Satirical logos as inline SVGs — shown as bootup screens centered on device
// Wonky 4-pane window (parody Windows logo) — tilted, uneven, gappy
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

// Half-eaten orange (parody Apple logo)
// Bite is a bg-colored circle overlaying the orange (bg = boot screen #111)
function phoneLogo(size: number): string {
  return `<svg viewBox="0 0 32 32" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <circle cx="15" cy="18" r="11" fill="#f7941d" />
  <circle cx="24" cy="11" r="5.5" fill="#111" />
  <path d="M15 7 Q17 1 20 3" stroke="#3d7a33" stroke-width="2" fill="none" stroke-linecap="round"/>
  <ellipse cx="18" cy="3" rx="3" ry="1.8" fill="#6abf5e" transform="rotate(25 18 3)" />
</svg>`
}

// Per-device color identities for captions and boot logo tinting
const DEVICE_COLORS = [
  { bg: '#1a3a2a', text: '#7dcea0', arrow: '#1a3a2a' }, // host: green
  { bg: '#1e2d4a', text: '#7cb3f0', arrow: '#1e2d4a' }, // client 0: blue
  { bg: '#3a1e4a', text: '#c49df0', arrow: '#3a1e4a' }, // client 1: purple
  { bg: '#4a2e1a', text: '#f0b07c', arrow: '#4a2e1a' }, // client 2: orange
  { bg: '#4a1a2a', text: '#f07c9d', arrow: '#4a1a2a' }, // client 3: pink
]

function generateGridHtml(scenario: DemoScenario): string {
  const panels = [
    { id: 'host', type: 'desktop' as const },
    ...scenario.clients.map((c, i) => ({ id: `client-${i}`, type: c.type })),
  ]

  // Deterministic per-phone height variation (75%-85% of grid height)
  const phoneSizes = [78, 83, 76, 81, 74, 85]

  const panelHtml = panels
    .map((p, idx) => {
      const logo = p.type === 'desktop' ? desktopLogo(80) : phoneLogo(56)
      const color = DEVICE_COLORS[idx % DEVICE_COLORS.length]
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
      const phoneIdx = idx - 1 // first panel is always desktop
      const heightPct = phoneSizes[phoneIdx % phoneSizes.length]
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
<html><head><title>Lotta - ${scenario.name}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#e8e8ed; }
  .grid {
    display:flex; align-items:flex-end; justify-content:center;
    gap:40px; width:100vw; height:100vh; padding:40px 40px 48px;
  }

  /* Speech bubble above each device */
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

  /* Bootup logo — centered on screen, hidden once img loads */
  .screen { position:relative; }
  .boot-logo {
    position:absolute; inset:0; z-index:0;
    display:flex; align-items:center; justify-content:center;
    background:#111;
  }
  .screen img { position:relative; z-index:1; }

  /* ── Desktop monitor ─────────────────────────────────────── */
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
    box-shadow:
      0 12px 40px rgba(0,0,0,0.4),
      0 2px 8px rgba(0,0,0,0.2),
      inset 0 1px 0 rgba(255,255,255,0.08);
    padding: 10px 10px 0 10px;
    aspect-ratio: 16 / 10;
  }
  .device.desktop .screen {
    flex:1; min-height:0; overflow:hidden; border-radius:3px;
    background:#000;
  }
  .device.desktop .screen img {
    width:100%; height:100%;
    object-fit:contain; object-position:top center;
    display:block;
  }
  .device.desktop .chin {
    height:26px;
    display:flex; justify-content:center; align-items:center;
    opacity: 0.6;
  }
  .device.desktop .neck {
    width:50px; height:36px;
    background: linear-gradient(180deg, #2c2c2e 0%, #232326 100%);
    border-left: 1px solid #48484a;
    border-right: 1px solid #48484a;
  }
  .device.desktop .foot {
    width:150px; height:8px;
    background: linear-gradient(180deg, #38383a 0%, #2c2c2e 100%);
    border-radius: 2px 2px 6px 6px;
    border: 1px solid #48484a;
    border-top: none;
    box-shadow: 0 3px 10px rgba(0,0,0,0.25);
  }

  /* ── Phone ───────────────────────────────────────────────── */
  .device.phone {
    display:flex; flex-direction:column; align-items:center;
    justify-content:flex-end;
  }
  .device.phone .shell {
    height:100%; min-height:0;
    aspect-ratio: 9 / 19.5;
    display:flex; flex-direction:column; align-items:center;
    background: linear-gradient(170deg, #303035 0%, #1c1c1e 100%);
    border-radius: 22px;
    border: 3px solid #48484a;
    box-shadow:
      0 12px 40px rgba(0,0,0,0.4),
      0 2px 8px rgba(0,0,0,0.2),
      inset 0 1px 0 rgba(255,255,255,0.1);
    padding: 10px 4px 12px 4px;
    overflow: hidden;
  }
  .device.phone .earpiece {
    width:36px; height:4px;
    background:#58585a; border-radius:2px;
    margin-bottom:5px; flex-shrink:0;
  }
  .device.phone .screen {
    flex:1; width:100%; min-height:0; overflow:hidden;
    border-radius:2px;
    background:#000;
  }
  .device.phone .screen img {
    width:100%; height:100%;
    object-fit:cover; object-position:top center;
    display:block;
  }
</style></head>
<body><div class="grid">${panelHtml}</div></body></html>`
}

const DEMO_SCENARIOS: DemoScenario[] = [
  {
    name: 'desktop + two mobiles - mixed modes',
    tournamentName: 'Demo GP 2025',
    players: STRESS_PLAYERS,
    nrOfRounds: 7,
    host: { colorScheme: 'light' },
    clients: [
      { type: 'mobile', colorScheme: 'dark', label: 'Mobil 1' },
      { type: 'mobile', colorScheme: 'light', label: 'Mobil 2' },
    ],
  },
  {
    name: 'desktop + two mobiles - stress test',
    tournamentName: 'Stresstest GP 2025',
    players: STRESS_PLAYERS,
    nrOfRounds: 7,
    host: { colorScheme: 'dark' },
    clients: [
      { type: 'mobile', colorScheme: 'dark', label: 'Mobil 1' },
      { type: 'mobile', colorScheme: 'dark', label: 'Mobil 2' },
    ],
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function setCaption(gridPage: Page, side: string, text: string) {
  await gridPage.evaluate(
    ({ side, text }) => {
      const el = document.getElementById(`caption-${side}-text`)
      if (el) el.textContent = text
    },
    { side, text },
  )
}

/** Set a speech-bubble caption above a device in the grid page */
async function setStatus(gridPage: Page, panelId: string, text: string) {
  await gridPage.evaluate(
    ([id, t]) => {
      const el = document.getElementById(`bubble-${id}`)
      if (!el) return
      if (!t) {
        el.style.display = 'none'
        return
      }
      // Preserve the arrow span — only update the text node
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

/** Capture screenshots from pages into corresponding grid img elements */
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

/** Smoothly glide the mouse from current position to target over ~600ms */
async function smoothMove(page: Page, toX: number, toY: number) {
  const steps = 8
  const stepDelay = 80 // ms between each step — visible in 400ms capture loop
  // Get current mouse position via page evaluation
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
  // Store final position for next call
  await page.evaluate(
    ({ x, y }) => {
      ;(window as unknown as { __pwMouseX: number }).__pwMouseX = x
      ;(window as unknown as { __pwMouseY: number }).__pwMouseY = y
    },
    { x: toX, y: toY },
  )
}

/** Move mouse visibly to element, pause for screenshot, then click */
async function demoClick(page: Page, locator: Locator) {
  await locator.scrollIntoViewIfNeeded()
  const box = await locator.boundingBox()
  if (box) {
    await smoothMove(page, box.x + box.width / 2, box.y + box.height / 2)
    await page.waitForTimeout(200)
  }
  await locator.click()
}

/** Dismiss the data-loss warning banner if visible */
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

test.describe('Vydelning multiplayer demo', () => {
  test.setTimeout(180_000)

  test('two desktops — host and client sync results', async ({ browser }) => {
    const baseURL = 'https://localhost:5174'

    // ── Grid page for composited video ────────────────────────────────
    const gridCtx = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      recordVideo: {
        dir: 'test-results/vydelning-videos/',
        size: { width: 1920, height: 1080 },
      },
    })
    const gridPage = await gridCtx.newPage()
    await gridPage.setContent(gridHtml())

    // ── Host in separate context ──────────────────────────────────────
    const hostCtx = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 950, height: 850 },
      colorScheme: 'dark',
    })
    const hostPage = await hostCtx.newPage()
    await hostPage.addInitScript(() => {
      localStorage.setItem('theme', 'dark')
      document.documentElement.setAttribute('data-theme', 'dark')
    })
    await hostPage.addInitScript(cursorScript())

    // ── Continuous screenshot capture ─────────────────────────────────
    let clientPage: Page | null = null
    const clientPanel = { id: 'client', page: null as Page | null }
    const panels = [{ id: 'host', page: hostPage }, clientPanel]
    const captureLoop = setInterval(() => {
      void capturePages(gridPage, panels)
    }, 400)

    // ── Host: load app ────────────────────────────────────────────────
    await setCaption(gridPage, 'host', 'Laddar appen...')
    await hostPage.goto(`${baseURL}/`)
    await waitForApi(hostPage)
    await dismissBanner(hostPage)

    // ── Host: create tournament via API ───────────────────────────────
    await setCaption(gridPage, 'host', 'Skapar turnering med 4 spelare...')
    const $ = apiClient(hostPage)
    const { tid } = await createTournament(
      $,
      { name: 'Vydelning Demo', pairingSystem: 'Monrad', nrOfRounds: 5 },
      PLAYERS,
    )
    await pairRound($, tid)

    await hostPage.reload()
    await waitForApi(hostPage)
    await dismissBanner(hostPage)

    // ── Host: select tournament ───────────────────────────────────────
    await setCaption(gridPage, 'host', 'Väljer turnering...')
    const tournamentSelect = hostPage.getByTestId('tournament-selector').locator('select').first()
    await tournamentSelect
      .locator('option', { hasText: 'Vydelning Demo' })
      .waitFor({ state: 'attached' })
    await demoClick(hostPage, tournamentSelect)
    await tournamentSelect.selectOption('Vydelning Demo')
    await hostPage.waitForTimeout(500)

    // ── Host: navigate to Live tab and start hosting ──────────────────
    await setCaption(gridPage, 'host', 'Startar Live-delning...')
    await demoClick(hostPage, hostPage.getByTestId('tab-headers').getByText('Live (Beta)'))
    await expect(hostPage.locator('.live-tab-container')).toBeVisible()
    await demoClick(hostPage, hostPage.locator('button', { hasText: 'Starta Live' }))
    await expect(hostPage.locator('.live-tab-hosting')).toBeVisible()
    await hostPage.waitForTimeout(500)

    // ── Host: get share URL from Vydelning subtab ─────────────────────
    await setCaption(gridPage, 'host', 'Hämtar delningslänk...')
    await demoClick(hostPage, hostPage.getByRole('tab', { name: 'Dela vy' }))
    const urlEl = hostPage.getByTestId('vydelning-url')
    await expect(urlEl).toBeVisible()
    const shareUrl = await urlEl.textContent()
    expect(shareUrl).toBeTruthy()
    expect(shareUrl).toContain('share=full')
    await hostPage.waitForTimeout(1000)

    // ── Host: go to Delning tab to see peers ──────────────────────────
    await setCaption(gridPage, 'host', 'Värd aktiv — Väntar på klient...')
    await demoClick(hostPage, hostPage.getByRole('tab', { name: 'Delning', exact: true }))

    // ── Client in separate context ────────────────────────────────────
    await setCaption(gridPage, 'client', 'Klient öppnar delningslänk...')
    const clientCtx = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 950, height: 850 },
      colorScheme: 'dark',
    })
    clientPage = await clientCtx.newPage()
    clientPanel.page = clientPage
    await clientPage.addInitScript(() => {
      localStorage.setItem('theme', 'dark')
      document.documentElement.setAttribute('data-theme', 'dark')
    })
    await clientPage.addInitScript(cursorScript())
    await clientPage.goto(shareUrl!)

    // ── Wait for P2P connection ───────────────────────────────────────
    await setCaption(gridPage, 'client', 'Ansluter via P2P...')
    await expect(
      clientPage
        .getByTestId('tournament-selector')
        .locator('option', { hasText: 'Vydelning Demo' }),
    ).toBeAttached({ timeout: 45_000 })

    await dismissBanner(clientPage)
    await setCaption(gridPage, 'client', 'Ansluten! Väljer turnering...')
    await clientPage.waitForTimeout(500)

    // ── Client: select tournament ─────────────────────────────────────
    const clientSelect = clientPage.getByTestId('tournament-selector').locator('select').first()
    await demoClick(clientPage, clientSelect)
    await clientSelect.selectOption('Vydelning Demo')
    await clientPage.waitForTimeout(500)

    // ── Client: view pairings ─────────────────────────────────────────
    await setCaption(gridPage, 'client', 'Visar lottning och resultat...')
    await demoClick(
      clientPage,
      clientPage.getByTestId('tab-headers').getByText('Lottning & resultat'),
    )
    await expect(clientPage.getByTestId('data-table')).toBeVisible()
    await clientPage.waitForTimeout(1500)

    // ── Verify host sees peer ─────────────────────────────────────────
    await setCaption(gridPage, 'host', 'Värd ser klienten ansluten')
    await expect(hostPage.locator('.live-tab-badge')).not.toContainText('0 anslutna', {
      timeout: 15_000,
    })
    await hostPage.waitForTimeout(1000)

    // ── Host: navigate to pairings to enter a result ──────────────────
    await setCaption(gridPage, 'host', 'Värd rapporterar resultat för bord 1...')
    await demoClick(hostPage, hostPage.getByTestId('tab-headers').getByText('Lottning & resultat'))
    await expect(hostPage.getByTestId('data-table')).toBeVisible()
    await hostPage.waitForTimeout(500)

    // Right-click first game row → context menu → "Vit vann"
    const firstRow = hostPage.getByTestId('data-table').locator('tbody tr').first()
    const rowBox = await firstRow.boundingBox()
    if (rowBox) {
      await smoothMove(hostPage, rowBox.x + rowBox.width / 2, rowBox.y + rowBox.height / 2)
      await hostPage.waitForTimeout(200)
    }
    await firstRow.click({ button: 'right' })
    await hostPage.waitForTimeout(300)

    const ctxMenu = hostPage.locator('.context-menu')
    await expect(ctxMenu).toBeVisible()
    await demoClick(hostPage, ctxMenu.getByText('Vit vinst').first())
    await hostPage.waitForTimeout(500)
    await setCaption(gridPage, 'host', 'Resultat rapporterat: 1-0')

    // ── Client: result should sync automatically via data-changed broadcast
    await expect(clientPage.getByTestId('data-table').locator('tbody tr').first()).toContainText(
      '1-0',
      { timeout: 10_000 },
    )
    await setCaption(gridPage, 'client', 'Resultat synkat automatiskt — 1-0!')
    await gridPage.waitForTimeout(2000)

    // ── Client: report result on board 2 ───────────────────────────────
    await setCaption(gridPage, 'client', 'Klient rapporterar resultat för bord 2...')
    const clientSecondRow = clientPage.getByTestId('data-table').locator('tbody tr').nth(1)
    const clientRowBox = await clientSecondRow.boundingBox()
    if (clientRowBox) {
      await smoothMove(
        clientPage,
        clientRowBox.x + clientRowBox.width / 2,
        clientRowBox.y + clientRowBox.height / 2,
      )
      await clientPage.waitForTimeout(200)
    }
    await clientSecondRow.click({ button: 'right' })
    await clientPage.waitForTimeout(300)

    const clientCtxMenu = clientPage.locator('.context-menu')
    await expect(clientCtxMenu).toBeVisible()
    await demoClick(clientPage, clientCtxMenu.getByText('Svart vinst').first())
    await clientPage.waitForTimeout(500)
    await setCaption(gridPage, 'client', 'Resultat rapporterat: 0-1')
    await clientPage.waitForTimeout(1000)

    // ── Client: verify own result appears ─────────────────────────────
    await expect(clientPage.getByTestId('data-table').locator('tbody tr').nth(1)).toContainText(
      '0-1',
      { timeout: 10_000 },
    )
    await setCaption(gridPage, 'client', 'Klientens resultat bekräftat — 0-1!')
    await clientPage.waitForTimeout(1000)

    // ── Host: client result should sync back ──────────────────────────
    await setCaption(gridPage, 'host', 'Resultat från klient synkas till värd...')
    await expect(hostPage.getByTestId('data-table').locator('tbody tr').nth(1)).toContainText(
      '0-1',
      { timeout: 10_000 },
    )
    await setCaption(gridPage, 'host', 'Resultat synkat från klient — 0-1!')
    await hostPage.waitForTimeout(1500)

    // ── Client: check standings ───────────────────────────────────────
    await setCaption(gridPage, 'client', 'Klient kontrollerar ställningen...')
    await demoClick(
      clientPage,
      clientPage.getByTestId('tab-headers').getByText('Ställning', { exact: true }),
    )
    await expect(clientPage.getByTestId('data-table')).toBeVisible({ timeout: 10_000 })
    await clientPage.waitForTimeout(1500)
    await setCaption(gridPage, 'client', 'Ställning visar poäng från båda resultat!')

    // ── Final hold ────────────────────────────────────────────────────
    await setCaption(gridPage, 'host', 'Demonstration klar — data synkas via P2P')
    await gridPage.waitForTimeout(3000)

    // ── Cleanup ───────────────────────────────────────────────────────
    clearInterval(captureLoop)
    await clientPage.close()
    await clientCtx.close()
    await hostPage.close()
    await hostCtx.close()
    await gridPage.close()
    await gridCtx.close()
  })

  for (const scenario of DEMO_SCENARIOS) {
    test(scenario.name, async ({ browser }) => {
      const baseURL = 'https://localhost:5174'
      const clientCount = scenario.clients.length
      const numBoards = scenario.players.length / 2

      // Seeded PRNG for reproducible "random" delays
      let seed = 42
      function seededRandom() {
        seed = (seed * 16807 + 0) % 2147483647
        return (seed - 1) / 2147483646
      }

      // ── Helper: create a browser context ──────────────────────────
      async function makeCtx(opts?: { mobile?: boolean; colorScheme?: 'light' | 'dark' }) {
        const mobile = opts?.mobile ?? false
        const colorScheme = opts?.colorScheme ?? 'dark'
        const viewport = mobile ? { width: 375, height: 812 } : { width: 1280, height: 800 }
        const ctx = await browser.newContext({
          ignoreHTTPSErrors: true,
          viewport,
          colorScheme,
          ...(mobile
            ? {
                deviceScaleFactor: 3,
                isMobile: true,
                hasTouch: true,
                userAgent:
                  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
              }
            : {}),
        })
        const page = await ctx.newPage()
        await page.addInitScript((theme) => {
          localStorage.setItem('theme', theme)
          document.documentElement.setAttribute('data-theme', theme)
        }, colorScheme)
        if (!mobile) await page.addInitScript(cursorScript())
        return { ctx, page }
      }

      // ── Helper: right-click a row and pick a result ───────────────
      async function enterResult(
        page: Page,
        rowIndex: number,
        resultText: string,
        mobile?: boolean,
      ) {
        const row = page.getByTestId('data-table').locator('tbody tr').nth(rowIndex)
        if (mobile) {
          const box = await row.boundingBox()
          if (box) {
            await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
            await page.waitForTimeout(100)
          }
          await row.click({ button: 'right', force: true })
        } else {
          const box = await row.boundingBox()
          if (box) {
            await smoothMove(page, box.x + box.width / 2, box.y + box.height / 2)
            await page.waitForTimeout(200)
          }
          await row.click({ button: 'right' })
        }
        await page.waitForTimeout(250)
        const menu = page.locator('.context-menu')
        await expect(menu).toBeVisible()
        if (mobile) {
          await menu
            .getByText(resultText)
            .first()
            .evaluate((el) => (el as HTMLElement).click())
        } else {
          await demoClick(page, menu.getByText(resultText).first())
        }
        await page.waitForTimeout(300)
      }

      // ── Helper: connect a client ──────────────────────────────────
      async function connectClient(page: Page, url: string, mobile?: boolean) {
        await page.goto(url)
        await expect(
          page
            .getByTestId('tournament-selector')
            .locator('option', { hasText: scenario.tournamentName }),
        ).toBeAttached({ timeout: 45_000 })
        await dismissBanner(page)
        const cSel = page.getByTestId('tournament-selector').locator('select').first()
        await cSel.selectOption(scenario.tournamentName)
        await page.waitForTimeout(300)
        if (mobile) {
          await page.getByTestId('tab-headers').getByText('Lottning & resultat').tap()
        } else {
          await demoClick(page, page.getByTestId('tab-headers').getByText('Lottning & resultat'))
        }
        await expect(page.getByTestId('data-table')).toBeVisible()
      }

      // ── Grid page for composited video ────────────────────────────
      const gridCtx = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        recordVideo: {
          dir: 'test-results/vydelning-videos/',
          size: { width: 1920, height: 1080 },
        },
      })
      const gridPage = await gridCtx.newPage()
      await gridPage.setContent(generateGridHtml(scenario))

      // ── Panels ────────────────────────────────────────────────────
      const hostPanel = { id: 'host', page: null as Page | null }
      const clientPanels = scenario.clients.map((_, i) => ({
        id: `client-${i}`,
        page: null as Page | null,
      }))
      const allPanels = [hostPanel, ...clientPanels]

      // ── Host ──────────────────────────────────────────────────────
      const { ctx: hostCtx, page: hostPage } = await makeCtx({
        colorScheme: scenario.host.colorScheme,
      })
      hostPanel.page = hostPage

      const captureLoop = setInterval(() => {
        void capturePages(gridPage, allPanels)
      }, 400)

      // ── Host: load app and create tournament ──────────────────────
      await hostPage.goto(`${baseURL}/`)
      await waitForApi(hostPage)
      await dismissBanner(hostPage)

      const $ = apiClient(hostPage)
      const { tid } = await createTournament(
        $,
        {
          name: scenario.tournamentName,
          pairingSystem: 'Monrad',
          nrOfRounds: scenario.nrOfRounds,
        },
        scenario.players,
      )
      await pairRound($, tid)

      await hostPage.reload()
      await waitForApi(hostPage)
      await dismissBanner(hostPage)

      // ── Host: select tournament ───────────────────────────────────
      await setStatus(gridPage, 'host', `Okej, ${scenario.players.length} spelare inlagda!`)
      const sel = hostPage.getByTestId('tournament-selector').locator('select').first()
      await sel
        .locator('option', { hasText: scenario.tournamentName })
        .waitFor({ state: 'attached' })
      await demoClick(hostPage, sel)
      await sel.selectOption(scenario.tournamentName)
      await hostPage.waitForTimeout(400)

      // ── Host: start Live and get share URL ────────────────────────
      await setStatus(gridPage, 'host', 'Nu startar jag Live-delning...')
      await demoClick(hostPage, hostPage.getByTestId('tab-headers').getByText('Live (Beta)'))
      await expect(hostPage.locator('.live-tab-container')).toBeVisible()
      await demoClick(hostPage, hostPage.locator('button', { hasText: 'Starta Live' }))
      await expect(hostPage.locator('.live-tab-hosting')).toBeVisible()

      await demoClick(hostPage, hostPage.getByRole('tab', { name: 'Dela vy' }))
      const urlEl = hostPage.getByTestId('vydelning-url')
      await expect(urlEl).toBeVisible()
      const shareUrl = (await urlEl.textContent())!
      await hostPage.waitForTimeout(500)

      // ── Host: go to pairings ──────────────────────────────────────
      await demoClick(
        hostPage,
        hostPage.getByTestId('tab-headers').getByText('Lottning & resultat'),
      )
      await expect(hostPage.getByTestId('data-table')).toBeVisible()
      await setStatus(gridPage, 'host', 'Jag har delat länken med domarna')

      // ── Connect all clients simultaneously ────────────────────────
      const clientSetups = await Promise.all(
        scenario.clients.map(async (spec, i) => {
          const { ctx, page } = await makeCtx({
            mobile: spec.type === 'mobile',
            colorScheme: spec.colorScheme,
          })
          clientPanels[i].page = page
          return {
            ctx,
            page,
            index: i,
            mobile: spec.type === 'mobile',
            label: spec.label,
          }
        }),
      )

      await Promise.all(
        clientSetups.map(async ({ page, mobile, index }) => {
          await connectClient(page, shareUrl, mobile)
          await setStatus(gridPage, `client-${index}`, index === 0 ? 'Jag är inne!' : 'Jag med!')
        }),
      )

      const clients = clientSetups.map(({ ctx, page, mobile, label }) => ({
        ctx,
        page,
        mobile,
        label,
      }))
      await gridPage.waitForTimeout(1000)
      await setStatus(gridPage, 'host', 'Alla är med, kör igång!')

      // ── Chat: host welcomes participants ──────────────────────────
      await setStatus(gridPage, 'host', 'Skriver i chatten...')
      await demoClick(hostPage, hostPage.getByTestId('tab-headers').getByText('Live (Beta)'))
      await demoClick(hostPage, hostPage.getByRole('tab', { name: /^Chatt/ }))
      await hostPage.waitForTimeout(800)
      await hostPage.locator('.live-chat-input input').fill('Hej alla! Skriv om nåt strular')
      await hostPage.waitForTimeout(600)
      await demoClick(hostPage, hostPage.locator('.live-chat-input').getByText('Skicka'))
      await setStatus(gridPage, 'host', '')
      await hostPage.waitForTimeout(1500)

      // Client 0 opens chat and replies
      await setStatus(gridPage, 'client-0', 'Öppnar chatten...')
      const chatToggle0 = clients[0].page.locator('.client-chat-toggle')
      if (clients[0].mobile) await chatToggle0.tap()
      else await demoClick(clients[0].page, chatToggle0)
      await clients[0].page.waitForTimeout(1200)
      await setStatus(gridPage, 'client-0', 'Svarar i chatten')
      const chatInput0 = clients[0].page.locator('.client-chat-panel .live-chat-input input')
      await chatInput0.fill('Hej! Vi ser allt, ser bra ut 👍')
      await clients[0].page.waitForTimeout(600)
      const sendBtn0 = clients[0].page.locator('.client-chat-panel .live-chat-input button')
      if (clients[0].mobile) await sendBtn0.tap()
      else await demoClick(clients[0].page, sendBtn0)
      await clients[0].page.waitForTimeout(1500)

      // Close client chat, host sees reply
      if (clients[0].mobile) await chatToggle0.tap()
      else await demoClick(clients[0].page, chatToggle0)
      await setStatus(gridPage, 'client-0', '')
      await hostPage.waitForTimeout(1000)

      // Host goes back to pairings
      await setStatus(gridPage, 'host', 'Alla hör av sig, bra!')
      await demoClick(
        hostPage,
        hostPage.getByTestId('tab-headers').getByText('Lottning & resultat'),
      )
      await expect(hostPage.getByTestId('data-table')).toBeVisible()
      await hostPage.waitForTimeout(800)

      // ── Staggered result entry with random delays ─────────────────
      const resultChoices = ['Vit vinst', 'Svart vinst', 'Remi']
      const resultDisplay = ['1-0', '0-1', '\u00bd-\u00bd']
      const boardPlan = Array.from({ length: numBoards }, (_, i) => ({
        client: i % clientCount,
        board: i,
        rIdx: i % resultChoices.length,
      }))

      for (let w = 0; w < boardPlan.length; w += clientCount) {
        const wave = boardPlan.slice(w, w + clientCount)

        for (const { client: ci, board, rIdx } of wave) {
          const phrases = [
            `Bord ${board + 1} är klart, ${resultDisplay[rIdx]}`,
            `Jag såg bord ${board + 1}: ${resultDisplay[rIdx]}`,
            `Bord ${board + 1} just nu: ${resultDisplay[rIdx]}`,
          ]
          await setStatus(gridPage, `client-${ci}`, phrases[rIdx])
        }

        await Promise.all(
          wave.map(async ({ client: ci, board, rIdx }) => {
            const delay = Math.floor(seededRandom() * 800)
            await clients[ci].page.waitForTimeout(delay)
            await enterResult(clients[ci].page, board, resultChoices[rIdx], clients[ci].mobile)
          }),
        )

        for (const { client: ci, board, rIdx } of wave) {
          await setStatus(
            gridPage,
            `client-${ci}`,
            `Klart, bord ${board + 1} = ${resultDisplay[rIdx]}`,
          )
        }
        await gridPage.waitForTimeout(400 + Math.floor(seededRandom() * 500))
      }

      // ── Verify all results synced to host ─────────────────────────
      await setStatus(gridPage, 'host', 'Alla resultat kom in, snyggt!')
      const expectedResults = boardPlan.map((b) => resultDisplay[b.rIdx])
      for (let i = 0; i < expectedResults.length; i++) {
        await expect(hostPage.getByTestId('data-table').locator('tbody tr').nth(i)).toContainText(
          expectedResults[i],
          { timeout: 15_000 },
        )
      }
      await setStatus(gridPage, 'host', 'Perfekt, allt stämmer!')
      await hostPage.waitForTimeout(1000)

      // ── Chat: client reacts after round 1 ─────────────────────────
      const ci2 = clients.length > 1 ? 1 : 0
      await setStatus(gridPage, `client-${ci2}`, 'Kommenterar i chatten...')
      const chatToggle1 = clients[ci2].page.locator('.client-chat-toggle')
      if (clients[ci2].mobile) await chatToggle1.tap()
      else await demoClick(clients[ci2].page, chatToggle1)
      await clients[ci2].page.waitForTimeout(800)
      const chatInput1 = clients[ci2].page.locator('.client-chat-panel .live-chat-input input')
      await chatInput1.fill('Snabba partier idag!')
      await clients[ci2].page.waitForTimeout(600)
      const sendBtn1 = clients[ci2].page.locator('.client-chat-panel .live-chat-input button')
      if (clients[ci2].mobile) await sendBtn1.tap()
      else await demoClick(clients[ci2].page, sendBtn1)
      await clients[ci2].page.waitForTimeout(1500)
      if (clients[ci2].mobile) await chatToggle1.tap()
      else await demoClick(clients[ci2].page, chatToggle1)
      await setStatus(gridPage, `client-${ci2}`, '')
      await gridPage.waitForTimeout(800)

      // ── Host: pair round 2 via menu UI ────────────────────────────
      await setStatus(gridPage, 'host', 'Dags för rond 2!')
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
      await setStatus(gridPage, 'host', 'Rond 2 lottad, kör!')

      // ── All clients see round 2 ───────────────────────────────────
      await Promise.all(
        clients.map(async (c, ci) => {
          await setStatus(gridPage, `client-${ci}`, 'Ny rond, ser den!')
          const cRoundSel = c.page.getByTestId('tournament-selector').locator('select').nth(2)
          await expect(cRoundSel.locator('option', { hasText: 'Rond 2' })).toBeAttached({
            timeout: 15_000,
          })
          await cRoundSel.selectOption({ label: 'Rond 2' })
          await c.page.waitForTimeout(300)
          await expect(c.page.getByTestId('data-table')).toBeVisible()
          await setStatus(gridPage, `client-${ci}`, 'Allt synkat!')
        }),
      )
      await gridPage.waitForTimeout(2000)

      // ── Final hold ────────────────────────────────────────────────
      await setStatus(gridPage, 'host', 'Smidigare än papperslappar!')
      for (let ci = 0; ci < clients.length; ci++) {
        await setStatus(gridPage, `client-${ci}`, ci === 0 ? 'Helt klart!' : 'Funkar jättebra!')
      }
      await gridPage.waitForTimeout(3000)

      // ── Cleanup ───────────────────────────────────────────────────
      clearInterval(captureLoop)
      for (const c of clients) {
        await c.page.close()
        await c.ctx.close()
      }
      await hostPage.close()
      await hostCtx.close()
      await gridPage.close()
      await gridCtx.close()
    })
  }
})
