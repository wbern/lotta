// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { getCompatWarnings } from './device-compat'

function withUA(ua: string, fn: () => void) {
  const original = navigator.userAgent
  Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true })
  try {
    fn()
  } finally {
    Object.defineProperty(navigator, 'userAgent', { value: original, configurable: true })
  }
}

describe('getCompatWarnings', () => {
  it('returns no warnings for Chrome on desktop', () => {
    withUA(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      () => {
        expect(getCompatWarnings()).toEqual([])
      },
    )
  })

  it('detects Opera Mini', () => {
    withUA(
      'Opera/9.80 (Android; Opera Mini/36.2.2254/191.256; U; en) Presto/2.12.423 Version/12.16',
      () => {
        const warnings = getCompatWarnings()
        expect(warnings).toHaveLength(1)
        expect(warnings[0].id).toBe('opera-mini')
        expect(warnings[0].severity).toBe('blocking')
      },
    )
  })

  it('detects Mi Browser / Xiaomi Browser', () => {
    withUA(
      'Mozilla/5.0 (Linux; U; Android 11; en-us; M2101K6G Build/RKQ1.200826.002) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/89.0.4389.116 Mobile Safari/537.36 XiaoMi/MiuiBrowser/15.4.12',
      () => {
        const warnings = getCompatWarnings()
        expect(warnings.some((w) => w.id === 'mi-browser')).toBe(true)
        expect(warnings.find((w) => w.id === 'mi-browser')!.severity).toBe('blocking')
      },
    )
  })

  it('detects Amazon Silk browser', () => {
    withUA(
      'Mozilla/5.0 (Linux; Android 11; KFTRWI) AppleWebKit/537.36 (KHTML, like Gecko) Silk/93.2.6 like Chrome/93.0.4577.82 Safari/537.36',
      () => {
        const warnings = getCompatWarnings()
        expect(warnings.some((w) => w.id === 'amazon-silk')).toBe(true)
        expect(warnings.find((w) => w.id === 'amazon-silk')!.severity).toBe('warning')
      },
    )
  })

  it('detects Samsung Internet on Samsung Galaxy A12', () => {
    withUA(
      'Mozilla/5.0 (Linux; Android 12; SM-A127F) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/20.0 Chrome/106.0.5249.126 Mobile Safari/537.36',
      () => {
        const warnings = getCompatWarnings()
        expect(warnings.some((w) => w.id === 'samsung-a-series')).toBe(true)
      },
    )
  })

  it('detects Samsung Internet on Samsung Galaxy A22', () => {
    withUA(
      'Mozilla/5.0 (Linux; Android 13; SM-A225F) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.5790.138 Mobile Safari/537.36',
      () => {
        const warnings = getCompatWarnings()
        expect(warnings.some((w) => w.id === 'samsung-a-series')).toBe(true)
      },
    )
  })

  it('does not flag Samsung Galaxy S series', () => {
    withUA(
      'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.5790.138 Mobile Safari/537.36',
      () => {
        const warnings = getCompatWarnings()
        expect(warnings.some((w) => w.id === 'samsung-a-series')).toBe(false)
      },
    )
  })

  it('detects iOS in-app browser on iOS < 14.3', () => {
    withUA(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram',
      () => {
        const warnings = getCompatWarnings()
        expect(warnings.some((w) => w.id === 'ios-inapp-browser')).toBe(true)
        expect(warnings.find((w) => w.id === 'ios-inapp-browser')!.severity).toBe('blocking')
      },
    )
  })

  it('does not flag iOS Safari', () => {
    withUA(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      () => {
        const warnings = getCompatWarnings()
        expect(warnings.some((w) => w.id === 'ios-inapp-browser')).toBe(false)
      },
    )
  })

  it('detects old iOS versions (< 15.4)', () => {
    withUA(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 14_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
      () => {
        const warnings = getCompatWarnings()
        expect(warnings.some((w) => w.id === 'ios-old')).toBe(true)
        expect(warnings.find((w) => w.id === 'ios-old')!.severity).toBe('warning')
      },
    )
  })

  it('does not flag current iOS', () => {
    withUA(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      () => {
        const warnings = getCompatWarnings()
        expect(warnings.some((w) => w.id === 'ios-old')).toBe(false)
      },
    )
  })
})
