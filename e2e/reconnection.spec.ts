/* eslint local/no-class-locators: "off" -- structural traversal (.live-tab-*, .context-menu) */
/* eslint no-restricted-syntax: "off" -- demo video needs waitForTimeout for pacing */

import type { Locator, Page } from '@playwright/test'
import { readFileSync } from 'fs'
import {
  type ApiClient,
  apiClient,
  createTournament,
  type PlayerInput,
  pairRound,
  waitForApi,
} from './api-helpers'
import { expect, test } from './fixtures'

const PLAYERS: PlayerInput[] = [
  { lastName: 'Eriksson', firstName: 'Anna', ratingI: 1800 },
  { lastName: 'Svensson', firstName: 'Erik', ratingI: 1750 },
  { lastName: 'Johansson', firstName: 'Karin', ratingI: 1700 },
  { lastName: 'Karlsson', firstName: 'Lars', ratingI: 1650 },
  { lastName: 'Nilsson', firstName: 'Sofia', ratingI: 1600 },
  { lastName: 'Pettersson', firstName: 'Oskar', ratingI: 1550 },
  { lastName: 'Andersson', firstName: 'Maria', ratingI: 1500 },
  { lastName: 'Lindberg', firstName: 'David', ratingI: 1450 },
  { lastName: 'Björk', firstName: 'Elsa', ratingI: 1400 },
  { lastName: 'Holm', firstName: 'Gustav', ratingI: 1350 },
  { lastName: 'Bergström', firstName: 'Ida', ratingI: 1300 },
  { lastName: 'Forsberg', firstName: 'Johan', ratingI: 1250 },
  { lastName: 'Lund', firstName: 'Klara', ratingI: 1200 },
  { lastName: 'Nyström', firstName: 'Lukas', ratingI: 1150 },
  { lastName: 'Olofsson', firstName: 'Maja', ratingI: 1100 },
  { lastName: 'Persson', firstName: 'Nils', ratingI: 1050 },
  { lastName: 'Rosén', firstName: 'Olivia', ratingI: 1000 },
  { lastName: 'Sjöberg', firstName: 'Peter', ratingI: 950 },
  { lastName: 'Thorén', firstName: 'Rebecka', ratingI: 900 },
  { lastName: 'Wallin', firstName: 'Simon', ratingI: 850 },
]

// ---------------------------------------------------------------------------
// Grid helpers — desktop + phone composite
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
  { bg: '#1e2d4a', text: '#7cb3f0', arrow: '#1e2d4a' }, // client: blue
]

function generateGridHtml(): string {
  const panels = [
    { id: 'host', type: 'desktop' as const },
    { id: 'client', type: 'mobile' as const },
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
      <div class="device phone" style="height:85%">
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
<html><head><title>Lotta - Reconnection Demo</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#e8e8ed; }
  .grid {
    display:flex; align-items:flex-end; justify-content:center;
    gap:60px; width:100vw; height:100vh; padding:40px 80px 48px;
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
    width:100%; height:100%; object-fit:cover; object-position:top center; display:block;
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
// Camera app mock — phone scanning QR code from host
// ---------------------------------------------------------------------------

function generateQrSvg(size: number): string {
  const n = 21
  const g: boolean[][] = Array.from({ length: n }, () => Array(n).fill(false))

  function addFinder(sx: number, sy: number) {
    for (let y = 0; y < 7; y++)
      for (let x = 0; x < 7; x++) {
        const border = x === 0 || x === 6 || y === 0 || y === 6
        const center = x >= 2 && x <= 4 && y >= 2 && y <= 4
        g[sy + y][sx + x] = border || center
      }
  }
  addFinder(0, 0)
  addFinder(14, 0)
  addFinder(0, 14)

  // Timing patterns
  for (let i = 8; i < 13; i++) {
    g[6][i] = i % 2 === 0
    g[i][6] = i % 2 === 0
  }

  // Data modules (deterministic scatter)
  const data = [
    [8, 8],
    [10, 8],
    [12, 8],
    [9, 9],
    [11, 9],
    [13, 9],
    [8, 10],
    [10, 10],
    [12, 10],
    [9, 11],
    [11, 11],
    [8, 12],
    [10, 12],
    [12, 12],
    [14, 8],
    [16, 8],
    [18, 8],
    [15, 9],
    [17, 9],
    [19, 9],
    [14, 10],
    [16, 10],
    [20, 10],
    [15, 11],
    [17, 11],
    [19, 11],
    [14, 12],
    [18, 12],
    [20, 12],
    [8, 14],
    [10, 14],
    [12, 14],
    [9, 15],
    [11, 15],
    [13, 15],
    [8, 16],
    [10, 16],
    [12, 16],
    [9, 17],
    [11, 17],
    [8, 18],
    [10, 18],
    [12, 18],
    [14, 14],
    [16, 14],
    [18, 14],
    [20, 14],
    [15, 15],
    [17, 15],
    [19, 15],
    [14, 16],
    [16, 16],
    [18, 16],
    [20, 16],
    [15, 17],
    [19, 17],
    [14, 18],
    [16, 18],
    [20, 18],
    [17, 19],
    [19, 19],
    [14, 20],
    [16, 20],
    [18, 20],
    [20, 20],
  ]
  for (const [x, y] of data) if (x < n && y < n) g[y][x] = true

  let rects = ''
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      if (g[y][x]) rects += `<rect x="${x}" y="${y}" width="1" height="1"/>`

  return `<svg viewBox="-1.5 -1.5 ${n + 3} ${n + 3}" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect x="-1.5" y="-1.5" width="${n + 3}" height="${n + 3}" fill="white" rx="1.5"/>
    <g fill="#111">${rects}</g>
  </svg>`
}

function generateCameraAppHtml(): string {
  const qr = generateQrSvg(160)
  return `<!DOCTYPE html>
<html><head><meta name="viewport" content="width=375,initial-scale=1">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { height:100%; overflow:hidden; }
  body {
    background:#000; color:#fff;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
  }

  .camera-app {
    display:flex; flex-direction:column; height:100%;
  }

  /* ── iOS-style status bar ── */
  .cam-statusbar {
    display:flex; justify-content:space-between; align-items:center;
    padding:14px 24px 10px; font-size:15px; font-weight:600;
  }
  .cam-statusbar-icons { display:flex; gap:6px; align-items:center; }
  .cam-statusbar-icons svg { width:18px; height:18px; }

  /* ── Mode selector (Photo / Video / etc.) ── */
  .cam-modes {
    display:flex; justify-content:center; gap:20px;
    padding:8px 0 16px; font-size:13px; font-weight:500;
    color:rgba(255,255,255,0.4);
  }
  .cam-modes .active { color:#ffd700; }

  /* ── Viewfinder area ── */
  .cam-viewfinder {
    flex:1; display:flex; flex-direction:column;
    align-items:center; justify-content:center;
    position:relative;
  }

  /* ── QR target zone ── */
  .qr-target {
    width:220px; height:220px; position:relative;
    display:flex; align-items:center; justify-content:center;
  }

  /* ── Corner brackets ── */
  .bracket {
    position:absolute; width:44px; height:44px;
    transition: all 0.6s cubic-bezier(0.34,1.56,0.64,1);
  }
  .bracket::before, .bracket::after {
    content:''; position:absolute; background:#ffd700;
    border-radius:2px;
    transition: background 0.3s ease;
  }
  /* Top-left */
  .bracket.tl { top:0; left:0; }
  .bracket.tl::before { top:0; left:0; width:4px; height:28px; }
  .bracket.tl::after  { top:0; left:0; height:4px; width:28px; }
  /* Top-right */
  .bracket.tr { top:0; right:0; }
  .bracket.tr::before { top:0; right:0; width:4px; height:28px; }
  .bracket.tr::after  { top:0; right:0; height:4px; width:28px; }
  /* Bottom-left */
  .bracket.bl { bottom:0; left:0; }
  .bracket.bl::before { bottom:0; left:0; width:4px; height:28px; }
  .bracket.bl::after  { bottom:0; left:0; height:4px; width:28px; }
  /* Bottom-right */
  .bracket.br { bottom:0; right:0; }
  .bracket.br::before { bottom:0; right:0; width:4px; height:28px; }
  .bracket.br::after  { bottom:0; right:0; height:4px; width:28px; }

  /* ── Locked state ── */
  .bracket.locked { width:34px; height:34px; }
  .bracket.locked::before, .bracket.locked::after { background:#4ade80; }

  /* ── QR code ── */
  .qr-code {
    opacity:0;
    animation: qr-appear 0.6s ease forwards;
    animation-delay:0.4s;
    filter: drop-shadow(0 2px 12px rgba(255,255,255,0.15));
  }
  @keyframes qr-appear {
    0%   { opacity:0; transform:scale(0.92); }
    100% { opacity:1; transform:scale(1); }
  }

  /* ── Scanning line ── */
  .scan-line {
    position:absolute; left:15%; right:15%; height:2px;
    background: linear-gradient(90deg, transparent 0%, #ffd700 30%, #ffd700 70%, transparent 100%);
    animation: scan-sweep 1.8s ease-in-out infinite;
    opacity:0.8;
  }
  @keyframes scan-sweep {
    0%   { top:15%; opacity:0; }
    15%  { opacity:0.8; }
    85%  { opacity:0.8; }
    100% { top:85%; opacity:0; }
  }
  .bracket.locked ~ .scan-line { display:none; }

  /* ── Detected label ── */
  .cam-detected {
    margin-top:28px; text-align:center;
    font-size:15px; font-weight:500;
    opacity:0; transition: opacity 0.4s ease;
  }
  .cam-detected.visible { opacity:1; }
  .cam-detected-title {
    color:#4ade80; font-weight:600; font-size:14px;
    margin-bottom:4px;
  }
  .cam-detected-url {
    color:rgba(255,255,255,0.5); font-size:12px;
    font-family:'SF Mono',SFMono-Regular,Menlo,monospace;
  }

  /* ── Camera controls ── */
  .cam-controls {
    display:flex; align-items:center; justify-content:space-around;
    padding:24px 48px 48px;
  }
  .shutter {
    width:68px; height:68px; border:4px solid rgba(255,255,255,0.85);
    border-radius:50%; position:relative;
  }
  .shutter::after {
    content:''; position:absolute; inset:4px;
    background:rgba(255,255,255,0.9); border-radius:50%;
  }
  .cam-btn {
    width:32px; height:32px; display:flex;
    align-items:center; justify-content:center;
    opacity:0.5;
  }
  .cam-btn svg { width:24px; height:24px; }

  /* ── Subtle grid overlay ── */
  .cam-grid {
    position:absolute; inset:0; pointer-events:none;
    opacity:0.08;
  }
  .cam-grid-line {
    position:absolute; background:#fff;
  }
  .cam-grid-line.h1 { top:33.3%; left:0; right:0; height:1px; }
  .cam-grid-line.h2 { top:66.6%; left:0; right:0; height:1px; }
  .cam-grid-line.v1 { left:33.3%; top:0; bottom:0; width:1px; }
  .cam-grid-line.v2 { left:66.6%; top:0; bottom:0; width:1px; }
</style></head>
<body>
<div class="camera-app" data-testid="camera-viewfinder">
  <div class="cam-statusbar">
    <span>9:41</span>
    <div class="cam-statusbar-icons">
      <svg viewBox="0 0 18 18" fill="white"><path d="M1 12h2v4H1zM5 9h2v7H5zM9 6h2v10H9zM13 3h2v13h-2z" opacity="0.9"/></svg>
      <svg viewBox="0 0 18 18" fill="white"><path d="M9 3C5.7 3 2.8 4.6 1 7l1.4 1.4C3.9 6.6 6.3 5.4 9 5.4s5.1 1.2 6.6 3L17 7c-1.8-2.4-4.7-4-8-4zm0 4.8c-2 0-3.8.9-5 2.3l1.4 1.4c.9-1 2.1-1.7 3.6-1.7s2.7.6 3.6 1.7L14 10.1c-1.2-1.4-3-2.3-5-2.3zM9 12.6c-1 0-1.8.8-1.8 1.8S8 16.2 9 16.2s1.8-.8 1.8-1.8-.8-1.8-1.8-1.8z"/></svg>
      <svg viewBox="0 0 28 14" fill="white"><rect x="0" y="0" width="24" height="14" rx="3" stroke="white" stroke-width="1.5" fill="none" opacity="0.4"/><rect x="1.5" y="1.5" width="18" height="11" rx="1.5" fill="white"/><path d="M26 5v4a2 2 0 0 0 0-4z" opacity="0.4"/></svg>
    </div>
  </div>

  <div class="cam-modes">
    <span>TIDSFÖRDR.</span>
    <span>PORTRÄTT</span>
    <span class="active">FOTO</span>
    <span>VIDEO</span>
  </div>

  <div class="cam-viewfinder">
    <div class="cam-grid">
      <div class="cam-grid-line h1"></div>
      <div class="cam-grid-line h2"></div>
      <div class="cam-grid-line v1"></div>
      <div class="cam-grid-line v2"></div>
    </div>

    <div class="qr-target">
      <div class="bracket tl"></div>
      <div class="bracket tr"></div>
      <div class="bracket bl"></div>
      <div class="bracket br"></div>
      <div class="qr-code">${qr}</div>
      <div class="scan-line"></div>
    </div>

    <div class="cam-detected" id="cam-detected">
      <div class="cam-detected-title">Lotta \u2014 N\u00e4tverkstest</div>
      <div class="cam-detected-url">\u00d6ppna i Safari</div>
    </div>
  </div>

  <div class="cam-controls">
    <div class="cam-btn">
      <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
    </div>
    <div class="shutter"></div>
    <div class="cam-btn">
      <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><rect x="7" y="7" width="10" height="10" rx="1.5" fill="rgba(255,255,255,0.3)"/></svg>
    </div>
  </div>
</div>
</body></html>`
}

// ---------------------------------------------------------------------------
// UI interaction helpers
// ---------------------------------------------------------------------------

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

async function goToPairings(page: Page) {
  await page.getByTestId('tab-headers').getByText('Lottning & resultat').click()
  await page.waitForTimeout(300)
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

test.describe('P2P reconnection demo', () => {
  test.setTimeout(180_000)

  test('client loses connection and recovers with overlay', async ({ browser }) => {
    const baseURL = 'https://localhost:5174'

    // ── Grid page for composited video ──────────────────────────────
    const gridCtx = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      recordVideo: {
        dir: 'test-results/reconnection-videos/',
        size: { width: 1920, height: 1080 },
      },
    })
    const gridPage = await gridCtx.newPage()
    await gridPage.setContent(generateGridHtml())

    // ── Panels ────────────────────────────────────────────────────
    const hostPanel = { id: 'host', page: null as Page | null }
    const clientPanel = { id: 'client', page: null as Page | null }
    const allPanels = [hostPanel, clientPanel]

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

    // ── Host: create tournament ─────────────────────────────────
    await setStatus(gridPage, 'host', 'Skapar turnering...')
    const $ = apiClient(hostPage)
    const { tid } = await createTournament(
      $,
      { name: 'Nätverkstest', pairingSystem: 'Monrad', nrOfRounds: 3 },
      PLAYERS,
    )
    await pairRound($, tid)
    await hostPage.reload()
    await waitForApi(hostPage)
    await dismissBanner(hostPage)

    // ── Host: select tournament ─────────────────────────────────
    await setStatus(gridPage, 'host', 'Väljer turnering...')
    const sel = hostPage.getByTestId('tournament-selector').locator('select').first()
    await sel.locator('option', { hasText: 'Nätverkstest' }).waitFor({ state: 'attached' })
    await sel.selectOption('Nätverkstest')
    await hostPage.waitForTimeout(400)

    // ── Host: start Live ────────────────────────────────────────
    await setStatus(gridPage, 'host', 'Startar Live-delning...')
    await demoClick(hostPage, hostPage.getByTestId('tab-headers').getByText('Live (Beta)'))
    await expect(hostPage.locator('.live-tab-container')).toBeVisible()
    await demoClick(hostPage, hostPage.locator('button', { hasText: 'Starta Live' }))
    await expect(hostPage.locator('.live-tab-hosting')).toBeVisible()
    await hostPage.waitForTimeout(500)

    // ── Extract referee share URL ───────────────────────────────
    await demoClick(hostPage, hostPage.getByRole('tab', { name: 'Dela vy' }))
    const refUrlEl = hostPage.getByTestId('vydelning-url')
    await expect(refUrlEl).toBeVisible()
    const shareUrl = (await refUrlEl.textContent())!
    expect(shareUrl).toContain('share=full')

    // ── Host stays on QR code view while phone scans ──────────
    await setStatus(gridPage, 'host', 'Visar QR-kod för anslutning...')

    // ── Client phone: camera scanning sequence ──────────────────
    const clientCtx = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 375, height: 812 },
      colorScheme: 'dark',
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    })
    const clientPage = await clientCtx.newPage()
    clientPanel.page = clientPage

    // Serve logo from disk so it's available even when offline (no SW in dev)
    const logoBytes = readFileSync('public/lotta-icon-512.png')
    await clientPage.route('/lotta-icon-512.png', (route) =>
      route.fulfill({ body: logoBytes, contentType: 'image/png' }),
    )

    // Show camera viewfinder on phone
    await setStatus(gridPage, 'client', 'Öppnar kameran...')
    await clientPage.setContent(generateCameraAppHtml())
    await expect(clientPage.getByTestId('camera-viewfinder')).toBeVisible({ timeout: 5_000 })

    // Bracket lock-on animation
    await gridPage.waitForTimeout(2500)
    await clientPage.evaluate(() => {
      document.querySelectorAll('.bracket').forEach((b) => b.classList.add('locked'))
      document.getElementById('cam-detected')?.classList.add('visible')
    })
    await setStatus(gridPage, 'client', 'QR-kod identifierad!')
    await gridPage.waitForTimeout(2500)

    // Navigate to the actual share URL
    await clientPage.addInitScript((theme) => {
      localStorage.setItem('theme', theme)
      document.documentElement.setAttribute('data-theme', theme)
    }, 'dark')
    await setStatus(gridPage, 'client', 'Laddar Lotta...')
    await clientPage.goto(shareUrl)

    // Wait for P2P connection
    await expect(
      clientPage.getByTestId('tournament-selector').locator('option', { hasText: 'Nätverkstest' }),
    ).toBeAttached({ timeout: 45_000 })
    await dismissBanner(clientPage)
    const clientSel = clientPage.getByTestId('tournament-selector').locator('select').first()
    await clientSel.selectOption('Nätverkstest')
    await clientPage.waitForTimeout(300)
    await clientPage.getByTestId('tab-headers').getByText('Lottning & resultat').click()
    await expect(clientPage.getByTestId('data-table')).toBeVisible()
    await setStatus(gridPage, 'client', 'Domare ansluten!')
    await setStatus(gridPage, 'host', 'Domare ansluten — 1 peer')
    await gridPage.waitForTimeout(1000)

    // ── Host: go to pairings ────────────────────────────────────
    await goToPairings(hostPage)
    await expect(hostPage.getByTestId('data-table')).toBeVisible()
    await gridPage.waitForTimeout(1000)

    // ── Host enters first result while both online ──────────────
    await setStatus(gridPage, 'host', 'Matar in resultat på bord 1...')
    await enterResult(hostPage, 1, 'Vit vinst')
    await gridPage.waitForTimeout(500)

    // Verify sync to client
    await setStatus(gridPage, 'client', 'Väntar på resultat...')
    await expect(clientPage.getByTestId('result-dropdown-1')).toContainText('1-0', {
      timeout: 15_000,
    })
    await setStatus(gridPage, 'client', 'Bord 1: 1-0 mottaget!')
    await gridPage.waitForTimeout(2000)

    // ── Client goes offline (phone lock) ────────────────────────
    await setStatus(gridPage, 'client', '📱 Skärmen låses...')
    await gridPage.waitForTimeout(1500)
    await clientCtx.setOffline(true)
    await setStatus(gridPage, 'client', '🔒 Offline — anslutning tappad')

    // Assert: reconnecting overlay appears
    await expect(clientPage.getByTestId('reconnecting-overlay')).toBeVisible({ timeout: 15_000 })
    await gridPage.waitForTimeout(3000)

    // ── Host enters remaining round 1 results while client is offline ─
    const r1Results: [number, string][] = [
      [2, 'Svart vinst'],
      [3, 'Vit vinst'],
      [4, 'Remi'],
      [5, 'Vit vinst'],
      [6, 'Svart vinst'],
      [7, 'Remi'],
      [8, 'Vit vinst'],
      [9, 'Svart vinst'],
      [10, 'Vit vinst'],
    ]
    for (const [board, result] of r1Results) {
      await setStatus(gridPage, 'host', `Rond 1 bord ${board} (offline)...`)
      await enterResult(hostPage, board, result)
      await gridPage.waitForTimeout(400)
    }
    await gridPage.waitForTimeout(800)

    // ── Host pairs round 2 via menu while client is still offline ─
    await setStatus(gridPage, 'host', 'Lottar rond 2...')
    await hostPage.getByTestId('menu-bar').getByRole('button', { name: 'Lotta' }).click()
    await hostPage.waitForTimeout(300)
    await hostPage.getByRole('button', { name: 'Lotta n\u00e4sta rond' }).click()
    await hostPage.waitForTimeout(1000)

    // Verify round 2 is active on host
    const hostRoundSel = hostPage.getByTestId('tournament-selector').locator('select').nth(2)
    await expect(hostRoundSel.locator('option', { hasText: 'Rond 2' })).toBeAttached({
      timeout: 15_000,
    })
    await hostRoundSel.selectOption({ label: 'Rond 2' })
    await hostPage.waitForTimeout(400)
    await expect(hostPage.getByTestId('data-table')).toBeVisible()

    // ── Host enters round 2 results while client is still offline ─
    const r2Results: [number, string][] = [
      [1, 'Svart vinst'],
      [2, 'Vit vinst'],
      [3, 'Remi'],
      [4, 'Vit vinst'],
      [5, 'Svart vinst'],
      [6, 'Vit vinst'],
      [7, 'Remi'],
      [8, 'Svart vinst'],
      [9, 'Vit vinst'],
      [10, 'Remi'],
    ]
    for (const [board, result] of r2Results) {
      await setStatus(gridPage, 'host', `Rond 2 bord ${board} (offline)...`)
      await enterResult(hostPage, board, result)
      await gridPage.waitForTimeout(400)
    }
    await setStatus(gridPage, 'host', 'Rond 1 + 2 klara — väntar på domare')
    await gridPage.waitForTimeout(1500)

    // ── Client comes back online (phone unlock) ─────────────────
    await setStatus(gridPage, 'client', '🔓 Låser upp telefonen...')
    await gridPage.waitForTimeout(1500)
    await clientCtx.setOffline(false)
    await setStatus(gridPage, 'client', 'Återansluter...')

    // Assert: overlay disappears after reconnection
    await expect(clientPage.getByTestId('reconnecting-overlay')).not.toBeVisible({
      timeout: 30_000,
    })
    await setStatus(gridPage, 'client', 'Ansluten igen!')
    await gridPage.waitForTimeout(1000)

    // Client auto-navigated to round 2 (latest) — verify round 2 results first
    const clientRoundSel = clientPage.getByTestId('tournament-selector').locator('select').nth(2)
    await expect(clientRoundSel.locator('option', { hasText: 'Rond 2' })).toBeAttached({
      timeout: 15_000,
    })

    const r2Expected: [number, string][] = [
      [1, '0-1'],
      [2, '1-0'],
      [3, '½-½'],
      [4, '1-0'],
      [5, '0-1'],
      [6, '1-0'],
      [7, '½-½'],
      [8, '0-1'],
      [9, '1-0'],
      [10, '½-½'],
    ]
    for (const [board, expected] of r2Expected) {
      await expect(clientPage.getByTestId(`result-dropdown-${board}`)).toContainText(expected, {
        timeout: 15_000,
      })
    }
    await setStatus(gridPage, 'client', 'Rond 2: alla 10 resultat synkade!')
    await gridPage.waitForTimeout(1500)

    // Switch to round 1 and verify those results too
    await clientRoundSel.selectOption({ label: 'Rond 1' })
    await clientPage.waitForTimeout(400)

    const r1Expected: [number, string][] = [
      [2, '0-1'],
      [3, '1-0'],
      [4, '½-½'],
      [5, '1-0'],
      [6, '0-1'],
      [7, '½-½'],
      [8, '1-0'],
      [9, '0-1'],
      [10, '1-0'],
    ]
    for (const [board, expected] of r1Expected) {
      await expect(clientPage.getByTestId(`result-dropdown-${board}`)).toContainText(expected, {
        timeout: 15_000,
      })
    }
    await setStatus(gridPage, 'client', 'Rond 1: alla 9 resultat synkade!')
    await setStatus(gridPage, 'host', '2 ronder + 19 resultat synkade!')
    await gridPage.waitForTimeout(3000)

    // ── Cleanup ─────────────────────────────────────────────────
    clearInterval(captureLoop)
    await clientPage.close()
    await clientCtx.close()
    await hostPage.close()
    await hostCtx.close()
    await gridPage.close()
    await gridCtx.close()
  })
})
