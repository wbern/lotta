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

const CLUBS = [{ name: 'Skara SK' }, { name: 'Lidköping SS' }]

const PLAYERS: PlayerInput[] = [
  { lastName: 'Svensson', firstName: 'Anna', ratingI: 1800, clubIndex: 0 },
  { lastName: 'Lindberg', firstName: 'Maria', ratingI: 1650, clubIndex: 0 },
  { lastName: 'Andersson', firstName: 'Klas', ratingI: 1550, clubIndex: 0 },
  { lastName: 'Öberg', firstName: 'Sofia', ratingI: 1480, clubIndex: 0 },
  { lastName: 'Johansson', firstName: 'Erik', ratingI: 1750, clubIndex: 0 },
  { lastName: 'Nilsson', firstName: 'Karl', ratingI: 1700, clubIndex: 0 },
  { lastName: 'Pettersson', firstName: 'Lena', ratingI: 1520, clubIndex: 0 },
  { lastName: 'Karlsson', firstName: 'Oskar', ratingI: 1450, clubIndex: 0 },
]

// ---------------------------------------------------------------------------
// Visual helpers
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
  { bg: '#1e2d4a', text: '#7cb3f0', arrow: '#1e2d4a' }, // viewer: blue
]

function generateGridHtml(): string {
  const panels = [
    { id: 'host', type: 'desktop' as const },
    { id: 'viewer', type: 'mobile' as const },
  ]

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
      return `
      <div class="device phone" style="height:80%">
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
<html><head><title>Lotta – Klubbkod</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#e8e8ed; }
  .grid {
    display:flex; align-items:flex-end; justify-content:center;
    gap:50px; width:100vw; height:100vh; padding:40px 60px 48px;
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

test.describe('Club code entry via prompt', () => {
  test.setTimeout(180_000)

  test('spectator enters club code and sees filtered pairings', async ({ browser }) => {
    const baseURL = 'https://localhost:5174'

    // ── Grid page for composited video ────────────────────────
    const gridCtx = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      recordVideo: {
        dir: 'test-results/club-code-videos/',
        size: { width: 1920, height: 1080 },
      },
    })
    const gridPage = await gridCtx.newPage()
    await gridPage.setContent(generateGridHtml())

    // ── Panels ────────────────────────────────────────────────
    const hostPanel = { id: 'host', page: null as Page | null }
    const viewerPanel = { id: 'viewer', page: null as Page | null }
    const allPanels = [hostPanel, viewerPanel]

    // ── Host context ──────────────────────────────────────────
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

    // ── Host: load app ────────────────────────────────────────
    await setStatus(gridPage, 'host', 'Laddar appen...')
    await hostPage.goto(`${baseURL}/`)
    await waitForApi(hostPage)
    await dismissBanner(hostPage)

    // ── Host: create tournament ───────────────────────────────
    await setStatus(gridPage, 'host', 'Skapar turnering med 2 klubbar...')
    const $ = apiClient(hostPage)
    const clubIds = await ensureClubs($, CLUBS)
    const players = PLAYERS.map((p, i) => ({
      ...p,
      clubIndex: i < 4 ? clubIds[0] : clubIds[1],
    }))

    const { tid } = await createTournament(
      $,
      { name: 'Kodtest-GP', pairingSystem: 'Monrad', nrOfRounds: 3 },
      players,
    )
    await pairRound($, tid)
    await hostPage.reload()
    await waitForApi(hostPage)
    await dismissBanner(hostPage)

    // ── Host: select tournament ───────────────────────────────
    await setStatus(gridPage, 'host', 'Väljer turnering...')
    const sel = hostPage.getByTestId('tournament-selector').locator('select').first()
    await sel.locator('option', { hasText: 'Kodtest-GP' }).waitFor({ state: 'attached' })
    await demoClick(hostPage, sel)
    await sel.selectOption('Kodtest-GP')
    await hostPage.waitForTimeout(400)

    // ── Host: start Live ──────────────────────────────────────
    await setStatus(gridPage, 'host', 'Startar Live...')
    await demoClick(hostPage, hostPage.getByTestId('tab-headers').getByText('Live (Beta)'))
    await expect(hostPage.locator('.live-tab-container')).toBeVisible()
    await demoClick(hostPage, hostPage.locator('button', { hasText: 'Starta Live' }))
    await expect(hostPage.locator('.live-tab-hosting')).toBeVisible()
    await hostPage.waitForTimeout(500)

    // ── Host: scroll to club codes section ────────────────────
    const clubCodesSection = hostPage.getByTestId('club-codes')
    await clubCodesSection.scrollIntoViewIfNeeded()
    await hostPage.waitForTimeout(600)

    // ── Host: check Skara SK checkbox ─────────────────────────
    await setStatus(gridPage, 'host', 'Väljer Skara SK...')
    const skaraCheckbox = hostPage
      .locator('.live-tab-club-checkbox', { hasText: 'Skara SK' })
      .locator('input')
    await demoClick(hostPage, skaraCheckbox)
    await hostPage.waitForTimeout(800)

    // ── Host: read generated club code ────────────────────────
    const codeEl = hostPage.getByTestId('club-code-value')
    await expect(codeEl).toBeVisible()
    const formattedCode = await codeEl.textContent()
    expect(formattedCode).toBeTruthy()
    expect(formattedCode).toMatch(/\d+ \d+/)

    await setStatus(gridPage, 'host', `Klubbkod: ${formattedCode}`)
    await hostPage.waitForTimeout(1500)

    // ── Host: get view URL (without club param) ───────────────
    const viewUrlEl = hostPage.locator('.live-tab-links .live-tab-url').first()
    await expect(viewUrlEl).toBeVisible()
    const viewUrl = (await viewUrlEl.textContent())!
    expect(viewUrl).toContain('share=view')
    expect(viewUrl).toContain('token=')

    // ── Viewer context (phone) ────────────────────────────────
    await setStatus(gridPage, 'viewer', 'Öppnar länken...')
    const viewerCtx = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 375, height: 812 },
      colorScheme: 'dark',
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 3,
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    })
    const viewerPage = await viewerCtx.newPage()
    await viewerPage.addInitScript(() => {
      localStorage.setItem('theme', 'dark')
      document.documentElement.setAttribute('data-theme', 'dark')
    })
    viewerPanel.page = viewerPage

    // ── Viewer: connect ───────────────────────────────────────
    await setStatus(gridPage, 'viewer', 'Ansluter...')
    await viewerPage.goto(viewUrl)

    // Wait for club code dialog and enter the code (digit-by-digit so the
    // auto-format is exercised and visible in the demo video)
    const codeDialog = viewerPage.getByTestId('club-code-dialog')
    await expect(codeDialog).toBeVisible({ timeout: 45_000 })
    await setStatus(gridPage, 'viewer', `Anger klubbkod: ${formattedCode}`)
    await gridPage.waitForTimeout(800)
    const codeInput = viewerPage.getByPlaceholder('### ###')
    const rawDigits = formattedCode!.replace(/\s/g, '')
    await codeInput.pressSequentially(rawDigits, { delay: 180 })
    // After typing all digits, the input should have auto-inserted a space
    await expect(codeInput).toHaveValue(formattedCode!)
    await gridPage.waitForTimeout(400)
    await viewerPage.getByTestId('club-code-submit').click()

    // Wait for spectator layout with club badge
    await expect(viewerPage.locator('.spectator-club-badge')).toContainText('Skara SK', {
      timeout: 45_000,
    })
    await gridPage.waitForTimeout(800)

    // ── Verify pairings ───────────────────────────────────────
    await setStatus(gridPage, 'viewer', 'Skara SK – lottning visas!')
    const pairings = viewerPage.getByTestId('spectator-pairings')
    await expect(pairings).toBeVisible()
    const rows = pairings.locator('tbody tr')
    const rowCount = await rows.count()
    expect(rowCount).toBeGreaterThan(0)

    // Skara SK players show full names
    const tableText = await pairings.locator('tbody').textContent()
    expect(tableText).toMatch(/Svensson|Lindberg|Andersson|Öberg/)

    await setStatus(gridPage, 'host', 'Klubbledaren ser sina spelare!')
    await gridPage.waitForTimeout(3000)

    // ── Cleanup ───────────────────────────────────────────────
    clearInterval(captureLoop)
    await viewerPage.close()
    await viewerCtx.close()
    await hostPage.close()
    await hostCtx.close()
    await gridPage.close()
    await gridCtx.close()
  })
})
