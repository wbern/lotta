import { describe, expect, it } from 'vitest'
import { adjectives, generateRandomName, nouns } from './random-name'

describe('generateRandomName', () => {
  it('returns a name in the format "Adjective Noun Year"', () => {
    const name = generateRandomName()
    const parts = name.split(' ')
    expect(parts).toHaveLength(3)
    expect(parts[2]).toBe(String(new Date().getFullYear()))
  })

  it('capitalizes the first letter of each word', () => {
    const name = generateRandomName()
    const parts = name.split(' ')
    expect(parts[0][0]).toBe(parts[0][0].toUpperCase())
    expect(parts[1][0]).toBe(parts[1][0].toUpperCase())
  })

  it('uses words from the defined word lists', () => {
    const name = generateRandomName()
    const parts = name.split(' ')
    expect(adjectives).toContain(parts[0].toLowerCase())
    expect(nouns).toContain(parts[1].toLowerCase())
  })

  it('omits year when includeYear is false', () => {
    const name = generateRandomName({ includeYear: false })
    const parts = name.split(' ')
    expect(parts).toHaveLength(2)
    expect(adjectives).toContain(parts[0].toLowerCase())
    expect(nouns).toContain(parts[1].toLowerCase())
  })
})
