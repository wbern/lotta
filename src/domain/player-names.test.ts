import { describe, expect, it } from 'vitest'
import { withdrawnSuffix } from './player-names'

describe('withdrawnSuffix', () => {
  it('given a player withdrawn from round 3, when formatted, then " (utgått r3)" is appended (Java Player.toString)', () => {
    expect(withdrawnSuffix(3)).toBe(' (utgått r3)')
  })

  it('given a player who is not withdrawn (-1), when formatted, then there is no suffix', () => {
    expect(withdrawnSuffix(-1)).toBe('')
  })

  it('given a legacy 0 value, when formatted, then there is no suffix (0 = ej utgått)', () => {
    expect(withdrawnSuffix(0)).toBe('')
  })
})
