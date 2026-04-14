// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CompatWarnings } from './CompatWarnings'

vi.mock('../lib/device-compat', () => ({
  getCompatWarnings: vi.fn(() => []),
}))

import { getCompatWarnings } from '../lib/device-compat'

afterEach(cleanup)

describe('CompatWarnings', () => {
  it('renders nothing when no warnings', () => {
    const { container } = render(<CompatWarnings />)
    expect(container.innerHTML).toBe('')
  })

  it('renders blocking warnings with error styling', () => {
    vi.mocked(getCompatWarnings).mockReturnValue([
      {
        id: 'opera-mini',
        severity: 'blocking',
        message: 'Opera Mini stöder inte WebRTC.',
        suggestion: 'Byt till Chrome eller Firefox.',
      },
    ])
    render(<CompatWarnings />)
    const alert = screen.getByRole('alert')
    expect(alert).toBeTruthy()
    expect(alert.textContent).toContain('Opera Mini stöder inte WebRTC.')
    expect(alert.textContent).toContain('Byt till Chrome eller Firefox.')
    expect(alert.className).toContain('blocking')
  })

  it('renders non-blocking warnings', () => {
    vi.mocked(getCompatWarnings).mockReturnValue([
      {
        id: 'amazon-silk',
        severity: 'warning',
        message: 'Amazon Silk kan ha problem.',
        suggestion: 'Prova Chrome.',
      },
    ])
    render(<CompatWarnings />)
    const alert = screen.getByRole('alert')
    expect(alert.className).toContain('warning')
    expect(alert.className).not.toContain('blocking')
  })

  it('renders multiple warnings', () => {
    vi.mocked(getCompatWarnings).mockReturnValue([
      {
        id: 'samsung-a-series',
        severity: 'warning',
        message: 'Samsung A-serien.',
        suggestion: 'Prova Firefox.',
      },
      {
        id: 'ios-old',
        severity: 'warning',
        message: 'Äldre iOS.',
        suggestion: 'Uppdatera.',
      },
    ])
    render(<CompatWarnings />)
    const alerts = screen.getAllByRole('alert')
    expect(alerts).toHaveLength(2)
  })
})
