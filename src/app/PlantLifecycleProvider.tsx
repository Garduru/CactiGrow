import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { browserApiClient } from '../services/api/browserApiClient'
import { isNurserySlotIdV3 } from '../../shared/api/plantLifecycleV3'
import type { BredSeedV2 } from '../../shared/api/plantLifecycleV2'
import { PlantLifecycleContext, type PlantLifecycleState } from './PlantLifecycleContext'
import { usesServerLifecycle } from '../config/deploymentMode'
import { notifyGrowerAuthorityChanged } from './authorityEvents'
import { PLANT_AUTHORITY_CHANGED_EVENT } from './authorityEvents'

export function PlantLifecycleProvider({ children }: { children: ReactNode }) {
  const enabled = usesServerLifecycle()
  const [state, setState] = useState<PlantLifecycleState>(enabled
    ? { authority: 'server', status: 'loading', projection: null, error: null }
    : { authority: 'local' })

  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (!enabled) return
    try {
      const projection = await browserApiClient.getPlantLifecycleV3(signal)
      setState({ authority: 'server', status: 'ready', projection, error: null })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setState({ authority: 'server', status: 'error', projection: null, error: 'Unable to load the server plant lifecycle.' })
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    browserApiClient.getPlantLifecycleV3(controller.signal).then(
      (projection) => setState({ authority: 'server', status: 'ready', projection, error: null }),
      (error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setState({ authority: 'server', status: 'error', projection: null, error: 'Unable to load the server plant lifecycle.' })
      },
    )
    return () => controller.abort()
  }, [enabled])
  useEffect(() => { if (!enabled) return; const handler = () => { void refresh() }; window.addEventListener(PLANT_AUTHORITY_CHANGED_EVENT, handler); return () => window.removeEventListener(PLANT_AUTHORITY_CHANGED_EVENT, handler) }, [enabled, refresh])

  const value = useMemo(() => ({
    state,
    async plant(slotId: string, speciesId: string): Promise<boolean> {
      if (state.authority !== 'server' || state.status !== 'ready' || !isNurserySlotIdV3(slotId)) return false
      const stack = state.projection.seedStacks.find((item) => item.speciesId === speciesId)
      if (!stack) return false
      try {
        await browserApiClient.plantCommoditySeedV3({ slotId, speciesId, expectedSeedStackVersion: stack.version }, crypto.randomUUID())
        notifyGrowerAuthorityChanged()
        await refresh()
        return true
      } catch { await refresh(); return false }
    },
    async plantBredSeed(slotId: string, seedId: string): Promise<boolean> {
      if (state.authority !== 'server' || state.status !== 'ready' || !isNurserySlotIdV3(slotId) || !state.projection.bredSeeds.some((seed) => seed.seedId === seedId)) return false
      try {
        await browserApiClient.plantBredSeedV3({ slotId, seedId }, crypto.randomUUID())
        notifyGrowerAuthorityChanged()
        await refresh()
        return true
      } catch { await refresh(); return false }
    },
    async collect(slotId: string): Promise<boolean> {
      if (state.authority !== 'server' || state.status !== 'ready' || !isNurserySlotIdV3(slotId)) return false
      const slot = state.projection.nursery.slots.find((item) => item.slotId === slotId)
      if (!slot?.occupancy) return false
      try {
        await browserApiClient.collectPlantV3({ slotId, specimenId: slot.occupancy.specimen.specimenId, expectedOccupancyVersion: slot.occupancy.version, expectedSpecimenVersion: slot.occupancy.specimen.version }, crypto.randomUUID())
        notifyGrowerAuthorityChanged()
        await refresh()
        return true
      } catch { await refresh(); return false }
    },
    async breed(parent1Id: string, parent2Id: string): Promise<BredSeedV2 | null> {
      if (state.authority !== 'server' || state.status !== 'ready') return null
      const first = state.projection.ownedSpecimens.find((item) => item.specimenId === parent1Id)
      const second = state.projection.ownedSpecimens.find((item) => item.specimenId === parent2Id)
      if (!first || !second) return null
      try {
        const result = await browserApiClient.breedSpecimens({ parent1SpecimenId: first.specimenId, parent2SpecimenId: second.specimenId, expectedParent1Version: first.version, expectedParent2Version: second.version }, crypto.randomUUID())
        notifyGrowerAuthorityChanged()
        await refresh()
        return result.seed
      } catch { await refresh(); return null }
    },
  }), [refresh, state])

  return <PlantLifecycleContext.Provider value={value}>{children}</PlantLifecycleContext.Provider>
}
