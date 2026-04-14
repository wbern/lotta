import type { ReactNode } from 'react'

type EmptyStateIcon = 'chess-board' | 'pawn' | 'list' | 'trophy' | 'users' | 'broadcast'

interface EmptyStateProps {
  icon: EmptyStateIcon
  title: string
  description?: string
  children?: ReactNode
}

export function EmptyState({ icon, title, description, children }: EmptyStateProps) {
  return (
    <div className="empty-state" data-testid="empty-state">
      <div className={`empty-state-icon empty-state-icon--${icon}`} aria-hidden="true" />
      <div className="empty-state-title">{title}</div>
      {description && <div className="empty-state-description">{description}</div>}
      {children}
    </div>
  )
}
