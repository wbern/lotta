// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  appendChatMessage,
  incrementUnread,
  resetClientStore,
  setAnnouncement,
  setKicked,
  setPeerCount,
  setShareMode,
  toggleChat,
} from '../stores/client-p2p-store'
import type { ChatMessage } from '../types/p2p'
import { ClientOverlay } from './ClientOverlay'

const mockBroadcastChatMessage = vi.fn()

vi.mock('../services/p2p-provider', () => ({
  getP2PService: () => ({
    broadcastChatMessage: mockBroadcastChatMessage,
    getRelayStatus: () => [],
    getRtcPeerStates: () => [],
    roomId: 'test-room',
    getSelfId: () => 'self-id',
    role: 'viewer',
    strategy: 'mesh',
  }),
}))

vi.mock('../hooks/useChatAutoScroll', () => ({
  useChatAutoScroll: () => ({ scrollRef: { current: null }, bottomRef: { current: null } }),
}))

vi.mock('../hooks/useDocumentTitle', () => ({
  useDocumentTitle: vi.fn(),
}))

vi.mock('./ConnectionDiagnostics', () => ({
  ConnectionDiagnostics: () => <div data-testid="diagnostics">diagnostics</div>,
}))

function makeChatMsg(overrides?: Partial<ChatMessage>): ChatMessage {
  return {
    id: crypto.randomUUID(),
    senderName: 'Testare',
    senderRole: 'organizer',
    text: 'hej',
    timestamp: Date.now(),
    ...overrides,
  }
}

afterEach(() => {
  cleanup()
  resetClientStore()
  mockBroadcastChatMessage.mockReset()
})

describe('ClientOverlay', () => {
  beforeEach(() => {
    resetClientStore()
  })

  describe('kicked state', () => {
    it('shows kicked overlay when kicked', () => {
      setKicked()
      render(<ClientOverlay />)
      expect(screen.getByText('Frånkopplad')).toBeTruthy()
      expect(screen.getByText('Du har kopplats bort av arrangören.')).toBeTruthy()
    })

    it('does not render chat when kicked', () => {
      setKicked()
      render(<ClientOverlay />)
      expect(screen.queryByText(/Chatt/)).toBeNull()
    })
  })

  describe('announcement banner', () => {
    it('shows announcement text', () => {
      setAnnouncement({ text: 'Rond 3 börjar om 5 min', timestamp: Date.now() })
      render(<ClientOverlay />)
      expect(screen.getByText('Rond 3 börjar om 5 min')).toBeTruthy()
    })

    it('dismisses announcement on click', () => {
      setAnnouncement({ text: 'Meddelande', timestamp: Date.now() })
      render(<ClientOverlay />)
      fireEvent.click(screen.getByText('Stäng'))
      expect(screen.queryByText('Meddelande')).toBeNull()
    })
  })

  describe('chat toggle', () => {
    it('shows chat toggle button', () => {
      render(<ClientOverlay />)
      expect(screen.getByText(/Chatt/)).toBeTruthy()
    })

    it('shows unread count on toggle', () => {
      appendChatMessage(makeChatMsg())
      appendChatMessage(makeChatMsg())
      incrementUnread()
      incrementUnread()
      render(<ClientOverlay />)
      expect(screen.getByText('Chatt (2)')).toBeTruthy()
    })

    it('opens chat panel when toggle is clicked', () => {
      render(<ClientOverlay />)
      fireEvent.click(screen.getByText(/Chatt/))
      expect(screen.getByPlaceholderText('Skriv ett meddelande...')).toBeTruthy()
    })
  })

  describe('chat panel', () => {
    it('shows empty state when no messages', () => {
      toggleChat()
      render(<ClientOverlay />)
      expect(screen.getByText('Inga meddelanden ännu.')).toBeTruthy()
    })

    it('renders chat messages', () => {
      appendChatMessage(makeChatMsg({ text: 'Hej från arrangören!' }))
      toggleChat()
      render(<ClientOverlay />)
      expect(screen.getByText('Hej från arrangören!')).toBeTruthy()
    })

    it('sends a chat message', () => {
      toggleChat()
      render(<ClientOverlay />)

      const input = screen.getByPlaceholderText('Skriv ett meddelande...')
      fireEvent.change(input, { target: { value: 'Mitt meddelande' } })
      fireEvent.click(screen.getByText('Skicka'))

      expect(mockBroadcastChatMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Mitt meddelande',
          senderRole: 'viewer',
          senderName: 'Deltagare',
        }),
      )
    })

    it('sends message on Enter key', () => {
      toggleChat()
      render(<ClientOverlay />)

      const input = screen.getByPlaceholderText('Skriv ett meddelande...')
      fireEvent.change(input, { target: { value: 'Enter-meddelande' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      expect(mockBroadcastChatMessage).toHaveBeenCalled()
    })

    it('does not send empty messages', () => {
      toggleChat()
      render(<ClientOverlay />)

      const sendBtn = screen.getByText('Skicka')
      expect(sendBtn).toHaveProperty('disabled', true)
    })

    it('shows disabled label when chat is disabled', () => {
      setPeerCount({ total: 1, viewers: 1, referees: 0, chatEnabled: false })
      toggleChat()
      render(<ClientOverlay />)
      expect(screen.getByText('Chatten är avstängd')).toBeTruthy()
    })

    it('hides input when chat is disabled', () => {
      setPeerCount({ total: 1, viewers: 1, referees: 0, chatEnabled: false })
      toggleChat()
      render(<ClientOverlay />)
      expect(screen.queryByPlaceholderText('Skriv ett meddelande...')).toBeNull()
    })
  })

  describe('view mode', () => {
    it('hides chat entirely when shareMode is view', () => {
      setShareMode('view')
      render(<ClientOverlay />)
      expect(screen.queryByText(/Chatt/)).toBeNull()
    })
  })

  describe('diagnostics', () => {
    it('shows diagnostics panel when toggled', () => {
      toggleChat()
      render(<ClientOverlay />)
      fireEvent.click(screen.getByText('Diagnostik'))
      expect(screen.getByTestId('diagnostics')).toBeTruthy()
    })
  })
})
