import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { CactiGrowApiError } from '../services/api/CactiGrowApiClient'
import { browserApiClient } from '../services/api/browserApiClient'
import { isNurserySlotIdV3 } from '../../shared/api/plantLifecycleV3'
import type { BredSeedV2 } from '../../shared/api/plantLifecycleV2'
import { PlantLifecycleContext, type PlantLifecycleState } from './PlantLifecycleContext'
import { usesServerLifecycle } from '../config/deploymentMode'
import { notifyGrowerAuthorityChanged } from './authorityEvents'
import { PLANT_AUTHORITY_CHANGED_EVENT } from './authorityEvents'
import { reconcilePlanting } from './reconcilePlanting'

export function PlantLifecycleProvider({ children }: { children: ReactNode }) {
  const enabled = usesServerLifecycle()
  const [state, setState] = useState<PlantLifecycleState>(enabled
    ? { authority: 'server', status: 'loading', projection: null, error: null }
    : { authority: 'local' })
  const readGeneration = useRef(0)
  const planting = useRef(false)

  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (!enabled) return
    const generation = ++readGeneration.current
    await browserApiClient.getPlantLifecycleV3(signal).then((projection) => {
      if (generation === readGeneration.current && !signal?.aborted) setState({ authority: 'server', status: 'ready', projection, error: null })
    }, (error: unknown) => {
      if (error instanceof DOMException && error.name === 'AbortError') return
      if (generation === readGeneration.current && !signal?.aborted) setState((previous) => previous.authority === 'server' && previous.status === 'ready' ? previous : { authority: 'server', status: 'error', projection: null, error: 'Unable to load the server plant lifecycle.' })
    })
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    void refresh(controller.signal)
    return () => controller.abort()
  }, [enabled, refresh])
  useEffect(() => { if (!enabled) return; const handler = () => { void refresh() }; window.addEventListener(PLANT_AUTHORITY_CHANGED_EVENT, handler); return () => window.removeEventListener(PLANT_AUTHORITY_CHANGED_EVENT, handler) }, [enabled, refresh])

  const value = useMemo(() => ({
    state,
    applyProjection(projection: import('../../shared/api/plantLifecycleV3').PlantLifecycleProjectionV3) {
      if (!enabled) return
      readGeneration.current += 1
      setState({ authority: 'server', status: 'ready', projection, error: null })
    },
    async plant(slotId: string, speciesId: string): Promise<boolean> {
      if (state.authority !== 'server' || state.status !== 'ready' || !isNurserySlotIdV3(slotId)) throw new CactiGrowApiError('server', 'The Nursery or seed is no longer available. Refresh and try again.')
      const stack = state.projection.seedStacks.find((item) => item.speciesId === speciesId)
      if (!stack) throw new CactiGrowApiError('server', 'That seed is no longer available. Refresh the Nursery.')
      if (planting.current) throw new CactiGrowApiError('server', 'A seed is already being planted. Please wait.')
      planting.current = true
      try {
        const result = await browserApiClient.plantCommoditySeedV3({ slotId, speciesId, expectedSeedStackVersion: stack.version }, crypto.randomUUID())
        readGeneration.current += 1
        setState((previous) => previous.authority === 'server' && previous.status === 'ready' ? { ...previous, projection: reconcilePlanting(previous.projection, result), error: null } : previous)
        notifyGrowerAuthorityChanged()
        return true
      } finally { planting.current = false }
    },
    async plantBredSeed(slotId: string, seedId: string): Promise<boolean> {
      if (state.authority !== 'server' || state.status !== 'ready' || !isNurserySlotIdV3(slotId) || !state.projection.bredSeeds.some((seed) => seed.seedId === seedId)) throw new CactiGrowApiError('server', 'The Nursery or seed is no longer available. Refresh and try again.')
      if (planting.current) throw new CactiGrowApiError('server', 'A seed is already being planted. Please wait.')
      planting.current = true
      try {
        const result = await browserApiClient.plantBredSeedV3({ slotId, seedId }, crypto.randomUUID())
        readGeneration.current += 1
        setState((previous) => previous.authority === 'server' && previous.status === 'ready' ? { ...previous, projection: reconcilePlanting(previous.projection, result), error: null } : previous)
        notifyGrowerAuthorityChanged()
        return true
      } finally { planting.current = false }
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
  }), [enabled, refresh, state])

  return <PlantLifecycleContext.Provider value={value}>{children}</PlantLifecycleContext.Provider>
}
