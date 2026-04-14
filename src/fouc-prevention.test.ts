import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'

function readIndexHtml(): string {
  return readFileSync(resolve(__dirname, '../index.html'), 'utf-8')
}

describe('FOUC prevention', () => {
  it('includes color-scheme meta tag in head', () => {
    const html = readIndexHtml()

    expect(html).toMatch(/<meta\s+name="color-scheme"\s+content="light dark"\s*\/?>/)
  })

  it('includes blocking inline script (not type=module) for theme init', () => {
    const html = readIndexHtml()

    // Must be a plain <script> tag (no type=module) in the <head>
    const headContent = html.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? ''

    // Find script tags that are NOT type="module"
    const inlineScripts = headContent.match(
      /<script(?![^>]*type=)(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g,
    )
    expect(inlineScripts).not.toBeNull()
    expect(inlineScripts!.length).toBeGreaterThanOrEqual(1)

    // The script should read from localStorage and set data-theme
    const scriptContent = inlineScripts!.join('\n')
    expect(scriptContent).toContain('localStorage')
    expect(scriptContent).toContain('data-theme')
    expect(scriptContent).toContain('colorScheme')
  })

  it('places the FOUC script before CSS and module scripts', () => {
    const html = readIndexHtml()

    const headContent = html.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? ''

    // Find the position of the inline FOUC script
    const foucScriptPos = headContent.search(
      /<script(?![^>]*type=)(?![^>]*src=)[^>]*>[\s\S]*?localStorage[\s\S]*?<\/script>/,
    )

    // Find position of any CSS link
    const cssLinkPos = headContent.search(/<link[^>]*stylesheet/)

    // Find position of module scripts
    const moduleScriptPos = headContent.search(/<script[^>]*type="module"/)

    // FOUC script should come before CSS (if CSS exists in head)
    if (cssLinkPos !== -1) {
      expect(foucScriptPos).toBeLessThan(cssLinkPos)
    }

    // FOUC script should come before module scripts (if they exist in head)
    if (moduleScriptPos !== -1) {
      expect(foucScriptPos).toBeLessThan(moduleScriptPos)
    }

    // FOUC script must exist
    expect(foucScriptPos).not.toBe(-1)
  })
})
