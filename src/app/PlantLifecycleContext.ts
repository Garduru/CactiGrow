import { createContext } from 'react'
import type { BredSeedV2 } from '../../shared/api/plantLifecycleV2'
import type { PlantLifecycleProjectionV3 } from '../../shared/api/plantLifecycleV3'

export type PlantLifecycleState =
  | { authority: 'local' }
  | { authority: 'server'; status: 'loading'; projection: null; error: null }
  | { authority: 'server'; status: 'ready'; projection: PlantLifecycleProjectionV3; error: string | null }
  | { authority: 'server'; status: 'error'; projection: null; error: string }

export interface PlantLifecycleContextValue { state: PlantLifecycleState; refresh(signal?: AbortSignal): Promise<boolean>; applyProjection(projection: PlantLifecycleProjectionV3): void; plant(slotId: string, speciesId: string, tutorial?: true): Promise<boolean>; plantBredSeed(slotId: string, seedId: string): Promise<boolean>; collect(slotId: string): Promise<boolean>; breed(parent1Id: string, parent2Id: string): Promise<BredSeedV2 | null> }
export const PlantLifecycleContext = createContext<PlantLifecycleContextValue | null>(null)
