import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { usePlayerBootstrap } from '../../app/usePlayerBootstrap'
import { useSocialState } from '../social/useSocialState'
import { useWorldLocation } from '../../game-world/WorldLocationContext'
import { browserApiClient } from '../../services/api/browserApiClient'
import type { StartingCommandInput, StartingExperienceV1 } from '../../../shared/api/startingExperienceV1.ts'
import { StartingContext } from './StartingContext'
import './starting.css'
import { TutorialClock } from './tutorialClock'
export function StartingProvider({ children }: { children: ReactNode }) {
  const bootstrap = usePlayerBootstrap(), social = useSocialState(), world = useWorldLocation()
  const active = import.meta.env.MODE === 'staging'
  const playerId = active && bootstrap.status === 'authenticated' ? bootstrap.bootstrap.player.playerId : null
  const profileId = social.state.status === 'ready' ? social.state.overview.ownProfile?.publicId : null
  const [loaded, setLoaded] = useState<{ playerId: string; state: StartingExperienceV1 } | null>(null), [error, setError] = useState(''), [pending, setPending] = useState(false)
  const [clock] = useState(() => new TutorialClock())
  const now = useCallback(() => clock.now(), [clock])
  const busy = useRef(false), identity = useRef(playerId)
  useEffect(() => { identity.current = playerId }, [playerId, clock])
  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (!playerId) return
    try { const state = await browserApiClient.getStartingExperience(signal); if (identity.current === playerId && !signal?.aborted) { setLoaded(previous => previous?.playerId === playerId && previous.state.revision > state.revision ? previous : { playerId, state }); clock.sync(state.serverNow); setError('') } }
    catch (e) { if (!signal?.aborted && identity.current === playerId) setError(e instanceof Error ? e.message : 'Tutorial unavailable.') }
  }, [playerId, clock])
  useEffect(() => {
    if (!playerId) return
    const controller = new AbortController()
    void browserApiClient.getStartingExperience(controller.signal).then(state => {
      if (!controller.signal.aborted) { setLoaded(previous => previous?.playerId === playerId && previous.state.revision > state.revision ? previous : { playerId, state }); clock.sync(state.serverNow); setError('') }
    }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Tutorial unavailable.') })
    return () => controller.abort()
  }, [playerId, profileId, world.location?.revision, clock])
  const potDeadline = loaded?.playerId === playerId && loaded.state.spawnStage === 'collect-pot' ? loaded.state.pot?.readyAt : null
  useEffect(() => {
    if (!potDeadline) return
    const timer = window.setTimeout(() => void refresh(), Math.max(0, Date.parse(potDeadline) - now()) + 100)
    return () => window.clearTimeout(timer)
  }, [potDeadline, refresh, now])
  const execute = useCallback(async (command: StartingCommandInput) => {
    if (!playerId || busy.current) return false
    busy.current = true; setPending(true); setError('')
    try { const state = await browserApiClient.startingCommand({ ...command, commandId: crypto.randomUUID() }); if (identity.current === playerId) setLoaded({ playerId, state }); clock.sync(state.serverNow); return true }
    catch (e) { if (identity.current === playerId) setError(e instanceof Error ? e.message : 'Tutorial action unavailable.'); return false }
    finally { busy.current = false; setPending(false) }
  }, [playerId, clock])
  const applyProjection = useCallback((state: StartingExperienceV1) => {
    if (!playerId) return
    setLoaded(previous => previous?.playerId === playerId && previous.state.revision > state.revision ? previous : { playerId, state })
    clock.sync(state.serverNow)
  }, [playerId, clock])
  return <StartingContext.Provider value={{ now, active, state: loaded?.playerId === playerId ? loaded.state : null, error, pending, execute, refresh, applyProjection }}>{children}</StartingContext.Provider>
}
