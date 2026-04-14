// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

let mockNeedRefresh = false
let mockOfflineReady = false

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [mockNeedRefresh, vi.fn()],
    offlineReady: [mockOfflineReady, vi.fn()],
    updateServiceWorker: vi.fn(),
  }),
}))

vi.stubGlobal('__COMMIT_HASH__', 'abc123')
vi.stubGlobal('__COMMIT_DATE__', '2026-04-09 12:00:00 +0200')

import { ReloadPrompt } from './ReloadPrompt'

describe('ReloadPrompt', () => {
  beforeEach(() => {
    mockNeedRefresh = false
    mockOfflineReady = false
  })

  it('does not show update button when offline ready', () => {
    mockOfflineReady = true
    mockNeedRefresh = true
    render(<ReloadPrompt />)
    expect(screen.getByText('Appen är redo offline')).toBeTruthy()
    expect(screen.queryByText('Uppdatera')).toBeNull()
  })

  it('shows update button when only needRefresh is set', () => {
    mockNeedRefresh = true
    render(<ReloadPrompt />)
    expect(screen.getByText('Ny version tillgänglig')).toBeTruthy()
    expect(screen.getByText('Uppdatera')).toBeTruthy()
  })
})
