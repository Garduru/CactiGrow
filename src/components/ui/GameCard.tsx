import type { HTMLAttributes, ReactNode } from 'react'

type GameCardLevel = 'panel' | 'item' | 'quiet'

interface GameCardProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode
  level?: GameCardLevel
  as?: 'article' | 'section' | 'div'
}

export function GameCard({ children, level = 'item', as: Element = 'article', className = '', ...props }: GameCardProps) {
  return <Element className={`cg-card cg-card--${level} ${className}`.trim()} {...props}>{children}</Element>
}
