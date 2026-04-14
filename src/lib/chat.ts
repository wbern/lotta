import type { ChatMessage, P2PPeer, P2PRole } from '../types/p2p'

const CHAT_RATE_LIMIT_MS = 1000
export const MAX_CHAT_TEXT = 500
const MAX_CHAT_NAME = 50
export const MAX_CHAT_HISTORY = 199

const VALID_ROLES: ReadonlySet<string> = new Set(['organizer', 'viewer', 'referee'])

const RESULT_LABELS: Record<string, string> = {
  WHITE_WIN: '1-0',
  DRAW: '½-½',
  BLACK_WIN: '0-1',
  WHITE_WIN_WO: '1-0 WO',
  BLACK_WIN_WO: '0-1 WO',
  DOUBLE_WO: '0-0 WO',
}

/**
 * Resolve a human-readable result label, preferring a pre-computed display
 * string (needed for chess4/Schack4an point systems) and falling back to the
 * standard 1-0/½-½/0-1 labels keyed off resultType.
 */
export function resolveResultLabel(resultType: string, resultDisplay?: string): string {
  return resultDisplay ?? RESULT_LABELS[resultType] ?? resultType
}

export const ROLE_LABELS: Record<P2PRole, string> = {
  organizer: 'Arrangör',
  referee: 'Domare',
  viewer: 'Åskådare',
}

/**
 * Verify and sanitize an incoming chat message using the peer map
 * to override sender-claimed role and name.
 */
export function verifyChatMessage(msg: ChatMessage, peerId: string, peers: P2PPeer[]): ChatMessage {
  const peer = peers.find((p) => p.id === peerId)
  const peerRole = peer?.role ?? 'viewer'
  return {
    id: msg.id,
    senderName: (peer?.label || msg.senderName || '').slice(0, MAX_CHAT_NAME),
    senderRole: VALID_ROLES.has(peerRole) ? (peerRole as P2PRole) : 'viewer',
    text: (msg.text ?? '').slice(0, MAX_CHAT_TEXT),
    timestamp: msg.timestamp,
    isSystem: msg.isSystem,
  }
}

/**
 * Returns true if the peer should be rate-limited (message too soon).
 * Updates the rate limit map as a side effect.
 */
export function isRateLimited(peerId: string, rateLimitMap: Map<string, number>): boolean {
  const now = Date.now()
  const lastTime = rateLimitMap.get(peerId) ?? 0
  if (now - lastTime < CHAT_RATE_LIMIT_MS) return true
  rateLimitMap.set(peerId, now)
  return false
}
