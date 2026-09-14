import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  children: ReactNode
  action?: ReactNode
  compact?: boolean
}

export function EmptyState({ title, children, action, compact = false }: EmptyStateProps) {
  return (
    <div className={`cg-empty-state${compact ? ' cg-empty-state--compact' : ''}`}>
      <strong>{title}</strong>
      <p>{children}</p>
      {action && <div className="cg-empty-state__action">{action}</div>}
    </div>
  )
}
