// No backend to start — the app runs entirely in the browser.
// The Vite dev server is managed by Playwright's webServer config.
export default async function globalSetup() {
  console.log('[e2e] Frontend-only mode — no backend setup needed.')
}
