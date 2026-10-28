import { describe, expect, it } from 'vitest'
import { normaliseWithdrawnFromRound } from './validation'

describe('normaliseWithdrawnFromRound', () => {
  it('given undefined, when normalised, then it stays undefined so updates skip the column', () => {
    expect(normaliseWithdrawnFromRound(undefined)).toBeUndefined()
  })

  it('given null, when normalised, then the player is not withdrawn (-1)', () => {
    expect(normaliseWithdrawnFromRound(null)).toBe(-1)
  })

  it('given 0 (cleared field, Java "Tomt fält eller 0 = ej utgått"), when normalised, then -1', () => {
    expect(normaliseWithdrawnFromRound(0)).toBe(-1)
  })

  it('given a negative round, when normalised, then -1', () => {
    expect(normaliseWithdrawnFromRound(-1)).toBe(-1)
    expect(normaliseWithdrawnFromRound(-7)).toBe(-1)
  })

  it('given a positive integer round, when normalised, then it is kept', () => {
    expect(normaliseWithdrawnFromRound(1)).toBe(1)
    expect(normaliseWithdrawnFromRound(3)).toBe(3)
  })

  it('given a non-integer, when normalised, then it throws the Swedish message', () => {
    expect(() => normaliseWithdrawnFromRound(1.5)).toThrow('Utgå från rond måste vara ett heltal.')
  })

  it('given NaN, when normalised, then it throws the Swedish message', () => {
    expect(() => normaliseWithdrawnFromRound(Number.NaN)).toThrow(
      'Utgå från rond måste vara ett heltal.',
    )
  })
})
