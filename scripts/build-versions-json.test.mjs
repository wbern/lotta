import { describe, expect, it } from 'vitest'
import { buildVersionsJson } from './build-versions-json.mjs'

describe('buildVersionsJson', () => {
  it('returns an empty list when no versions are present', () => {
    expect(buildVersionsJson([])).toEqual({ versions: [] })
  })

  it('emits each entry with version, date and hash', () => {
    expect(
      buildVersionsJson([
        { version: '1.2.4', date: '2026-03-25', hash: 'def5678' },
        { version: '1.2.3', date: '2026-03-10', hash: 'abc1234' },
      ]),
    ).toEqual({
      versions: [
        { version: '1.2.4', date: '2026-03-25', hash: 'def5678' },
        { version: '1.2.3', date: '2026-03-10', hash: 'abc1234' },
      ],
    })
  })

  it('sorts versions newest-first by date', () => {
    const result = buildVersionsJson([
      { version: '1.0.0', date: '2026-01-01', hash: 'aaa' },
      { version: '1.2.0', date: '2026-03-01', hash: 'ccc' },
      { version: '1.1.0', date: '2026-02-01', hash: 'bbb' },
    ])
    expect(result.versions.map((v) => v.version)).toEqual(['1.2.0', '1.1.0', '1.0.0'])
  })

  it('tolerates missing date or hash metadata', () => {
    expect(buildVersionsJson([{ version: '1.0.0' }])).toEqual({
      versions: [{ version: '1.0.0', date: null, hash: null }],
    })
  })
})
