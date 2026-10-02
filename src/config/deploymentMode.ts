export type DeploymentMode = 'development' | 'staging' | 'production'

export function resolveDeploymentMode(mode: string): DeploymentMode {
  if (mode === 'development' || mode === 'staging') return mode
  return 'production'
}

export function getDeploymentMode(): DeploymentMode {
  return resolveDeploymentMode(import.meta.env.MODE)
}

const developmentServerLifecycle = import.meta.env?.MODE === 'development' && typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('e1Lifecycle') === 'server'

export function usesServerLifecycle(): boolean {
  if (import.meta.env.MODE !== 'development') return true
  return developmentServerLifecycle
}

export function resolveServerLifecycle(mode: string, search: string): boolean {
  if (resolveDeploymentMode(mode) !== 'development') return true
  return new URLSearchParams(search).get('e1Lifecycle') === 'server'
}
