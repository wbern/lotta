// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { bootRecovery } from './main'

describe('bootRecovery', () => {
  it('mounts the recovery UI into the provided root element', () => {
    const root = document.createElement('div')

    bootRecovery(root)

    expect(root.querySelector('[data-testid="recovery-countdown"]')).not.toBeNull()
    expect(root.querySelector('[data-testid="recovery-cancel"]')).not.toBeNull()
    expect(root.querySelector('[data-testid="recovery-leave"]')).not.toBeNull()
  })
})
