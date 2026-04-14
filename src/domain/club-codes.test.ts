import { describe, expect, it } from 'vitest'
import { codeLength, formatClubCode, generateClubCode, verifyClubCode } from './club-codes'

describe('club access codes', () => {
  it('generates a deterministic code for a set of clubs', () => {
    const allClubs = ['SK Lansen', 'Kungsbacka SS']
    const code1 = generateClubCode(['SK Lansen', 'Kungsbacka SS'], allClubs, 'room-secret')
    const code2 = generateClubCode(['SK Lansen', 'Kungsbacka SS'], allClubs, 'room-secret')

    expect(code1).toBe(code2)
    expect(code1.length).toBeGreaterThan(0)
  })

  it('is order-independent — same clubs in any order produce same code', () => {
    const allClubs = ['SK Lansen', 'Kungsbacka SS']
    const code1 = generateClubCode(['SK Lansen', 'Kungsbacka SS'], allClubs, 'secret')
    const code2 = generateClubCode(['Kungsbacka SS', 'SK Lansen'], allClubs, 'secret')

    expect(code1).toBe(code2)
  })

  it('verifies a code against all possible club combinations', () => {
    const allClubs = ['SK Lansen', 'Kungsbacka SS', 'Gothenborg SK']
    const secret = 'room-secret'
    const code = generateClubCode(['SK Lansen', 'Kungsbacka SS'], allClubs, secret)

    const result = verifyClubCode(code, allClubs, secret)

    expect(result).toEqual(['Kungsbacka SS', 'SK Lansen'])
  })

  it('returns null for an invalid code', () => {
    const allClubs = ['SK Lansen', 'Kungsbacka SS']
    const result = verifyClubCode('ZZZZZZ', allClubs, 'secret')

    expect(result).toBeNull()
  })

  it('produces different codes for the same clubs with different secrets', () => {
    const allClubs = ['SK Lansen', 'Kungsbacka SS']
    const code1 = generateClubCode(allClubs, allClubs, 'secret-a')
    const code2 = generateClubCode(allClubs, allClubs, 'secret-b')

    expect(code1).not.toBe(code2)
  })

  it('produces different codes for different club selections', () => {
    const allClubs = ['SK Lansen', 'Kungsbacka SS']
    const secret = 'same-secret'
    const code1 = generateClubCode(['SK Lansen'], allClubs, secret)
    const code2 = generateClubCode(['Kungsbacka SS'], allClubs, secret)

    expect(code1).not.toBe(code2)
  })

  it('handles the __CLUBLESS__ key alongside real clubs', () => {
    const allEntries = ['SK Lansen', '__CLUBLESS__']
    const secret = 'room-secret'
    const code = generateClubCode(allEntries, allEntries, secret)
    const result = verifyClubCode(code, allEntries, secret)

    expect(result).toEqual(['SK Lansen', '__CLUBLESS__'].sort())
  })

  it('produces 6-digit codes for small club counts', () => {
    const allClubs = ['Club A', 'Club B', 'Club C']
    const code = generateClubCode(['Club A'], allClubs, 'secret')
    expect(code).toMatch(/^\d{6}$/)
  })

  it('produces 8-digit codes for 15 clubs', () => {
    const allClubs = Array.from({ length: 15 }, (_, i) => `Club ${i}`)
    const code = generateClubCode(['Club 0'], allClubs, 'secret')
    expect(code).toMatch(/^\d{8}$/)
  })

  it('never produces collisions across all subsets', () => {
    const allClubs = ['A', 'B', 'C', 'D', 'E']
    const secret = 'test-secret'
    const codes = new Set<string>()
    const n = allClubs.length
    for (let mask = 1; mask < 1 << n; mask++) {
      const subset = allClubs.filter((_, i) => mask & (1 << i))
      const code = generateClubCode(subset, allClubs, secret)
      codes.add(code)
    }
    // 2^5 - 1 = 31 subsets, all should have unique codes
    expect(codes.size).toBe(31)
  })

  it('avoids collisions for 13 clubs', () => {
    const allClubs = Array.from({ length: 13 }, (_, i) => `Club ${i}`)
    const secret = 'collision-test'
    const sampleCode = generateClubCode(['Club 0'], allClubs, secret)
    expect(sampleCode).toMatch(/^\d{6}$/)
    // Verify every subset gets a unique code by checking round-trip for a few
    const result = verifyClubCode(sampleCode, allClubs, secret)
    expect(result).toEqual(['Club 0'])
    // Generate codes for several different subsets and check they differ
    const code1 = generateClubCode(['Club 0', 'Club 1'], allClubs, secret)
    const code2 = generateClubCode(['Club 0', 'Club 2'], allClubs, secret)
    const code3 = generateClubCode(['Club 1', 'Club 2'], allClubs, secret)
    const codes = new Set([sampleCode, code1, code2, code3])
    expect(codes.size).toBe(4)
  })

  it('round-trips every subset for 10 clubs without collision', () => {
    const allClubs = Array.from({ length: 10 }, (_, i) => `C${i}`)
    const secret = 'exhaustive'
    const n = allClubs.length
    const total = (1 << n) - 1 // 1023 subsets
    const codes = new Set<string>()
    for (let mask = 1; mask <= total; mask++) {
      const subset = allClubs.filter((_, i) => mask & (1 << i))
      const code = generateClubCode(subset, allClubs, secret)
      codes.add(code)
      const verified = verifyClubCode(code, allClubs, secret)
      expect(verified).toEqual([...subset].sort())
    }
    expect(codes.size).toBe(1023)
  })

  it('formats codes with a space in the middle', () => {
    expect(formatClubCode('1234')).toBe('12 34')
    expect(formatClubCode('123456')).toBe('123 456')
    expect(formatClubCode('12345678')).toBe('1234 5678')
  })

  it('verifies a code produced by the collision-free generator', () => {
    const allClubs = ['Alpha', 'Beta', 'Gamma']
    const secret = 'room-secret'
    const code = generateClubCode(['Alpha', 'Beta'], allClubs, secret)
    const result = verifyClubCode(code, allClubs, secret)
    expect(result).toEqual(['Alpha', 'Beta'])
  })

  it('verifies codes entered with spaces (matching the formatted display)', () => {
    const allClubs = ['Alpha', 'Beta', 'Gamma']
    const secret = 'room-secret'
    const code = generateClubCode(['Gamma'], allClubs, secret)
    const formatted = formatClubCode(code)
    expect(formatted).toContain(' ')
    const result = verifyClubCode(formatted, allClubs, secret)
    expect(result).toEqual(['Gamma'])
  })

  it('verifies codes entered with dashes (for users who type the old separator)', () => {
    const allClubs = ['Alpha', 'Beta', 'Gamma']
    const secret = 'room-secret'
    const code = generateClubCode(['Gamma'], allClubs, secret)
    const mid = Math.floor(code.length / 2)
    const dashed = `${code.slice(0, mid)}-${code.slice(mid)}`
    const result = verifyClubCode(dashed, allClubs, secret)
    expect(result).toEqual(['Gamma'])
  })

  it('keeps false-valid rate below 1% for all club counts', () => {
    for (let n = 1; n <= 30; n++) {
      const digits = codeLength(n)
      const space = Math.pow(10, digits)
      const validMasks = (1 << n) - 1
      const falseValidRate = validMasks / space
      expect(
        falseValidRate,
        `n=${n}: ${(falseValidRate * 100).toFixed(1)}% false-valid rate`,
      ).toBeLessThan(0.01)
    }
  })

  it('returns empty string when club count exceeds the safe limit', () => {
    const allClubs = Array.from({ length: 31 }, (_, i) => `Club ${i}`)
    const code = generateClubCode(['Club 0'], allClubs, 'secret')
    expect(code).toBe('')
  })

  it('generates an all-clubs code when all clubs are selected', () => {
    const allClubs = ['SK Lansen', 'Kungsbacka SS', 'Gothenborg SK']
    const secret = 'room-secret'
    const code = generateClubCode(allClubs, allClubs, secret)
    const result = verifyClubCode(code, allClubs, secret)

    expect(result).toEqual([...allClubs].sort())
  })
})
