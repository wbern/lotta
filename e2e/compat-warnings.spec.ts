/* eslint local/no-class-locators: "off" -- visual compositor uses structural selectors */
/* eslint no-restricted-syntax: "off" -- demo video needs waitForTimeout for pacing */

import type { Browser, Page } from '@playwright/test'
import { expect, test } from './fixtures'

// ---------------------------------------------------------------------------
// Device variants — each triggers a specific compat warning (or none)
// ---------------------------------------------------------------------------

interface DeviceVariant {
  label: string
  sublabel: string
  ua: string
  type: 'desktop' | 'phone' | 'tablet'
  expectedWarning: string | null
  severity: 'blocking' | 'warning' | null
}

const VARIANTS: DeviceVariant[] = [
  {
    label: 'Chrome',
    sublabel: 'Windows Desktop',
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    type: 'desktop',
    expectedWarning: null,
    severity: null,
  },
  {
    label: 'Safari',
    sublabel: 'iOS 17 · iPhone 15',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    type: 'phone',
    expectedWarning: null,
    severity: null,
  },
  {
    label: 'Opera Mini',
    sublabel: 'Android',
    ua: 'Opera/9.80 (Android; Opera Mini/36.2.2254/191.256; U; en) Presto/2.12.423 Version/12.16',
    type: 'phone',
    expectedWarning: 'opera-mini',
    severity: 'blocking',
  },
  {
    label: 'Mi Browser',
    sublabel: 'Xiaomi Redmi Note',
    ua: 'Mozilla/5.0 (Linux; U; Android 11; en-us; M2101K6G Build/RKQ1.200826.002) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/89.0.4389.116 Mobile Safari/537.36 XiaoMi/MiuiBrowser/15.4.12',
    type: 'phone',
    expectedWarning: 'mi-browser',
    severity: 'blocking',
  },
  {
    label: 'Samsung Internet',
    sublabel: 'Galaxy A12',
    ua: 'Mozilla/5.0 (Linux; Android 12; SM-A127F) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/20.0 Chrome/106.0.5249.126 Mobile Safari/537.36',
    type: 'phone',
    expectedWarning: 'samsung-a-series',
    severity: 'warning',
  },
  {
    label: 'Amazon Silk',
    sublabel: 'Kindle Fire',
    ua: 'Mozilla/5.0 (Linux; Android 11; KFTRWI) AppleWebKit/537.36 (KHTML, like Gecko) Silk/93.2.6 like Chrome/93.0.4577.82 Safari/537.36',
    type: 'tablet',
    expectedWarning: 'amazon-silk',
    severity: 'warning',
  },
  {
    label: 'Instagram',
    sublabel: 'iOS 14.0 · In-App',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram',
    type: 'phone',
    expectedWarning: 'ios-inapp-browser',
    severity: 'blocking',
  },
  {
    label: 'Safari',
    sublabel: 'iOS 14.8 · iPhone 7',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
    type: 'phone',
    expectedWarning: 'ios-old',
    severity: 'warning',
  },
]

// ---------------------------------------------------------------------------
// Grid HTML — device frames with labels
// ---------------------------------------------------------------------------

function badgeHtml(severity: 'blocking' | 'warning' | null): string {
  if (!severity) return '<span class="badge badge-ok">OK</span>'
  if (severity === 'blocking') return '<span class="badge badge-blocking">Blockerad</span>'
  return '<span class="badge badge-warning">Varning</span>'
}

function generateGridHtml(variants: DeviceVariant[]): string {
  const cols = 4
  const panelHtml = variants
    .map((v, idx) => {
      const isDesktop = v.type === 'desktop'
      const isTablet = v.type === 'tablet'

      const inner = isDesktop
        ? `<div class="monitor">
            <div class="screen">
              <div class="boot-logo">⏳</div>
              <img id="dev-${idx}-img" />
            </div>
            <div class="chin"></div>
          </div>
          <div class="neck"></div>
          <div class="foot"></div>`
        : `<div class="shell ${isTablet ? 'tablet-shell' : ''}">
            <div class="earpiece"></div>
            <div class="screen">
              <div class="boot-logo">⏳</div>
              <img id="dev-${idx}-img" />
            </div>
          </div>`

      return `
      <div class="slot" style="grid-column: ${(idx % cols) + 1}; grid-row: ${Math.floor(idx / cols) + 1};">
        <div class="device ${isDesktop ? 'desktop' : 'phone'} ${isTablet ? 'tablet' : ''}">
          ${inner}
        </div>
        <div class="label">
          ${badgeHtml(v.severity)}
          <span class="label-name">${v.label}</span>
          <span class="label-sub">${v.sublabel}</span>
        </div>
      </div>`
    })
    .join('\n')

  return `<!DOCTYPE html>
<html><head><title>Lotta — Kompatibilitetsvarningar</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#e8e8ed; font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
  h1 {
    text-align:center; padding:18px 0 8px; font-size:18px; color:#333;
    letter-spacing:0.02em; font-weight:600;
  }
  .grid {
    display:grid;
    grid-template-columns: repeat(${cols}, 1fr);
    gap: 12px 20px;
    width:100vw; padding: 4px 40px 20px;
    height: calc(100vh - 50px);
  }
  .slot {
    display:flex; flex-direction:column; align-items:center;
    justify-content:flex-end; min-height:0;
  }

  /* Labels */
  .label {
    display:flex; flex-direction:column; align-items:center;
    gap:2px; padding-top:6px;
  }
  .label-name { font-size:13px; font-weight:600; color:#222; }
  .label-sub { font-size:11px; color:#666; }
  .badge {
    font-size:10px; font-weight:700; text-transform:uppercase;
    padding: 2px 8px; border-radius:8px; letter-spacing:0.04em;
  }
  .badge-ok { background:#d4edda; color:#155724; }
  .badge-warning { background:#fff3cd; color:#856404; }
  .badge-blocking { background:#f8d7da; color:#721c24; }

  /* Shared screen */
  .screen { position:relative; }
  .boot-logo {
    position:absolute; inset:0; z-index:0;
    display:flex; align-items:center; justify-content:center;
    background:#111; font-size:32px;
  }
  .screen img { position:relative; z-index:1; }

  /* Desktop monitor */
  .device.desktop {
    width:100%; max-width:320px; display:flex; flex-direction:column;
    align-items:center; justify-content:flex-end;
  }
  .device.desktop .monitor {
    width:100%; display:flex; flex-direction:column;
    background: linear-gradient(170deg, #303035, #1c1c1e);
    border-radius: 8px; border: 2px solid #48484a;
    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    padding: 6px 6px 0 6px; aspect-ratio: 16 / 10;
  }
  .device.desktop .screen {
    flex:1; min-height:0; overflow:hidden; border-radius:2px; background:#000;
  }
  .device.desktop .screen img {
    width:100%; height:100%; object-fit:cover; object-position:top center; display:block;
  }
  .device.desktop .chin { height:16px; }
  .device.desktop .neck {
    width:30px; height:20px;
    background: linear-gradient(180deg, #2c2c2e, #232326);
    border-left: 1px solid #48484a; border-right: 1px solid #48484a;
  }
  .device.desktop .foot {
    width:90px; height:5px;
    background: linear-gradient(180deg, #38383a, #2c2c2e);
    border-radius: 1px 1px 4px 4px;
    border: 1px solid #48484a; border-top:none;
  }

  /* Phone */
  .device.phone {
    display:flex; flex-direction:column; align-items:center;
    justify-content:flex-end; height:90%;
  }
  .device.phone .shell {
    height:100%; min-height:0; aspect-ratio: 9 / 19.5;
    display:flex; flex-direction:column; align-items:center;
    background: linear-gradient(170deg, #303035, #1c1c1e);
    border-radius: 16px; border: 2px solid #48484a;
    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    padding: 6px 3px 8px 3px; overflow:hidden;
  }
  .device.phone .earpiece {
    width:28px; height:3px; background:#58585a; border-radius:2px;
    margin-bottom:4px; flex-shrink:0;
  }
  .device.phone .screen {
    flex:1; width:100%; min-height:0; overflow:hidden; border-radius:2px; background:#000;
  }
  .device.phone .screen img {
    width:100%; height:100%; object-fit:cover; object-position:top center; display:block;
  }

  /* Tablet variant */
  .device.tablet .shell.tablet-shell {
    aspect-ratio: 3 / 4;
    border-radius:12px;
  }
</style></head>
<body>
  <h1>Kompatibilitetsvarningar — Multiplayer</h1>
  <div class="grid">${panelHtml}</div>
</body></html>`
}

// ---------------------------------------------------------------------------
// Screenshot helpers
// ---------------------------------------------------------------------------

let capturing = false
async function captureDevice(gridPage: Page, idx: number, devicePage: Page) {
  if (capturing) return
  capturing = true
  try {
    const buf = await devicePage.screenshot()
    await gridPage.evaluate(
      ({ i, b64 }) => {
        const img = document.getElementById(`dev-${i}-img`) as HTMLImageElement
        if (img) img.src = `data:image/png;base64,${b64}`
      },
      { i: idx, b64: buf.toString('base64') },
    )
  } catch {
    // Page may not be ready
  }
  capturing = false
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

test.describe('compatibility warnings', () => {
  test('shows device-specific warnings on connecting screen', async ({ browser }) => {
    test.setTimeout(60_000)

    // --- Grid compositor page ---
    const gridContext = await browser.newContext({
      viewport: { width: 2560, height: 1440 },
      deviceScaleFactor: 2,
    })
    const gridPage = await gridContext.newPage()
    await gridPage.setContent(generateGridHtml(VARIANTS))
    await gridPage.waitForTimeout(300)

    // --- Create a page per variant ---
    const pages: Page[] = []
    for (const variant of VARIANTS) {
      const viewport =
        variant.type === 'desktop'
          ? { width: 1024, height: 768 }
          : variant.type === 'tablet'
            ? { width: 810, height: 1080 }
            : { width: 390, height: 844 }

      const ctx = await browser.newContext({
        userAgent: variant.ua,
        viewport,
        ignoreHTTPSErrors: true,
      })
      const page = await ctx.newPage()
      pages.push(page)
    }

    // --- Navigate all pages in parallel ---
    await Promise.all(pages.map((page) => page.goto('/live/COMPAT?share=view&token=compat-test')))

    // Wait for connecting screens to render
    await Promise.all(
      pages.map((page) =>
        page.locator('[data-testid="shared-provider-ready"]').waitFor({ timeout: 15_000 }),
      ),
    )

    // Short pause for warnings to render
    await pages[0].waitForTimeout(500)

    // --- Verify warnings and capture screenshots ---
    for (let i = 0; i < VARIANTS.length; i++) {
      const variant = VARIANTS[i]
      const page = pages[i]

      if (variant.expectedWarning) {
        const warning = page.locator('.compat-warning')
        await expect(warning.first()).toBeVisible({ timeout: 5_000 })
      } else {
        const warning = page.locator('.compat-warning')
        await expect(warning).toHaveCount(0)
      }

      // Logo must be vertically centered on all devices
      const logo = page.locator('.connecting-logo-wrapper')
      const logoBox = await logo.boundingBox()
      const viewport = page.viewportSize()!
      expect(logoBox, `${variant.label}: logo should be visible`).not.toBeNull()
      const logoCenterY = logoBox!.y + logoBox!.height / 2
      const viewportCenterY = viewport.height / 2
      expect(
        Math.abs(logoCenterY - viewportCenterY),
        `${variant.label} (${variant.sublabel}): logo center (${Math.round(logoCenterY)}) should be near viewport center (${viewportCenterY})`,
      ).toBeLessThan(10)

      await captureDevice(gridPage, i, page)
    }

    // Final compositor screenshot
    await gridPage.waitForTimeout(300)
    await gridPage.screenshot({
      path: 'test-results/compat-warnings-grid.png',
    })

    // --- Cleanup ---
    for (const page of pages) {
      await page.context().close()
    }
    await gridContext.close()
  })
})
