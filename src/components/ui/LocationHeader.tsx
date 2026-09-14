import type { ReactNode } from 'react'

interface LocationHeaderProps {
  title: string
  eyebrow?: string
  subtitle?: string
  status?: ReactNode
  actions?: ReactNode
  titleId?: string
}

export function LocationHeader({ title, eyebrow, subtitle, status, actions, titleId }: LocationHeaderProps) {
  return (
    <header className="cg-location-header">
      <div className="cg-location-header__copy">
        {eyebrow && <span className="cg-eyebrow">{eyebrow}</span>}
        <div className="cg-location-header__title-row">
          <h1 id={titleId}>{title}</h1>
          {status}
        </div>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="cg-location-header__actions">{actions}</div>}
    </header>
  )
}
