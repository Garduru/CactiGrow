import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { browserApiClient } from '../services/api/browserApiClient'
import { isNurserySlotIdV1, type PlantLifecycleProjectionV1 } from '../../shared/api/plantLifecycleV1'
import { PlantLifecycleContext, type PlantLifecycleState } from './PlantLifecycleContext'

function serverAuthorityEnabled() { return import.meta.env.DEV && new URLSearchParams(window.location.search).get('e1Lifecycle') === 'server' }

export function PlantLifecycleProvider({ children }: { children: ReactNode }) {
  const enabled = serverAuthorityEnabled()
  const [state, setState] = useState<PlantLifecycleState>(enabled ? { authority: 'server', status: 'loading', projection: null, error: null } : { authority: 'local' })
  const refresh = useCallback(async (signal?: AbortSignal) => { if (!enabled) return; try { const projection = await browserApiClient.getPlantLifecycle(signal); setState({ authority: 'server', status: 'ready', projection, error: null }) } catch (error) { if (error instanceof DOMException && error.name === 'AbortError') return; setState({ authority: 'server', status: 'error', projection: null, error: 'Unable to load the server Nursery.' }) } }, [enabled])
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    browserApiClient.getPlantLifecycle(controller.signal).then(
      (projection) => setState({ authority: 'server', status: 'ready', projection, error: null }),
      (error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setState({ authority: 'server', status: 'error', projection: null, error: 'Unable to load the server Nursery.' })
      },
    )
    return () => controller.abort()
  }, [enabled])
  const replaceProjectionPart = useCallback((update: (projection: PlantLifecycleProjectionV1) => PlantLifecycleProjectionV1) => setState((current) => current.authority === 'server' && current.status === 'ready' ? { ...current, projection: update(current.projection), error: null } : current), [])
  const value = useMemo(() => ({ state, async plant(slotId: string, speciesId: string) { if (state.authority !== 'server' || state.status !== 'ready' || !isNurserySlotIdV1(slotId)) return false; const stack = state.projection.seedStacks.find((item) => item.speciesId === speciesId); if (!stack) return false; try { const result = await browserApiClient.plantCommoditySeed({ slotId, speciesId, expectedSeedStackVersion: stack.version }, crypto.randomUUID()); replaceProjectionPart((projection) => ({ ...projection, lifecycleVersion: result.lifecycleVersion, seedStacks: projection.seedStacks.map((item) => item.speciesId === result.seedStack.speciesId ? result.seedStack : item), nursery: { slots: projection.nursery.slots.map((slot) => slot.slotId === result.slot.slotId ? result.slot : slot) } })); return true } catch { await refresh(); return false } }, async collect(slotId: string) { if (state.authority !== 'server' || state.status !== 'ready' || !isNurserySlotIdV1(slotId)) return false; const slot = state.projection.nursery.slots.find((item) => item.slotId === slotId); if (!slot?.occupancy) return false; try { const result = await browserApiClient.collectPlant({ slotId, specimenId: slot.occupancy.specimen.specimenId, expectedOccupancyVersion: slot.occupancy.version, expectedSpecimenVersion: slot.occupancy.specimen.version }, crypto.randomUUID()); replaceProjectionPart((projection) => ({ ...projection, lifecycleVersion: result.lifecycleVersion, nursery: { slots: projection.nursery.slots.map((item) => item.slotId === result.slot.slotId ? result.slot : item) }, ownedSpecimens: [...projection.ownedSpecimens, result.specimen] })); return true } catch { await refresh(); return false } } }), [refresh, replaceProjectionPart, state])
  return <PlantLifecycleContext.Provider value={value}>{children}</PlantLifecycleContext.Provider>
}
