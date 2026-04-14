import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { defineConfig } from 'vitest/config'

function git(cmd: string): string {
  try {
    return execSync(`git ${cmd}`, { encoding: 'utf-8' }).trim()
  } catch {
    return ''
  }
}

const commitHash = git('rev-parse --short HEAD')
const commitDate = git('log -1 --format=%ci')
const gitTag = git('describe --tags --abbrev=0')

function generateVersionJson(): Plugin {
  const versionData = JSON.stringify({ hash: commitHash, date: commitDate, tag: gitTag })
  return {
    name: 'generate-version-json',
    buildStart() {
      // Write to public/ for dev mode
      writeFileSync(join(__dirname, 'public', 'version.json'), versionData)
    },
    writeBundle(options) {
      // Write to dist/ for production build
      const outDir = options.dir || join(__dirname, 'dist')
      mkdirSync(outDir, { recursive: true })
      writeFileSync(join(outDir, 'version.json'), versionData)
    },
  }
}

const certPath = join(__dirname, 'e2e', 'certs', 'cert.pem')
const keyPath = join(__dirname, 'e2e', 'certs', 'key.pem')
const useHttps = process.env.VITE_HTTPS === '1' && existsSync(certPath) && existsSync(keyPath)
const useMqtt = process.env.VITE_P2P_STRATEGY === 'mqtt'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  server: useHttps ? { https: { cert: readFileSync(certPath), key: readFileSync(keyPath) } } : {},
  resolve: useMqtt ? { alias: { trystero: '@trystero-p2p/mqtt' } } : {},
  define: {
    __COMMIT_HASH__: JSON.stringify(commitHash),
    __COMMIT_DATE__: JSON.stringify(commitDate),
    __GIT_TAG__: JSON.stringify(gitTag),
  },
  plugins: [
    generateVersionJson(),
    react(),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/sql.js/dist/sql-wasm-browser.wasm',
          dest: '',
          rename: { stripBase: true },
        },
      ],
    }),
    VitePWA({
      registerType: 'prompt',
      workbox: {
        globPatterns: ['**/*.{js,css,html,wasm,woff2,png,svg,ico}'],
        globIgnores: ['version.json'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      manifest: {
        name: 'Lotta - Schacklottning',
        short_name: 'Lotta',
        description: 'Hantera schackturneringar med lottning, ställning och publicering',
        lang: 'sv',
        start_url: '.',
        theme_color: '#0066cc',
        background_color: '#f0f0f0',
        display: 'standalone',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test-setup.ts'],
  },
})
