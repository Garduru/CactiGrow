import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { FIELD_SURVEY, type FieldSurveyCommandV1, type FieldSurveyProjectionV1, type FieldSurveyResultV1 } from '../../../shared/api/fieldSurveyV1.ts'
import type { WorldPoint } from '../../../shared/world/types.ts'
import { usePlayerBootstrap } from '../../app/usePlayerBootstrap'
import { useGrowerAuthority } from '../../app/useGrowerAuthority'
import { useWorldLocation } from '../../game-world/WorldLocationContext'
import { browserApiClient } from '../../services/api/browserApiClient'
import { CactiGrowApiError } from '../../services/api/CactiGrowApiClient'
import { useStartingExperience } from '../starting/StartingContext'
import { FieldSurveyContext } from './FieldSurveyContext'
import './fieldSurvey.css'

/** One optional survey consumes existing server history; it owns no exploration truth. */
export function FieldSurveyProvider({ children }: { children: ReactNode }) {
  const bootstrap = usePlayerBootstrap(), world = useWorldLocation(), starting = useStartingExperience(), grower = useGrowerAuthority()
  const active = import.meta.env.MODE === 'staging'
  const playerId = active && bootstrap.status === 'authenticated' ? bootstrap.bootstrap.player.playerId : null
  const [loaded, setLoaded] = useState<{ playerId: string; projection: FieldSurveyProjectionV1 } | null>(null)
  const [pending, setPending] = useState(false), [error, setError] = useState('')
  const identity = useRef(playerId), busy = useRef(false), retry = useRef<FieldSurveyCommandV1 | null>(null)
  const latest = useRef<{ playerId: string; projection: FieldSurveyProjectionV1 } | null>(null)
  const generation = useRef(0), requested = useRef('')
  const applyStarting = starting.applyProjection, refreshGrower = grower.refresh
  useEffect(() => { identity.current = playerId; retry.current = null; requested.current = ''; latest.current = null; generation.current += 1 }, [playerId])
  const applyProjection = useCallback((projection: FieldSurveyProjectionV1) => {
    if (!playerId || identity.current !== playerId) return
    if (latest.current?.playerId === playerId && latest.current.projection.progressRevision > projection.progressRevision) return
    generation.current += 1
    latest.current = { playerId, projection }
    setLoaded(latest.current)
  }, [playerId])
  const applyResult = useCallback((result: FieldSurveyResultV1) => {
    applyProjection(result.projection)
    applyStarting?.(result.starting)
  }, [applyProjection, applyStarting])
  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (!playerId) return
    const request = ++generation.current
    try {
      const result = await browserApiClient.getFieldSurvey(signal)
      if (!signal?.aborted && identity.current === playerId && request === generation.current) { applyResult(result); setError('') }
    } catch (reason) {
      if (!signal?.aborted && identity.current === playerId && request === generation.current) setError(reason instanceof Error ? reason.message : 'Field Survey unavailable.')
    }
  }, [playerId, applyResult])
  const projection = loaded?.playerId === playerId ? loaded.projection : null
  const eligible = !!starting.state?.farmTutorialComplete
  const worldRevision = world.location?.revision, areaId = world.location?.areaId
  const status = projection?.status, caveEntered = projection?.objectives.caveEntered
  // Initial state arrives in the existing exploration entry response. Only the
  // prerequisite transition and a first cave entry need a targeted survey read.
  useEffect(() => {
    if (!playerId || !eligible || !status || worldRevision === undefined) return
    const unlocked = status === 'locked'
    const enteredCave = areaId === FIELD_SURVEY.caveAreaId && !caveEntered && status !== 'complete'
    if (!unlocked && !enteredCave) return
    const key = `${playerId}:${worldRevision}:${unlocked ? 'unlock' : 'cave'}`
    if (requested.current === key) return
    requested.current = key
    const controller = new AbortController()
    void refresh(controller.signal)
    return () => { controller.abort(); if (requested.current === key) requested.current = '' }
  }, [playerId, eligible, status, caveEntered, areaId, worldRevision, refresh])
  const converse = useCallback(async (type: 'accept' | 'report', position: WorldPoint) => {
    if (!playerId || !world.location || busy.current) return false
    busy.current = true; setPending(true); setError('')
    const previous = retry.current
    const command: FieldSurveyCommandV1 = previous?.type === type && previous.expectedWorldRevision === world.location.revision ? previous : {
      v: 1, commandId: crypto.randomUUID(), type, entityId: FIELD_SURVEY.npcEntityId,
      expectedWorldRevision: world.location.revision, position,
    }
    retry.current = command
    try {
      const result = await browserApiClient.fieldSurveyCommand(command)
      if (identity.current !== playerId) return false
      retry.current = null; applyResult(result)
      if (result.reward) await refreshGrower()
      return true
    } catch (reason) {
      if (identity.current === playerId) {
        setError(reason instanceof Error ? reason.message : 'Field Survey conversation unavailable.')
        if (reason instanceof CactiGrowApiError && reason.status && reason.status >= 400 && reason.status < 500) retry.current = null
      }
      return false
    } finally { busy.current = false; setPending(false) }
  }, [playerId, world.location, applyResult, refreshGrower])
  const reset = useCallback(async () => {
    if (!playerId || !projection || busy.current) return false
    busy.current = true; setPending(true); setError('')
    try {
      const result = await browserApiClient.resetFieldSurvey({ v: 1, commandId: crypto.randomUUID(), type: 'reset-field-survey', expectedRevision: projection.revision })
      if (identity.current !== playerId) return false
      retry.current = null; applyResult(result); return true
    } catch (reason) { if (identity.current === playerId) setError(reason instanceof Error ? reason.message : 'Field Survey reset unavailable.'); return false }
    finally { busy.current = false; setPending(false) }
  }, [playerId, projection, applyResult])
  return <FieldSurveyContext.Provider value={{ active, projection, pending, error, applyProjection, refresh, converse, reset }}>{children}</FieldSurveyContext.Provider>
}
