import { describe, expect, it } from 'vitest'
import { normaliseRatingChoice } from './ratings.ts'

describe('normaliseRatingChoice', () => {
  it.each([
    ['ELO', 'ELO'],
    ['QUICK', 'QUICK'],
    ['BLITZ', 'BLITZ'],
    ['QUICK_THEN_ELO', 'QUICK_THEN_ELO'],
    ['BLITZ_THEN_ELO', 'BLITZ_THEN_ELO'],
  ])('given the code %s, then it is kept', (input, expected) => {
    expect(normaliseRatingChoice(input)).toBe(expected)
  })

  it.each([
    ['Snabb-ELO', 'QUICK'],
    ['Blixt-ELO', 'BLITZ'],
    ['Snabb-ELO annars ELO', 'QUICK_THEN_ELO'],
    ['Blixt-ELO annars ELO', 'BLITZ_THEN_ELO'],
  ])('given the Swedish label "%s" saved by an older version, then it becomes %s', (input, expected) => {
    expect(normaliseRatingChoice(input)).toBe(expected)
  })

  it.each([
    [''],
    ['nonsense'],
    [null],
    [undefined],
  ])('given an unknown or missing value %s, then it falls back to ELO', (input) => {
    expect(normaliseRatingChoice(input as string | null | undefined)).toBe('ELO')
  })
})
