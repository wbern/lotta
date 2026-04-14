import { useEffect, useRef } from 'react'
import type { ChatMessage } from '../types/p2p'

const NEAR_BOTTOM_THRESHOLD = 60

/**
 * Auto-scrolls a chat container to the bottom when new messages arrive,
 * but only if the user is already near the bottom.
 */
export function useChatAutoScroll(chatMessages: ChatMessage[]) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < NEAR_BOTTOM_THRESHOLD
    if (isNearBottom) {
      bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' })
    }
  }, [chatMessages])

  return { scrollRef, bottomRef }
}
