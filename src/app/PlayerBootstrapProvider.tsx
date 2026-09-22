import { useEffect, useState, type ReactNode } from 'react'
import { browserApiClient } from '../services/api/browserApiClient'
import {
  PlayerBootstrapContext,
  type PlayerBootstrapState,
} from './PlayerBootstrapContext'
import { loadPlayerBootstrapState } from './loadPlayerBootstrapState'
import { getDeploymentMode } from '../config/deploymentMode'

export function PlayerBootstrapProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PlayerBootstrapState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()

    loadPlayerBootstrapState(browserApiClient, controller.signal, getDeploymentMode() === 'staging').then(
      setState,
      (error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setState({ status: 'error', message: 'Unable to establish the CactiGrow player session.' })
      },
    )

    return () => controller.abort()
  }, [])

  return (
    <PlayerBootstrapContext.Provider value={state}>
      {children}
    </PlayerBootstrapContext.Provider>
  )
}
