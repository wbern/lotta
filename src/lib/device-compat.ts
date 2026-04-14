interface CompatWarning {
  id: string
  severity: 'blocking' | 'warning'
  message: string
  suggestion: string
}

export function getCompatWarnings(): CompatWarning[] {
  const ua = navigator.userAgent
  const warnings: CompatWarning[] = []

  // Opera Mini uses server-side rendering — no WebRTC at all
  if (/Opera Mini/i.test(ua)) {
    warnings.push({
      id: 'opera-mini',
      severity: 'blocking',
      message: 'Den här webbläsaren kan inte ansluta till Lotta på andra enheter.',
      suggestion: 'Öppna länken i Chrome eller Firefox istället.',
    })
    return warnings
  }

  // Mi Browser / Xiaomi Browser — WebRTC APIs exist but are non-functional
  if (/MiuiBrowser|XiaoMi/i.test(ua)) {
    warnings.push({
      id: 'mi-browser',
      severity: 'blocking',
      message: 'Xiaomis webbläsare har kända anslutningsproblem med Lotta.',
      suggestion: 'Öppna länken i Chrome eller Firefox istället.',
    })
  }

  // Amazon Silk — split architecture may break P2P
  if (/\bSilk\b/i.test(ua)) {
    warnings.push({
      id: 'amazon-silk',
      severity: 'warning',
      message: 'Silk kan ha problem med anslutning till Lotta på andra enheter.',
      suggestion: 'Prova Chrome om det inte fungerar.',
    })
  }

  // Samsung Galaxy A-series (A12, A22, A21s etc.) with Samsung Internet —
  // Chromium-level bug where ICE/UDP gathering never completes
  if (/SM-A\d{2,3}/i.test(ua) && /SamsungBrowser/i.test(ua)) {
    warnings.push({
      id: 'samsung-a-series',
      severity: 'warning',
      message: 'Den här enheten har kända anslutningsproblem med Lotta.',
      suggestion: 'Prova Firefox om det inte fungerar.',
    })
  }

  // iOS detection
  const iosMatch = ua.match(/CPU iPhone OS (\d+)_(\d+)/i)
  if (iosMatch) {
    const major = parseInt(iosMatch[1], 10)
    const minor = parseInt(iosMatch[2], 10)

    // In-app browsers on iOS < 14.3 cannot use WebRTC (WKWebView limitation)
    const isInApp = !/Safari\/\d/i.test(ua) && /Mobile/i.test(ua)
    if (isInApp && (major < 14 || (major === 14 && minor < 3))) {
      warnings.push({
        id: 'ios-inapp-browser',
        severity: 'blocking',
        message: 'Den här appen kan inte ansluta till Lotta på andra enheter.',
        suggestion: 'Öppna länken i Safari istället.',
      })
    }

    // Old iOS (< 15.4) has known WebRTC regressions
    if (major < 15 || (major === 15 && minor < 4)) {
      warnings.push({
        id: 'ios-old',
        severity: 'warning',
        message: 'Äldre iOS kan ge instabil anslutning till Lotta.',
        suggestion: 'Uppdatera iOS om möjligt för bäst resultat.',
      })
    }
  }

  return warnings
}
