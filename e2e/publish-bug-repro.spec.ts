/**
 * Visual repro of the standings-publish tiebreak bug.
 *
 * Walkthrough captured on video:
 *   1. Restore the latest ~/Downloads/lotta-backup*.sqlite into the in-browser DB.
 *   2. Open tournament 4 (Regionfinal Schackfyran), Standings tab.
 *      → in-app table shows SSF Buchholz values (the React tab works).
 *   3. Open Ställning > Publicera..., click Ställning to download standings.html.
 *   4. Render the downloaded HTML in the same page with the empty Buchholz
 *      column outlined in red so it's obvious on the recording.
 *
 * Run: pnpm exec playwright test --project=publish-bug-repro
 * Video lands in: test-results/publish-bug-repro/ as video.webm
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { test } from '@playwright/test'

const TOURNAMENT_ID = 4
const PAUSE = 1500 // ms — give the video time to breathe at each step

type LottaApi = {
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
    .map((f) => ({ full: join(dir, f), mtime: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
  if (candidates.length === 0) throw new Error(`No lotta-backup*.sqlite in ${dir}`)
  return candidates[0].full
}

test.describe('Publish bug — standings tiebreak column always empty', () => {
  test.use({ viewport: { width: 1400, height: 900 } })
  test.setTimeout(2 * 60_000)

  test('Visual repro: in-app shows tiebreaks, downloaded HTML does not', async ({ browser }) => {
    const context = await browser.newContext({
      recordVideo: { dir: 'test-results/publish-bug-repro' },
      viewport: { width: 1400, height: 900 },
    })
    const page = await context.newPage()

    // Step 1 — restore backup.
    await page.goto('/')
    await page.waitForFunction(() => window.__lottaApi != null, null, { timeout: 30_000 })

    const backupB64 = readFileSync(findLatestBackup()).toString('base64')
    await page.evaluate(async (b64) => {
      const bin = atob(b64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      await window.__lottaApi.restoreDbBytes(bytes)
    }, backupB64)

    // Step 2 — navigate to standings tab. The React UI computes its own
    // column keys from Object.keys(tiebreaks), so it renders correctly.
    await page.goto(`/?tournamentId=${TOURNAMENT_ID}&tab=standings`)
    await page.locator('[data-testid="data-table"]').waitFor()
    await page.locator('table.data-table tbody tr').first().waitFor()
    await page.waitForTimeout(PAUSE)

    // Annotate the in-app standings: green outline on the SSF Buchholz column
    // header + first data cell so a viewer can see the values are present.
    await page.addStyleTag({
      content: `
        .data-table thead th:last-child,
        .data-table tbody tr td:last-child {
          outline: 3px solid #22c55e;
          outline-offset: -3px;
        }
        body::before {
          content: "1) In-app standings — SSF Buchholz column has values";
          position: fixed; top: 0; left: 0; right: 0;
          background: #22c55e; color: white; padding: 8px 16px;
          font: 600 14px/1.4 system-ui, sans-serif; z-index: 99999;
          text-align: center;
        }
        body { padding-top: 36px; }
      `,
    })
    await page.waitForTimeout(PAUSE * 2)

    // Step 3 — open Ställning > Publicera...
    await page
      .locator('body::before')
      .evaluate(() => {})
      .catch(() => {})
    // Remove the banner before menu interaction so it doesn't visually
    // block the menu in the recording.
    await page.evaluate(() => {
      for (const el of document.querySelectorAll('style')) {
        if (el.textContent?.includes('In-app standings')) el.remove()
      }
    })

    const menuBar = page.getByTestId('menu-bar')
    await menuBar.getByRole('button', { name: 'Ställning', exact: true }).click()
    await page.waitForTimeout(500)
    await page.getByRole('button', { name: 'Publicera...' }).click()
    await page.waitForTimeout(500)

    // Step 4 — capture the download triggered by the publish button.
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('[data-testid="publish-standings"]').click(),
    ])
    const downloadPath = await download.path()
    const publishedHtml = readFileSync(downloadPath, 'utf-8')

    // Step 5 — render the downloaded HTML in the SAME page so the video shows
    // it side-by-side with the previous step. Inject highlight + banner.
    const annotated = publishedHtml.replace(
      '</head>',
      `<style>
        body { padding-top: 56px !important; }
        body::before {
          content: "2) Published HTML (Ställning > Publicera...) — SSF Buchholz column EMPTY";
          position: fixed; top: 0; left: 0; right: 0;
          background: #ef4444; color: white; padding: 8px 16px;
          font: 600 14px/1.4 system-ui, sans-serif; z-index: 99999;
          text-align: center;
        }
        .CP_Table tr > *:last-child {
          outline: 3px solid #ef4444 !important;
          outline-offset: -3px;
          background: #fef2f2 !important;
        }
      </style></head>`,
    )
    await page.setContent(annotated)
    // Sit on this view for a bit so it's clearly visible in the recording.
    await page.waitForTimeout(PAUSE * 4)

    await context.close()

    console.log(`Video saved under test-results/publish-bug-repro/`)
  })
})
