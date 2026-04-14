import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearP2PService, getP2PService, setP2PService } from './p2p-provider.ts'
import { P2PService } from './p2p-service.ts'

vi.mock('trystero', () => ({
  joinRoom: vi.fn(() => ({
    onPeerJoin: vi.fn(),
    onPeerLeave: vi.fn(),
    makeAction: () => [vi.fn(), vi.fn()],
    leave: vi.fn(),
    getPeers: () => ({}),
  })),
  selfId: 'mock-self-id',
  defaultRelayUrls: ['wss://relay1.test', 'wss://relay2.test', 'wss://relay3.test'],
}))

describe('P2P service provider', () => {
  beforeEach(() => {
    clearP2PService()
  })

  it('throws when getting service before it is set', () => {
    expect(() => getP2PService()).toThrow('P2PService not initialized')
  })

  it('returns the service after it is set', () => {
    const service = new P2PService('organizer')
    setP2PService(service)
    expect(getP2PService()).toBe(service)
  })

  it('clears the service', () => {
    const service = new P2PService('organizer')
    setP2PService(service)
    clearP2PService()
    expect(() => getP2PService()).toThrow('P2PService not initialized')
  })
})
