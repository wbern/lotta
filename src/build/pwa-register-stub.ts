// Stub for `virtual:pwa-register/react` used by rollback bundles.
// Rollback builds do not register a service worker, so the hook is inert.
export function useRegisterSW() {
  return {
    needRefresh: [false, () => {}] as [boolean, (value: boolean) => void],
    offlineReady: [false, () => {}] as [boolean, (value: boolean) => void],
    updateServiceWorker: async (_reloadPage?: boolean) => {},
  }
}
