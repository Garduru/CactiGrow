import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { usePlayerBootstrap } from '../app/usePlayerBootstrap'
import { browserApiClient } from '../services/api/browserApiClient'
import type { WorldLocation } from '../../shared/world/types.ts'
import { WorldLocationContext } from './WorldLocationContext'
export function WorldLocationProvider({ children }: { children: ReactNode }) {
  const route = useLocation(), bootstrap = usePlayerBootstrap()
  const playerId = bootstrap.status === 'authenticated' ? bootstrap.bootstrap.player.playerId : null
  const active = import.meta.env.MODE === 'staging' && (route.pathname === '/world' || route.state?.worldReturnTo === '/world')
  const [loaded, setLoaded] = useState<{ playerId: string; location: WorldLocation } | null>(null)
  const [error, setError] = useState(''), [pending, setPending] = useState(false), [revision, setRevision] = useState(0)
  const location = loaded?.playerId === playerId ? loaded.location : null
  const busy = useRef(false), identity = useRef(playerId)
  useEffect(() => { identity.current = playerId }, [playerId])
  useEffect(() => {
    if (!active || !playerId) return
    const controller = new AbortController()
    void browserApiClient.getWorld(controller.signal).then(location => { if (!controller.signal.aborted) { setLoaded({ playerId, location }); setError('') } })
      .catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'World unavailable.') })
    return () => controller.abort()
  }, [active, playerId, revision])
  const command = useCallback(async (id: string, travel = false) => {
    if (!active || !location || !playerId || busy.current) return
    busy.current = true; setPending(true); setError('')
    try {
      const next = await (travel ? browserApiClient.travelWorld(id, location.revision, crypto.randomUUID()) : browserApiClient.transitionWorld(id, location.revision, crypto.randomUUID()))
      if (identity.current === playerId) setLoaded({ playerId, location: next })
    } catch (e) { if (identity.current === playerId) setError(e instanceof Error ? e.message : 'Route unavailable.') }
    finally { busy.current = false; setPending(false) }
  }, [active, location, playerId])
  return <WorldLocationContext.Provider value={{ active, location, error, pending, transition: id => command(id), travel: id => command(id, true), reload: () => setRevision(n => n + 1) }}>{children}</WorldLocationContext.Provider>
}
