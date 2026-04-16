import { describe, expect, it } from 'vitest'
import { type ChangelogEntry, entriesSince, groupByDate, groupByType } from './changelog'

const entry = (overrides: Partial<ChangelogEntry>): ChangelogEntry => ({
  sha: 'abc1234',
  date: '2026-04-10',
  type: 'feat',
  scope: null,
  breaking: false,
  message: 'something',
  ...overrides,
})

describe('entriesSince', () => {
  it('returns entries newer than the matching SHA', () => {
    const entries = [
      entry({ sha: 'c', date: '2026-04-12' }),
      entry({ sha: 'b', date: '2026-04-11' }),
      entry({ sha: 'a', date: '2026-04-10' }),
    ]
    expect(entriesSince(entries, 'a', '2026-04-10 00:00 +0000')).toEqual([entries[0], entries[1]])
  })

  it('falls back to date comparison when SHA is not in the list', () => {
    const entries = [
      entry({ sha: 'c', date: '2026-04-12' }),
      entry({ sha: 'b', date: '2026-04-11' }),
    ]
    expect(entriesSince(entries, 'unknown', '2026-04-11 12:00 +0000')).toEqual([entries[0]])
  })

  it('returns everything when both SHA and date are missing', () => {
    const entries = [entry({ sha: 'c' })]
    expect(entriesSince(entries, '', '')).toEqual(entries)
  })

  it('returns empty when no entries', () => {
    expect(entriesSince([], 'abc', '2026-04-10')).toEqual([])
  })
})

describe('groupByType', () => {
  it('groups entries by type in feat/fix/perf order', () => {
    const entries = [
      entry({ type: 'fix', message: 'f1' }),
      entry({ type: 'feat', message: 'n1' }),
      entry({ type: 'perf', message: 'p1' }),
      entry({ type: 'feat', message: 'n2' }),
    ]
    const groups = groupByType(entries)
    expect(groups.map((g) => g.type)).toEqual(['feat', 'fix', 'perf'])
    expect(groups[0].entries.map((e) => e.message)).toEqual(['n1', 'n2'])
    expect(groups[1].label).toBe('Buggfixar')
  })

  it('omits empty groups', () => {
    const groups = groupByType([entry({ type: 'feat' })])
    expect(groups.map((g) => g.type)).toEqual(['feat'])
  })
})

describe('groupByDate', () => {
  it('groups by date in descending order', () => {
    const entries = [
      entry({ date: '2026-04-10', message: 'a' }),
      entry({ date: '2026-04-12', message: 'b' }),
      entry({ date: '2026-04-10', message: 'c' }),
    ]
    const groups = groupByDate(entries)
    expect(groups.map((g) => g.date)).toEqual(['2026-04-12', '2026-04-10'])
    expect(groups[1].entries.map((e) => e.message)).toEqual(['a', 'c'])
  })
})
