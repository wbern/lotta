import { ROLE_LABELS } from '../lib/chat'
import type { ChatMessage } from '../types/p2p'

interface Props {
  message: ChatMessage
  onDelete?: () => void
}

export function ChatMessageItem({ message, onDelete }: Props) {
  return (
    <div className={`live-chat-message${message.isSystem ? ' live-chat-message--system' : ''}`}>
      {message.isSystem ? (
        <div className="live-chat-system-text">
          <span className="live-chat-time">
            {new Date(message.timestamp).toLocaleTimeString('sv-SE')}
          </span>
          {message.text}
        </div>
      ) : (
        <>
          <div className="live-chat-meta">
            <span className={`live-tab-role live-tab-role--${message.senderRole}`}>
              {ROLE_LABELS[message.senderRole]}
            </span>
            <span className="live-chat-name">{message.senderName}</span>
            <span className="live-chat-time">
              {new Date(message.timestamp).toLocaleTimeString('sv-SE')}
            </span>
          </div>
          <div className="live-chat-text">{message.text}</div>
        </>
      )}
      {onDelete && (
        <button className="live-chat-delete" title="Ta bort meddelande" onClick={onDelete}>
          ×
        </button>
      )}
    </div>
  )
}
