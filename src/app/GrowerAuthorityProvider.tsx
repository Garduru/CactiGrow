import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { GrowerAlphaCommandInputV1 } from '../../shared/api/growerAlphaV1'
import { createGrowerCommandRunner } from './growerCommandRunner'
import { usesServerLifecycle } from '../config/deploymentMode'
import { browserApiClient } from '../services/api/browserApiClient'
import { GrowerAuthorityContext, type GrowerAuthorityState } from './GrowerAuthorityContext'
import { GARDEN_AUTHORITY_CHANGED_EVENT, GROWER_AUTHORITY_CHANGED_EVENT, PLANT_AUTHORITY_CHANGED_EVENT } from './authorityEvents'

export function GrowerAuthorityProvider({ children }: { children: ReactNode }) {
  const enabled = usesServerLifecycle()
  const [state, setState] = useState<GrowerAuthorityState>(enabled ? { authority: 'server', status: 'loading', projection: null } : { authority: 'local' })
  const readGeneration = useRef(0)
  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (!enabled) return
    const generation = ++readGeneration.current
    await browserApiClient.getGrowerAlpha(signal).then((projection) => {
      if (generation === readGeneration.current && !signal?.aborted) setState({ authority: 'server', status: 'ready', projection })
    }, () => {
      if (generation === readGeneration.current && !signal?.aborted) setState((previous) => previous.authority === 'server' && previous.status === 'ready' ? previous : { authority: 'server', status: 'error', projection: null })
    })
  }, [enabled])
  const commandRunner = useRef<ReturnType<typeof createGrowerCommandRunner> | null>(null)
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    void refresh(controller.signal)
    return () => controller.abort()
  }, [enabled, refresh])
  useEffect(() => { if (!enabled) return; const handler = () => { void refresh() }; window.addEventListener(GROWER_AUTHORITY_CHANGED_EVENT, handler); return () => window.removeEventListener(GROWER_AUTHORITY_CHANGED_EVENT, handler) }, [enabled, refresh])
  const value = useMemo(() => ({ state, refresh, applyProjection(projection: import('../../shared/api/growerAlphaV1').GrowerAlphaProjectionV1) {
    if (!enabled) return
    readGeneration.current += 1
    setState({ authority: 'server', status: 'ready', projection })
  }, async mutate(command: GrowerAlphaCommandInputV1) {
    if (!enabled) return null
    commandRunner.current ??= createGrowerCommandRunner({
      send: (input) => browserApiClient.mutateGrowerAlpha(input),
      read: () => browserApiClient.getGrowerAlpha(),
      invalidateReads: () => { readGeneration.current += 1 },
      apply: (projection) => setState({ authority: 'server', status: 'ready', projection }),
      reconcileFailure: () => refresh(),
      saleSettled: () => {
        window.dispatchEvent(new Event(PLANT_AUTHORITY_CHANGED_EVENT))
        window.dispatchEvent(new Event(GARDEN_AUTHORITY_CHANGED_EVENT))
      },
      createId: () => crypto.randomUUID(),
    })
    try {
      return await commandRunner.current(command)
    } catch (error) {
      if (['research-specimens', 'sell-specimen-to-npc', 'buy-shop-seeds', 'buy-marketplace-listing', 'list-specimen', 'cancel-listing'].includes(command.type)) throw error
      return null
    }
  } }), [enabled, refresh, state])
  return <GrowerAuthorityContext.Provider value={value}>{children}</GrowerAuthorityContext.Provider>
}
