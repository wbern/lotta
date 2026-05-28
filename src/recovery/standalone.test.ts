import { describe, expect, it } from 'vitest'
import { isIosStandalone } from './standalone'

const iosUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
const macUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15'

describe('isIosStandalone', () => {
  it('returns true when navigator.standalone is true on iOS', () => {
    expect(
      isIosStandalone({
        userAgent: iosUA,
        matchMedia: null,
        navigatorStandalone: true,
      }),
    ).toBe(true)
  })

  it('returns true when display-mode matches standalone on iOS', () => {
    expect(
      isIosStandalone({
        userAgent: iosUA,
        matchMedia: (q) => ({ matches: q === '(display-mode: standalone)' }) as MediaQueryList,
        navigatorStandalone: false,
      }),
    ).toBe(true)
  })

  it('returns false on non-iOS even when display-mode is standalone', () => {
    expect(
      isIosStandalone({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0)',
        matchMedia: () => ({ matches: true }) as MediaQueryList,
        navigatorStandalone: undefined,
      }),
    ).toBe(false)
  })

  it('returns false on iOS when neither signal indicates standalone', () => {
    expect(
      isIosStandalone({
        userAgent: iosUA,
        matchMedia: () => ({ matches: false }) as MediaQueryList,
        navigatorStandalone: false,
      }),
    ).toBe(false)
  })

  it('treats Mac UA with navigator.standalone present as iPadOS Safari', () => {
    expect(
      isIosStandalone({
        userAgent: macUA,
        matchMedia: null,
        navigatorStandalone: true,
      }),
    ).toBe(true)
  })
})
