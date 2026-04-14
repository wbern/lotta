import type { P2PService } from './p2p-service.ts'

let instance: P2PService | null = null

export function setP2PService(service: P2PService): void {
  instance = service
}

export function getP2PService(): P2PService {
  if (!instance) {
    throw new Error('P2PService not initialized. Call setP2PService() first.')
  }
  return instance
}

export function clearP2PService(): void {
  instance = null
}
