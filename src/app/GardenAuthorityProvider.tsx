import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { GardenCommandInputV1, GardenCommandV1, GardenProjectionV1 } from '../../shared/api/gardenV1.ts'
import { browserApiClient } from '../services/api/browserApiClient.ts'
import { usesServerLifecycle } from '../config/deploymentMode.ts'
import { GardenAuthorityContext } from './GardenAuthorityContext.ts'
import { GARDEN_AUTHORITY_CHANGED_EVENT } from './authorityEvents.ts'

export function GardenAuthorityProvider({ children }: { children: ReactNode }) {
  const enabled = usesServerLifecycle()
  const [projection, setProjection] = useState<GardenProjectionV1 | null>(null)
  const readGeneration = useRef(0)
  const mutationTail = useRef<Promise<unknown>>(Promise.resolve())
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const generation = ++readGeneration.current
    await browserApiClient.getGarden(signal).then((next) => {
      if (generation === readGeneration.current && !signal?.aborted) setProjection(next)
    }, () => { /* Keep the last authoritative projection on a failed refresh. */ })
  }, [])
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    void refresh(controller.signal)
    return () => controller.abort()
  }, [enabled, refresh])
  useEffect(() => {
    if (!enabled) return
    const handler = () => { void refresh() }
    window.addEventListener(GARDEN_AUTHORITY_CHANGED_EVENT, handler)
    return () => window.removeEventListener(GARDEN_AUTHORITY_CHANGED_EVENT, handler)
  }, [enabled, refresh])
  const mutate = useCallback((command: GardenCommandInputV1): Promise<boolean> => {
    if (!enabled) return Promise.resolve(false)
    const task = mutationTail.current.then(async () => {
      const generation = ++readGeneration.current
      try {
        const next = await browserApiClient.mutateGarden({ ...command, commandId: crypto.randomUUID() } as GardenCommandV1)
        if (generation === readGeneration.current) setProjection(next)
        // An overlapping sale/read can overtake this response. Only then fetch again.
        else await refresh()
        return true
      } catch { await refresh(); return false }
    })
    mutationTail.current = task
    return task
  }, [enabled, refresh])
  const value = useMemo(() => ({ projection, loading: enabled && !projection, mutate }), [enabled, mutate, projection])
  return <GardenAuthorityContext.Provider value={value}>{children}</GardenAuthorityContext.Provider>
}
