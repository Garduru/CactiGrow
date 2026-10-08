import { createContext, useContext } from 'react'
import type { TownContentProjectionV1, TownContentResultV1, TownNpcId } from '../../../shared/api/townContentV1.ts'
import type { WorldPoint } from '../../../shared/world/types.ts'

export interface TownContentValue {
  active: boolean
  projection: TownContentProjectionV1 | null
  pending: boolean
  error: string
  refresh(): Promise<void>
  talk(entityId: TownNpcId, position: WorldPoint): Promise<TownContentResultV1 | null>
}
export const TownContentContext = createContext<TownContentValue>({ active: false, projection: null, pending: false, error: '', refresh: async () => {}, talk: async () => null })
export const useTownContent = () => useContext(TownContentContext)
