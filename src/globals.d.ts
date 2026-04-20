declare const __COMMIT_HASH__: string
declare const __COMMIT_DATE__: string
declare const __GIT_TAG__: string
declare const __ROLLBACK_VERSION__: string | null

interface ImportMetaEnv {
  readonly VITE_P2P_STRATEGY?: 'nostr' | 'mqtt'
  readonly VITE_HTTPS?: string
  readonly VITE_METERED_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
