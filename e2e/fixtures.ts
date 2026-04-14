import { test as base, expect } from '@playwright/test'

export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    // Inject video caption overlay that survives navigations
    const captionText = testInfo.titlePath.slice(1).join(' \u203a ')
    await page.addInitScript((text) => {
      function injectCaption() {
        if (document.getElementById('pw-test-caption')) return
        const bar = document.createElement('div')
        bar.id = 'pw-test-caption'
        bar.textContent = text
        Object.assign(bar.style, {
          position: 'fixed',
          bottom: '0',
          left: '0',
          right: '0',
          zIndex: '2147483647',
          background: 'rgba(0, 0, 0, 0.75)',
          color: '#ffffff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: '14px',
          padding: '6px 16px',
          textAlign: 'center',
          pointerEvents: 'none',
          letterSpacing: '0.02em',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        })
        document.documentElement.appendChild(bar)
      }
      if (document.body) {
        injectCaption()
      } else {
        document.addEventListener('DOMContentLoaded', injectCaption)
      }
    }, captionText)

    await use(page)
  },
})

export { expect }
