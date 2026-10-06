import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { usePlayerBootstrap } from '../../app/usePlayerBootstrap'
import { useSocialState } from '../social/useSocialState'
import { useWorldLocation } from '../../game-world/WorldLocationContext'
import { browserApiClient } from '../../services/api/browserApiClient'
import type { StartingCommandInput, StartingExperienceV1 } from '../../../shared/api/startingExperienceV1.ts'
import { StartingContext } from './StartingContext'
import './starting.css'
export function StartingProvider({ children }: { children: ReactNode }) {
  const bootstrap = usePlayerBootstrap(), social = useSocialState(), world = useWorldLocation()
  const active = import.meta.env.MODE === 'staging'
  const playerId = active && bootstrap.status === 'authenticated' ? bootstrap.bootstrap.player.playerId : null
  const profileId = social.state.status === 'ready' ? social.state.overview.ownProfile?.publicId : null
  const [loaded, setLoaded] = useState<{ playerId: string; state: StartingExperienceV1 } | null>(null), [error, setError] = useState(''), [pending, setPending] = useState(false)
  const busy = useRef(false), identity = useRef(playerId)
  useEffect(() => { identity.current = playerId }, [playerId])
  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (!playerId || !profileId) return
    try { const state = await browserApiClient.getStartingExperience(signal); if (identity.current === playerId && !signal?.aborted) { setLoaded(previous => previous?.playerId === playerId && previous.state.revision > state.revision ? previous : { playerId, state }); setError('') } }
    catch (e) { if (!signal?.aborted && identity.current === playerId) setError(e instanceof Error ? e.message : 'Tutorial unavailable.') }
  }, [playerId, profileId])
  useEffect(() => {
    if (!playerId || !profileId) return
    const controller = new AbortController()
    void browserApiClient.getStartingExperience(controller.signal).then(state => {
      if (!controller.signal.aborted) { setLoaded(previous => previous?.playerId === playerId && previous.state.revision > state.revision ? previous : { playerId, state }); setError('') }
    }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Tutorial unavailable.') })
    return () => controller.abort()
  }, [playerId, profileId, world.location?.revision])
  const execute = useCallback(async (command: StartingCommandInput) => {
    if (!playerId || busy.current) return false
    busy.current = true; setPending(true); setError('')
    try { const state = await browserApiClient.startingCommand({ ...command, commandId: crypto.randomUUID() }); if (identity.current === playerId) setLoaded({ playerId, state }); return true }
    catch (e) { if (identity.current === playerId) setError(e instanceof Error ? e.message : 'Tutorial action unavailable.'); return false }
    finally { busy.current = false; setPending(false) }
  }, [playerId])
  return <StartingContext.Provider value={{ active, state: loaded?.playerId === playerId ? loaded.state : null, error, pending, execute, refresh }}>{children}</StartingContext.Provider>
}
