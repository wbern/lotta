import { expect, type Page } from '@playwright/test'

/**
 * Shared harness for the "silent save failure" e2e specs.
 *
 * Every DB write funnels through withSave() -> DatabaseService.save() ->
 * saveDatabase() -> IndexedDB put() (src/db/persistence.ts). On a locked-down /
 * out-of-quota browser the put() throws and the mutation rejects. Many handlers
 * pass only onSuccess (no onError / try-catch), so the action silently does
 * nothing. These helpers let a test fail the next write deterministically and
 * assert that the user is actually told.
 */

/**
 * Patch IndexedDB writes to throw, gated by a window flag so app boot, initial DB
 * load and any apiClient seeding (done before arming) are unaffected.
 * Call BEFORE the first page.goto('/').
 */
export async function installStorageFailure(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __failIDBWrites?: boolean }
    w.__failIDBWrites = false
    const origPut = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function patchedPut(this: IDBObjectStore, ...args: unknown[]) {
      if (w.__failIDBWrites) {
        throw new DOMException('Simulated storage failure', 'QuotaExceededError')
      }
      // @ts-expect-error forward original args
      return origPut.apply(this, args)
    }
  })
}

/** Arm the failure: the next IndexedDB write will throw. */
export function armStorageFailure(page: Page): Promise<void> {
  return page.evaluate(() => {
    ;(window as unknown as { __failIDBWrites: boolean }).__failIDBWrites = true
  })
}

/**
 * Dismiss the always-on "Webbläsaren kan radera..." storage-risk warning toast.
 * It is unrelated to write failures but sits at the bottom of the screen and can
 * intercept clicks on dialog footer buttons. Best-effort: no-op if not present.
 */
export async function dismissStorageWarning(page: Page): Promise<void> {
  const warning = page.getByTestId('toast').filter({ hasText: 'Webbläsaren' })
  if (await warning.isVisible().catch(() => false)) {
    await warning.getByTestId('toast-dismiss').click()
    await warning.waitFor({ state: 'hidden' }).catch(() => {})
  }
}

/**
 * Assert that save-failure feedback reached the user. The app's standard
 * mechanism is a toast (data-testid="toast"); we exclude the always-on
 * "Webbläsaren kan radera..." storage-risk warning, which is unrelated to write
 * failures. The expected message is sv.player.saveFailed = "Kunde inte spara
 * ändringarna." (a sibling handler in TournamentPlayersDialog already uses it).
 */
export function expectSaveFailureFeedback(page: Page) {
  return expect(page.getByTestId('toast').filter({ hasNotText: 'Webbläsaren' })).toBeVisible()
}
