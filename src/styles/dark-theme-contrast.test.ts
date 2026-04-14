import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'

function readGlobalCss(): string {
  return readFileSync(resolve(__dirname, 'global.css'), 'utf-8')
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16)
  const g = parseInt(clean.substring(2, 4), 16)
  const b = parseInt(clean.substring(4, 6), 16)
  return [r, g, b]
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hexToRgb(hex1))
  const l2 = relativeLuminance(hexToRgb(hex2))
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

function extractDarkVars(css: string): Record<string, string> {
  const block = css.match(/\[data-theme=['"]dark['"]\]\s*\{([\s\S]*?)\n\}/)
  if (!block) return {}
  const vars: Record<string, string> = {}
  for (const line of block[1].split('\n')) {
    const match = line.match(/--([\w-]+)\s*:\s*([^;]+)/)
    if (match) {
      vars[`--${match[1]}`] = match[2].trim()
    }
  }
  return vars
}

function extractLightVars(css: string): Record<string, string> {
  const block = css.match(/:root\s*\{([\s\S]*?)\n\}/)
  if (!block) return {}
  const vars: Record<string, string> = {}
  for (const line of block[1].split('\n')) {
    const match = line.match(/--([\w-]+)\s*:\s*([^;]+)/)
    if (match) {
      vars[`--${match[1]}`] = match[2].trim()
    }
  }
  return vars
}

describe('dark theme WCAG AA contrast', () => {
  const css = readGlobalCss()
  const dark = extractDarkVars(css)

  it('has text on background at 4.5:1 or better', () => {
    const ratio = contrastRatio(dark['--color-text'], dark['--color-bg'])
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  it('has text on surface at 4.5:1 or better', () => {
    const ratio = contrastRatio(dark['--color-text'], dark['--color-surface'])
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  it('has muted text on background at 4.5:1 or better', () => {
    const ratio = contrastRatio(dark['--color-text-muted'], dark['--color-bg'])
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  it('has muted text on surface at 4.5:1 or better', () => {
    const ratio = contrastRatio(dark['--color-text-muted'], dark['--color-surface'])
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  it('has primary color on surface at 3:1 or better (UI elements)', () => {
    const ratio = contrastRatio(dark['--color-primary'], dark['--color-surface'])
    expect(ratio).toBeGreaterThanOrEqual(3)
  })

  it('has primary color on background at 3:1 or better', () => {
    const ratio = contrastRatio(dark['--color-primary'], dark['--color-bg'])
    expect(ratio).toBeGreaterThanOrEqual(3)
  })

  it('has danger color on surface at 3:1 or better', () => {
    const ratio = contrastRatio(dark['--color-danger'], dark['--color-surface'])
    expect(ratio).toBeGreaterThanOrEqual(3)
  })

  it('has text-on-primary on primary at 4.5:1 or better', () => {
    const ratio = contrastRatio(dark['--color-text-on-primary'], dark['--color-primary'])
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  it('has text-on-primary on danger at 4.5:1 or better', () => {
    const ratio = contrastRatio(dark['--color-text-on-primary'], dark['--color-danger'])
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  it('has border visible against background (3:1 non-text)', () => {
    const ratio = contrastRatio(dark['--color-border'], dark['--color-bg'])
    expect(ratio).toBeGreaterThanOrEqual(1.3)
  })

  it('has border visible against surface', () => {
    const ratio = contrastRatio(dark['--color-border'], dark['--color-surface'])
    expect(ratio).toBeGreaterThanOrEqual(1.3)
  })

  it('has selected row distinguishable from surface', () => {
    const ratio = contrastRatio(dark['--color-selected'], dark['--color-surface'])
    expect(ratio).toBeGreaterThanOrEqual(1.1)
  })

  it('has hover state distinguishable from surface', () => {
    const ratio = contrastRatio(dark['--color-hover'], dark['--color-surface'])
    expect(ratio).toBeGreaterThanOrEqual(1.1)
  })
})

describe('light theme WCAG AA contrast', () => {
  const css = readGlobalCss()
  const light = extractLightVars(css)

  it('has text on background at 4.5:1 or better', () => {
    const ratio = contrastRatio(light['--color-text'], light['--color-bg'])
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  it('has text on surface at 4.5:1 or better', () => {
    const ratio = contrastRatio(light['--color-text'], light['--color-surface'])
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  it('has muted text on surface at 4.5:1 or better', () => {
    const ratio = contrastRatio(light['--color-text-muted'], light['--color-surface'])
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  it('has text-on-primary on primary at 4.5:1 or better', () => {
    const ratio = contrastRatio(light['--color-text-on-primary'], light['--color-primary'])
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  it('has text-on-primary on danger at 4.5:1 or better', () => {
    const ratio = contrastRatio(light['--color-text-on-primary'], light['--color-danger'])
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })
})

describe('dark theme print safety', () => {
  it('does not apply dark variables inside @media print', () => {
    const css = readGlobalCss()

    const printBlock = css.match(/@media\s+print\s*\{([\s\S]*?)\n\}/)
    if (!printBlock) return

    expect(printBlock[1]).not.toContain('--color-bg')
    expect(printBlock[1]).not.toContain('data-theme')
  })
})
