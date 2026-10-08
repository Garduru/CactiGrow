import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { usePlayerBootstrap } from '../../app/usePlayerBootstrap'
import { usePlantLifecycle } from '../../app/usePlantLifecycle'
import { useWorldLocation } from '../../game-world/WorldLocationContext'
import { browserApiClient } from '../../services/api/browserApiClient'
import { CactiGrowApiError } from '../../services/api/CactiGrowApiClient'
import { useStartingExperience } from '../starting/StartingContext'
import { useFieldSurvey } from '../field-survey/FieldSurveyContext'
import { TutorialClock } from '../starting/tutorialClock'
import type { ExplorationCommandV1, ExplorationProjectionV1, ExplorationResultV1, ExplorationDevCommandV1, ExplorationRestoreCommandV1 } from '../../../shared/api/explorationV1.ts'
import { ExplorationContext, type ExplorationIntent, type ExplorationNotice } from './ExplorationContext'
import { explorationResultNotice } from './explorationPresentation'
import './exploration.css'

/** Durable exploration comes only from the authenticated projection; no frame polling. */
export function ExplorationProvider({ children }: { children: ReactNode }) {
  const bootstrap = usePlayerBootstrap(), world = useWorldLocation(), lifecycle = usePlantLifecycle(), starting = useStartingExperience()
  const applyStarting = starting.applyProjection, refreshLifecycle = lifecycle.refresh, applySurvey = useFieldSurvey().applyProjection
  const active = import.meta.env.MODE === 'staging'
  const playerId = active && bootstrap.status === 'authenticated' ? bootstrap.bootstrap.player.playerId : null
  const [loaded, setLoaded] = useState<{ playerId: string; projection: ExplorationProjectionV1 } | null>(null)
  const [pending, setPending] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState<ExplorationNotice | null>(null)
  const [clock] = useState(() => new TutorialClock())
  const identity = useRef(playerId), busy = useRef(false), generation = useRef(0), noticeId = useRef(0)
  const retry = useRef<ExplorationCommandV1 | null>(null)
  const entry = useRef<{ playerId: string; command: ExplorationRestoreCommandV1; restored: boolean } | null>(null)
  const failedDiscovery = useRef<{ intent: ExplorationIntent; revision: number } | null>(null)
  useEffect(() => { identity.current = playerId; retry.current = null }, [playerId])
  const now = useCallback(() => clock.now(), [clock])
  const publish = useCallback((title: string, detail?: string, retryable?: boolean, retryLabel?: string) => setNotice({ id: ++noticeId.current, title, detail, retryable, retryLabel }), [])
  const apply = useCallback((projection: ExplorationProjectionV1) => {
    if (!playerId || identity.current !== playerId) return
    setLoaded(previous => previous?.playerId === playerId && previous.projection.revision > projection.revision ? previous : { playerId, projection })
    clock.sync(projection.serverNow)
  }, [clock, playerId])
  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (!playerId) return
    const request = ++generation.current
    try {
      const boot = entry.current?.playerId === playerId && !entry.current.restored ? entry.current : null
      const result = boot ? await browserApiClient.restoreExplorationEntry(boot.command, signal) : await browserApiClient.getExploration(signal)
      if (!signal?.aborted && request === generation.current && identity.current === playerId) { if (boot) boot.restored = true; apply(result.projection); applyStarting?.(result.starting); if (result.fieldSurvey) applySurvey(result.fieldSurvey); setError(''); if (boot) setNotice(null) }
    } catch (reason) { if (!signal?.aborted && request === generation.current && identity.current === playerId) { const message = reason instanceof Error ? reason.message : 'Exploration unavailable.'; setError(message); publish('Field record unavailable.', message, true, 'Retry field record') } }
  }, [apply, playerId, applyStarting, applySurvey, publish])
  const locationRevision = world.location?.revision
  useEffect(() => {
    if (!playerId || locationRevision === undefined || entry.current?.playerId === playerId && entry.current.restored) return
    if (!entry.current || entry.current.playerId !== playerId || entry.current.command.expectedWorldRevision !== locationRevision) entry.current = { playerId, command: { v: 1, commandId: crypto.randomUUID(), expectedWorldRevision: locationRevision }, restored: false }
    const controller = new AbortController(), request = ++generation.current
    const boot = entry.current
    void browserApiClient.restoreExplorationEntry(boot.command, controller.signal).then(result => {
      if (!controller.signal.aborted && request === generation.current && identity.current === playerId) { boot.restored = true; apply(result.projection); applyStarting?.(result.starting); if (result.fieldSurvey) applySurvey(result.fieldSurvey); setError('') }
    }).catch(reason => { if (!controller.signal.aborted && request === generation.current && identity.current === playerId) { const message = reason instanceof Error ? reason.message : 'Exploration unavailable.'; setError(message); publish('Field record unavailable.', message, true, 'Retry field record') } })
    return () => controller.abort()
  }, [apply, applyStarting, applySurvey, playerId, locationRevision, publish])
  const reconcile = useCallback(async (result: ExplorationResultV1) => {
    generation.current += 1
    apply(result.projection)
    applyStarting?.(result.starting)
    if (result.fieldSurvey) applySurvey(result.fieldSurvey)
    if (result.reward) await refreshLifecycle()
  }, [apply, applyStarting, applySurvey, refreshLifecycle])
  const execute = useCallback(async (intent: ExplorationIntent) => {
    if (!playerId || !world.location) return false
    if (busy.current) { if (intent.type !== 'discover-landmark') publish('Finishing your last field action. Try again in a moment.'); return false }
    busy.current = true; setPending(true); setError('')
    const revision = world.location.revision
    const previous = retry.current
    const sameTarget = previous?.type === intent.type && previous.expectedWorldRevision === revision
      && ('landmarkId' in intent ? 'landmarkId' in previous && previous.landmarkId === intent.landmarkId : 'entityId' in previous && previous.entityId === intent.entityId)
    const command = sameTarget ? previous! : { ...intent, v: 1 as const, commandId: crypto.randomUUID(), expectedWorldRevision: revision } as ExplorationCommandV1
    retry.current = command
    try {
      const result = await browserApiClient.explorationCommand(command)
      if (identity.current !== playerId) return false
      retry.current = null
      if (intent.type === 'discover-landmark') failedDiscovery.current = null
      await reconcile(result)
      const message = explorationResultNotice(command, result)
      if (message) publish(message.title, message.detail)
      return true
    } catch (reason) {
      if (identity.current === playerId) {
        const message = reason instanceof Error ? reason.message : 'Exploration action unavailable.'
        setError(message)
        if (intent.type === 'discover-landmark') failedDiscovery.current = { intent, revision }
        publish(message, intent.type === 'discover-landmark' ? 'Retry this discovery while you are in the landmark region.' : undefined, intent.type === 'discover-landmark')
        if (reason instanceof CactiGrowApiError && reason.status && reason.status >= 400 && reason.status < 500) retry.current = null
      }
      return false
    } finally { busy.current = false; setPending(false) }
  }, [playerId, world.location, reconcile, publish])
  const retryNotice = useCallback(async () => {
    const failed = failedDiscovery.current
    if (!failed) {
      if (busy.current) return false
      busy.current = true; setPending(true)
      try { await refresh(); return true }
      finally { busy.current = false; setPending(false) }
    }
    if (failed.revision !== world.location?.revision) { publish('Return to the landmark region to discover it.'); return false }
    return execute(failed.intent)
  }, [execute, publish, refresh, world.location?.revision])
  const projection = loaded?.playerId === playerId ? loaded.projection : null
  const reset = useCallback(async (type: ExplorationDevCommandV1['type']) => {
    if (!playerId || !projection || busy.current) return false
    busy.current = true; setPending(true); setError('')
    try {
      const result = await browserApiClient.resetExploration({ v: 1, commandId: crypto.randomUUID(), type, expectedRevision: projection.revision })
      if (identity.current !== playerId) return false
      generation.current += 1; apply(result.projection); applyStarting?.(result.starting); if (result.fieldSurvey) applySurvey(result.fieldSurvey); retry.current = null
      publish(type === 'reset-landmarks' ? 'First Basin landmark discoveries reset.' : 'Wild resource cooldowns reset.')
      return true
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Exploration reset unavailable.'); return false }
    finally { busy.current = false; setPending(false) }
  }, [apply, playerId, projection, publish, applyStarting, applySurvey])
  const dismissNotice = useCallback(() => setNotice(null), [])
  useEffect(() => { if (!notice || notice.retryable) return; const timer = window.setTimeout(dismissNotice, 7000); return () => window.clearTimeout(timer) }, [notice, dismissNotice])
  return <ExplorationContext.Provider value={{ active, projection, pending, error, notice, now, refresh, execute, reset, dismissNotice, retryNotice }}>{children}</ExplorationContext.Provider>
}
