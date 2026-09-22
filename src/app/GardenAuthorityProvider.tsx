import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { GardenCommandInputV1, GardenCommandV1, GardenProjectionV1 } from '../../shared/api/gardenV1.ts'
import { browserApiClient } from '../services/api/browserApiClient.ts'
import { usesServerLifecycle } from '../config/deploymentMode.ts'
import { GardenAuthorityContext } from './GardenAuthorityContext.ts'
import { GARDEN_AUTHORITY_CHANGED_EVENT } from './authorityEvents.ts'
export function GardenAuthorityProvider({ children }: { children: ReactNode }) {
  const enabled = usesServerLifecycle(); const [projection, setProjection] = useState<GardenProjectionV1 | null>(null)
  useEffect(() => { if (!enabled) return; const controller = new AbortController(); browserApiClient.getGarden(controller.signal).then(setProjection, () => undefined); return () => controller.abort() }, [enabled])
  useEffect(() => { if (!enabled) return; const handler = () => { void browserApiClient.getGarden().then(setProjection, () => undefined) }; window.addEventListener(GARDEN_AUTHORITY_CHANGED_EVENT, handler); return () => window.removeEventListener(GARDEN_AUTHORITY_CHANGED_EVENT, handler) }, [enabled])
  const mutate = useCallback(async (command: GardenCommandInputV1) => { if (!enabled) return false; try { setProjection(await browserApiClient.mutateGarden({ ...command, commandId: crypto.randomUUID() } as GardenCommandV1)); return true } catch { return false } }, [enabled])
  const value = useMemo(() => ({ projection, loading: enabled && !projection, mutate }), [enabled, mutate, projection])
  return <GardenAuthorityContext.Provider value={value}>{children}</GardenAuthorityContext.Provider>
}
