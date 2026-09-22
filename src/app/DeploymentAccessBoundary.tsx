import type { ReactNode } from 'react'
import { getDeploymentMode } from '../config/deploymentMode'
import { usePlayerBootstrap } from './usePlayerBootstrap'

export function DeploymentAccessBoundary({ children }: { children: ReactNode }) {
  const bootstrap = usePlayerBootstrap()
  if (getDeploymentMode() === 'development') return children

  if (bootstrap.status === 'loading') {
    return <main className="deployment-access-state" aria-live="polite"><h1>CactiGrow</h1><p>Establishing your secure session…</p></main>
  }
  if (bootstrap.status === 'unauthenticated') {
    return <main className="deployment-access-state"><h1>Access required</h1><p>Please authenticate through the protected CactiGrow access page.</p></main>
  }
  if (bootstrap.status === 'error') {
    return <main className="deployment-access-state" role="alert"><h1>CactiGrow unavailable</h1><p>{bootstrap.message}</p></main>
  }
  return children
}
