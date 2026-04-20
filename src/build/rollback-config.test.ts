import { describe, expect, it } from 'vitest'
import { rollbackBuildConfig } from './rollback-config'

describe('rollbackBuildConfig', () => {
  it('returns null when no rollback version is set', () => {
    expect(rollbackBuildConfig(null)).toBeNull()
  })

  it('derives base path, workbox cacheId, manifest id and names for a given version', () => {
    expect(rollbackBuildConfig('1.2.3')).toEqual({
      base: '/v/1.2.3/',
      cacheId: 'lotta-v1.2.3',
      manifestId: '/v/1.2.3/',
      manifestName: 'Lotta v1.2.3 (arkiv)',
      manifestShortName: 'Lotta v1.2.3',
    })
  })
})
