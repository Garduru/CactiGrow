import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { usePlayerBootstrap } from '../../app/usePlayerBootstrap'
import { browserApiClient } from '../../services/api/browserApiClient'
import { CactiGrowApiError } from '../../services/api/CactiGrowApiClient'
import { AdminAccessContext } from './adminAccess'
import type { AdminSession } from '../../../shared/api/adminV1'

export function AdminAccessProvider({ children }: { children: ReactNode }) {
  const bootstrap = usePlayerBootstrap()
  return bootstrap.status === 'authenticated' ? <AuthenticatedStaffAccess key={bootstrap.bootstrap.player.playerId} playerId={bootstrap.bootstrap.player.playerId}>{children}</AuthenticatedStaffAccess> : <AdminAccessContext.Provider value={{ session: null, status: 'ready', refresh: async () => null }}>{children}</AdminAccessContext.Provider>
}
function AuthenticatedStaffAccess({ playerId, children }: { playerId: string; children: ReactNode }) {
  const [session, setSession] = useState<AdminSession | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const next = await browserApiClient.getAdminSession(signal)
      if (next.playerId !== playerId) throw new Error('Staff identity mismatch.')
      if (!signal?.aborted) { setSession(next); setStatus('ready') }
      return next
    } catch (error) {
      if (!signal?.aborted) { setSession(null); setStatus(error instanceof CactiGrowApiError && [401, 403].includes(error.status ?? 0) ? 'ready' : 'error') }
      return null
    }
  }, [playerId])
  useEffect(() => {
    const controller = new AbortController()
    void browserApiClient.getAdminSession(controller.signal).then(next => {
      if (next.playerId !== playerId) throw new Error('Staff identity mismatch.')
      if (!controller.signal.aborted) { setSession(next); setStatus('ready') }
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) { setSession(null); setStatus(error instanceof CactiGrowApiError && [401, 403].includes(error.status ?? 0) ? 'ready' : 'error') }
    })
    return () => controller.abort()
  }, [playerId])
  return <AdminAccessContext.Provider value={{ session, status, refresh }}>{children}</AdminAccessContext.Provider>
}
