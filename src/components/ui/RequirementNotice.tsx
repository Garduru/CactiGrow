import type { ReactNode } from 'react'

type RequirementState = 'met' | 'unmet' | 'future' | 'blocked' | 'cooldown'

interface RequirementNoticeProps {
  children: ReactNode
  state?: RequirementState
}

export function RequirementNotice({ children, state = 'unmet' }: RequirementNoticeProps) {
  return <p className={`cg-requirement cg-requirement--${state}`} role={state === 'blocked' ? 'status' : undefined}>{children}</p>
}
