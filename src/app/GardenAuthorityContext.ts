import { createContext } from 'react'
import type { GardenCommandInputV1, GardenProjectionV1 } from '../../shared/api/gardenV1.ts'
export interface GardenAuthorityValue { projection: GardenProjectionV1 | null; loading: boolean; error: boolean; mutate(command: GardenCommandInputV1): Promise<boolean> }
export const GardenAuthorityContext = createContext<GardenAuthorityValue | null>(null)
