import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  project: ['src/**/*.{ts,tsx}'],
  ignore: ['src/globals.d.ts', 'src/build/pwa-register-stub.ts'],
  ignoreDependencies: [
    '@commitlint/cli',
    '@secretlint/core',
    '@secretlint/secretlint-rule-preset-recommend',
    'lint-staged',
  ],
  ignoreBinaries: ['pwa-assets-generator'],
}

export default config
