// No backend to stop — the app runs entirely in the browser.
export default async function globalTeardown() {
  console.log('[e2e] Frontend-only mode — no backend teardown needed.')
}
