import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { GrowerAlphaCommandInputV1, GrowerAlphaCommandV1 } from '../../shared/api/growerAlphaV1'
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
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    void refresh(controller.signal)
    return () => controller.abort()
  }, [enabled, refresh])
  useEffect(() => { if (!enabled) return; const handler = () => { void refresh() }; window.addEventListener(GROWER_AUTHORITY_CHANGED_EVENT, handler); return () => window.removeEventListener(GROWER_AUTHORITY_CHANGED_EVENT, handler) }, [enabled, refresh])
  const value = useMemo(() => ({ state, refresh, async mutate(command: GrowerAlphaCommandInputV1) {
    if (!enabled) return null
    try {
      const projection = await browserApiClient.mutateGrowerAlpha({ ...command, commandId: crypto.randomUUID() } as GrowerAlphaCommandV1)
      // A read started before this completed command must not restore old Tokens.
      readGeneration.current += 1
      setState({ authority: 'server', status: 'ready', projection })
      if (command.type === 'sell-specimen-to-npc') {
        window.dispatchEvent(new Event(PLANT_AUTHORITY_CHANGED_EVENT))
        window.dispatchEvent(new Event(GARDEN_AUTHORITY_CHANGED_EVENT))
      }
      return projection
    } catch (error) {
      await refresh()
      if (command.type === 'sell-specimen-to-npc') throw error
      return null
    }
  } }), [enabled, refresh, state])
  return <GrowerAuthorityContext.Provider value={value}>{children}</GrowerAuthorityContext.Provider>
}
