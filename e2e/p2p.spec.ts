/* eslint local/no-class-locators: "off" -- structural traversal (.live-tab-*, .live-page, .live-iframe) */

import { apiClient, createTournament, type PlayerInput, pairRound, waitForApi } from './api-helpers'
import { expect, type Page, test } from './fixtures'

const PLAYERS: PlayerInput[] = [
  { lastName: 'Eriksson', firstName: 'Anna', ratingI: 1800 },
  { lastName: 'Svensson', firstName: 'Erik', ratingI: 1700 },
  { lastName: 'Johansson', firstName: 'Karin', ratingI: 1600 },
  { lastName: 'Karlsson', firstName: 'Lars', ratingI: 1500 },
]

/** Add WebRTC debug logging to a page (no IP patching) */
function rtcDebugScript(label: string): string {
  return `(() => {
  const OrigPC = window.RTCPeerConnection;
  window.RTCPeerConnection = new Proxy(OrigPC, {
    construct(target, args) {
      const pc = new target(...args);
      console.log('[${label}] RTCPeerConnection created, iceServers:', JSON.stringify(args[0]?.iceServers?.length ?? 0));
      pc.addEventListener('connectionstatechange', () =>
        console.log('[${label}] conn: ' + pc.connectionState));
      pc.addEventListener('iceconnectionstatechange', () =>
        console.log('[${label}] ice: ' + pc.iceConnectionState));
      pc.addEventListener('icegatheringstatechange', () =>
        console.log('[${label}] gathering: ' + pc.iceGatheringState));
      pc.addEventListener('icecandidate', (e) => {
        if (e.candidate) console.log('[${label}] candidate: ' + e.candidate.type + ' ' + e.candidate.protocol);
      });
      return pc;
    }
  });
  window.RTCPeerConnection.prototype = OrigPC.prototype;
})()`
}

async function setupPage(page: Page, label: string) {
  await page.addInitScript(rtcDebugScript(label))
}

test.describe('P2P peer discovery', () => {
  test.setTimeout(60_000)

  test('organizer and viewer discover each other', async ({ page, browser }) => {
    const logs: string[] = []
    page.on('console', (msg) => logs.push(`[org ${msg.type()}] ${msg.text()}`))

    // ── Context A: Organizer ──────────────────────────────────────────
    await setupPage(page, 'ORG')
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)

    const { tid } = await createTournament(
      $,
      { name: 'P2P-test', pairingSystem: 'Monrad', nrOfRounds: 3 },
      PLAYERS,
    )
    await pairRound($, tid)

    await page.reload()
    await waitForApi(page)

    // Select tournament
    const tournamentSelect = page.getByTestId('tournament-selector').locator('select').first()
    await tournamentSelect.locator('option', { hasText: 'P2P-test' }).waitFor({ state: 'attached' })
    await tournamentSelect.selectOption('P2P-test')
    await expect(page.getByTestId('data-table')).toBeVisible()

    // Navigate to Live tab and start hosting
    await page.getByTestId('tab-headers').getByText('Live (Beta)').click()
    await expect(page.locator('.live-tab-container')).toBeVisible()
    await page.locator('button', { hasText: 'Starta Live' }).click()
    await expect(page.locator('.live-tab-hosting')).toBeVisible()

    // Extract room code
    const roomCodeElement = page
      .locator('.live-tab-link-row')
      .filter({ hasText: 'Rumskod:' })
      .locator('code')
    const roomCode = await roomCodeElement.textContent()
    expect(roomCode).toBeTruthy()
    expect(roomCode!.length).toBe(6)

    await expect(page.locator('.live-tab-badge')).toContainText('0 anslutna')

    // ── Context B: Viewer ─────────────────────────────────────────────
    const viewerContext = await browser.newContext({ ignoreHTTPSErrors: true })
    const viewerPage = await viewerContext.newPage()
    viewerPage.on('console', (msg) => logs.push(`[view ${msg.type()}] ${msg.text()}`))

    await setupPage(viewerPage, 'VIEW')
    await viewerPage.goto(`/live/${roomCode}`)
    await expect(viewerPage.locator('.live-page')).toBeVisible()

    // ── Wait for peer discovery ───────────────────────────────────────
    try {
      await expect(page.locator('.live-tab-badge')).not.toContainText('0 anslutna', {
        timeout: 45000,
      })
    } catch (e) {
      console.log('=== CAPTURED CONSOLE LOGS ===')
      for (const line of logs) console.log(line)
      console.log('=== END LOGS ===')
      throw e
    }

    // Viewer should receive tournament data (iframe with pairing HTML)
    await expect(viewerPage.locator('.live-iframe')).toBeVisible({ timeout: 45000 })

    // ── Cleanup ───────────────────────────────────────────────────────
    await viewerPage.close()
    await viewerContext.close()
  })
})
