/* eslint local/no-class-locators: "off" -- minimal reproduction uses .live-* classes */

import fs from 'node:fs'
import path from 'node:path'
import { apiClient, createTournament, pairRound, waitForApi } from './api-helpers'
import { expect, test } from './fixtures'

const OUT_DIR = path.resolve('test-results/fix-screenshots')

interface ShotMeta {
  file: string
  title: string
  subtitle: string
  description: string
}

const shots: ShotMeta[] = []

function recordShot(meta: ShotMeta) {
  shots.push(meta)
}

test.beforeAll(() => {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  // Reset accumulator so re-runs produce a clean report.
  shots.length = 0
})

test.describe('Fix screenshots', () => {
  test('compact alphabetical pairings format', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)

    const { tid } = await createTournament(
      $,
      {
        name: 'Alfabetisk demo',
        group: 'Demo',
        pairingSystem: 'Monrad',
        nrOfRounds: 5,
        showGroup: true,
      },
      [
        { firstName: 'Kalle', lastName: 'Testsson', ratingI: 1800, playerGroup: 'A-klassen' },
        { firstName: 'Örjan', lastName: 'Efternamn', ratingI: 1700, playerGroup: 'A-klassen' },
        { firstName: 'Anna', lastName: 'Andersson', ratingI: 1600, playerGroup: 'B-klassen' },
        { firstName: 'Bo', lastName: 'Björk', ratingI: 1500, playerGroup: 'B-klassen' },
      ],
    )
    await pairRound($, tid)

    const html = await $.get(`/api/tournaments/${tid}/publish/alphabetical?round=1`)
    await page.setContent(html)

    const file = 'alphabetical.png'
    await page.screenshot({ path: path.join(OUT_DIR, file), fullPage: true })
    recordShot({
      file,
      title: 'Compact alphabetical pairings format',
      subtitle: 'publishHtml(tid, "alphabetical", 1)',
      description:
        'The exported HTML now renders each player on one row as "FirstName LastName lotNrColor, Opponent lotNrColor", grouped by class with a page break between classes, instead of reusing the regular board/white/black pairings table.',
    })
  })

  test('withdrawn player marker in PlayersTab', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)

    const { tid, addedPlayers } = await createTournament(
      $,
      {
        name: 'Utgått demo',
        group: 'Demo',
        pairingSystem: 'Monrad',
        nrOfRounds: 5,
      },
      [
        { firstName: 'Erik', lastName: 'Johansson', ratingI: 1800 },
        { firstName: 'Maria', lastName: 'Persson', ratingI: 1700 },
        { firstName: 'Siv', lastName: 'Åberg', ratingI: 1600 },
      ],
    )
    await pairRound($, tid)
    const siv = addedPlayers[2]
    await $.put(`/api/tournaments/${tid}/players/${siv.id}`, {
      ...siv,
      withdrawnFromRound: 2,
    })

    await page.goto(`/?tournamentId=${tid}&tab=players`)
    await expect(page.getByTestId('data-table')).toBeVisible()
    await expect(page.getByText('Siv Åberg (utgått r2)')).toBeVisible()

    const file = 'withdrawn-players-tab.png'
    await page.screenshot({ path: path.join(OUT_DIR, file), fullPage: true })
    recordShot({
      file,
      title: 'Withdrawn player marker — PlayersTab',
      subtitle: 'src/components/tabs/PlayersTab.tsx',
      description:
        'Players that have been withdrawn now show "(utgått rN)" next to their name, where N is the round they withdrew from. Previously withdrawn players were indistinguishable from active ones in this view.',
    })
  })

  test('withdrawn player marker in TournamentPlayersDialog', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)

    const { tid, addedPlayers } = await createTournament(
      $,
      {
        name: 'Dialog demo',
        group: 'Demo',
        pairingSystem: 'Monrad',
        nrOfRounds: 5,
      },
      [
        { firstName: 'Erik', lastName: 'Johansson', ratingI: 1800 },
        { firstName: 'Maria', lastName: 'Persson', ratingI: 1700 },
        { firstName: 'Siv', lastName: 'Åberg', ratingI: 1600 },
      ],
    )
    await pairRound($, tid)
    const siv = addedPlayers[2]
    await $.put(`/api/tournaments/${tid}/players/${siv.id}`, {
      ...siv,
      withdrawnFromRound: 3,
    })

    await page.goto(`/?tournamentId=${tid}&tab=pairings`)
    await expect(page.getByTestId('data-table')).toBeVisible()

    await page.getByTestId('menu-bar').getByRole('button', { name: 'Spelare' }).click()
    await page.getByTestId('menu-dropdown').getByText('Turneringsspelare', { exact: true }).click()

    const overlay = page.getByTestId('dialog-overlay')
    await expect(overlay).toBeVisible()
    await expect(overlay.getByText('Siv Åberg (utgått r3)')).toBeVisible()

    // The inner dialog box is the parent of the dialog-title element;
    // screenshot it directly to avoid the semi-transparent overlay bleeding
    // the underlying page content into the image.
    const dialogBox = page.getByTestId('dialog-title').locator('xpath=..')
    const file = 'withdrawn-tournament-players-dialog.png'
    await dialogBox.screenshot({ path: path.join(OUT_DIR, file) })
    recordShot({
      file,
      title: 'Withdrawn player marker — Tournament Players dialog',
      subtitle: 'src/components/dialogs/TournamentPlayersDialog.tsx',
      description:
        'Same suffix appears on the "I turneringen" tab of the Tournament Players dialog.',
    })
  })

  test('chess4 members default 20 in Schack4an setup', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)

    // Create clubs WITHOUT specifying chess4Members — they should pick up the new default of 20.
    const alfa = await $.post('/api/clubs', { name: 'SK Alfa' })
    const beta = await $.post('/api/clubs', { name: 'SK Beta' })
    const gamma = await $.post('/api/clubs', { name: 'SK Gamma' })

    const { tid } = await createTournament(
      $,
      {
        name: 'Schack4an demo',
        group: 'Demo',
        pairingSystem: 'Monrad',
        nrOfRounds: 3,
        chess4: true,
      },
      [
        { firstName: 'Anna', lastName: 'Andersson', ratingI: 1000, clubIndex: alfa.id },
        { firstName: 'Bo', lastName: 'Björk', ratingI: 900, clubIndex: alfa.id },
        { firstName: 'Cilla', lastName: 'Carlsson', ratingI: 1000, clubIndex: beta.id },
        { firstName: 'Dan', lastName: 'Dahl', ratingI: 900, clubIndex: beta.id },
        { firstName: 'Eva', lastName: 'Ek', ratingI: 1000, clubIndex: gamma.id },
        { firstName: 'Fia', lastName: 'Fält', ratingI: 900, clubIndex: gamma.id },
      ],
    )

    await page.goto(`/?tournamentId=${tid}&tab=chess4-setup`)
    await expect(page.getByTestId('data-table')).toBeVisible()

    // All three newly-created clubs should now show 20 (the new default) as their Klasstorlek.
    const rows = page.getByTestId('data-table').locator('tbody tr')
    await expect(rows).toHaveCount(3)
    for (let i = 0; i < 3; i++) {
      const valueCell = rows.nth(i).locator('input[type="number"]')
      await expect(valueCell).toHaveValue('20')
    }

    const file = 'chess4-members-default.png'
    await page.screenshot({ path: path.join(OUT_DIR, file), fullPage: true })
    recordShot({
      file,
      title: 'New club defaults to 20 Schack4an members',
      subtitle: 'src/db/repositories/clubs.ts',
      description:
        'Newly-created clubs now default their "Klasstorlek" (chess4Members — the number of pupils per class used as the denominator in the Schack4an score formula) to 20 instead of 0. The previous default produced a division-by-zero fallback that organizers had to manually fix for every club.',
    })
  })

  test('live-content scrolls on constrained viewport', async ({ page }) => {
    // Build a minimal reproduction of the `.live-page > .live-content` flex layout using
    // the real global.css. Before the fix, `.live-content { overflow: hidden }` would clip
    // the child content on short viewports. After the fix, `overflow-y: auto; min-height: 0`
    // makes it scrollable.
    const css = fs.readFileSync(path.resolve('src/styles/global.css'), 'utf-8')
    await page.setViewportSize({ width: 420, height: 520 })
    await page.setContent(
      `<!doctype html>
       <html>
       <head><meta charset="utf-8"><style>${css}</style></head>
       <body>
         <div class="live-page">
           <div class="live-header">
             <div class="live-header-brand">
               <strong>Live (Beta)</strong>
               <span> — demo</span>
             </div>
           </div>
           <main class="live-content">
             <div class="live-waiting">
               <h2>Söker värd…</h2>
               <p>Väntar på att turneringen delas.</p>
               ${Array.from({ length: 20 })
                 .map(
                   (_, i) =>
                     `<p style="padding:4px 16px">Demorad ${i + 1} — skrollbart innehåll på liten skärm.</p>`,
                 )
                 .join('\n')}
             </div>
           </main>
         </div>
       </body>
       </html>`,
    )

    // Verify the browser actually computes overflow-y: auto on .live-content — the fix.
    const computedOverflow = await page.evaluate(() => {
      const el = document.querySelector('.live-content') as HTMLElement | null
      if (!el) return null
      const style = getComputedStyle(el)
      return { overflowY: style.overflowY, minHeight: style.minHeight }
    })
    expect(computedOverflow?.overflowY).toBe('auto')
    expect(computedOverflow?.minHeight).toBe('0px')

    const file = 'live-content-scroll.png'
    await page.screenshot({ path: path.join(OUT_DIR, file), fullPage: false })
    recordShot({
      file,
      title: 'Live (Beta) tab content scrolls on small viewports',
      subtitle: 'src/styles/global.css — .live-content',
      description:
        'Changed `.live-content` from `overflow: hidden` to `overflow-y: auto; min-height: 0` so flex children can shrink and scroll their own content. Previously, a tall "söker värd" panel got clipped below the viewport on phones.',
    })
  })

  test.afterAll(() => {
    // Generate a self-contained HTML report with base64-embedded PNGs so the
    // file can be opened or shared without the sibling image files.
    if (shots.length === 0) return
    const rows = shots
      .map((s) => {
        const pngBytes = fs.readFileSync(path.join(OUT_DIR, s.file))
        const dataUri = `data:image/png;base64,${pngBytes.toString('base64')}`
        return `
      <section class="fix">
        <h2>${escapeHtml(s.title)}</h2>
        <p class="subtitle"><code>${escapeHtml(s.subtitle)}</code></p>
        <p>${escapeHtml(s.description)}</p>
        <img src="${dataUri}" alt="${escapeHtml(s.title)}" />
      </section>`
      })
      .join('\n')

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Lotta — Fix screenshots</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: -apple-system, system-ui, sans-serif; max-width: 960px; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; }
  h1 { border-bottom: 2px solid #888; padding-bottom: 0.3rem; }
  section.fix { margin: 2.5rem 0; padding: 1rem; border: 1px solid #aaa; border-radius: 8px; }
  section.fix h2 { margin-top: 0; }
  .subtitle { margin-top: -0.4rem; color: #666; }
  img { max-width: 100%; border: 1px solid #ccc; border-radius: 4px; margin-top: 0.8rem; }
  code { background: rgba(128,128,128,0.15); padding: 0 0.3em; border-radius: 3px; }
</style>
</head>
<body>
<h1>Lotta — Fix screenshots</h1>
<p>Generated by <code>e2e/fix-screenshots.spec.ts</code>. Each section shows one fix landed in this session, with a screenshot captured by the corresponding Playwright test.</p>
${rows}
</body>
</html>
`
    fs.writeFileSync(path.join(OUT_DIR, 'report.html'), html, 'utf-8')
  })
})

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
