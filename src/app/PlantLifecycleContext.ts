import { createContext } from 'react'
import type { PlantLifecycleProjectionV1 } from '../../shared/api/plantLifecycleV1'

export type PlantLifecycleState =
  | { authority: 'local' }
  | { authority: 'server'; status: 'loading'; projection: null; error: null }
  | { authority: 'server'; status: 'ready'; projection: PlantLifecycleProjectionV1; error: string | null }
  | { authority: 'server'; status: 'error'; projection: null; error: string }

export interface PlantLifecycleContextValue { state: PlantLifecycleState; plant(slotId: string, speciesId: string): Promise<boolean>; collect(slotId: string): Promise<boolean> }
export const PlantLifecycleContext = createContext<PlantLifecycleContextValue | null>(null)
