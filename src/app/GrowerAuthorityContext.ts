import { createContext } from 'react'
import type { GrowerAlphaCommandInputV1, GrowerAlphaProjectionV1 } from '../../shared/api/growerAlphaV1'

export type GrowerAuthorityState =
  | { authority: 'local' }
  | { authority: 'server'; status: 'loading' | 'error'; projection: null }
  | { authority: 'server'; status: 'ready'; projection: GrowerAlphaProjectionV1 }

export interface GrowerAuthorityValue {
  state: GrowerAuthorityState
  mutate: (command: GrowerAlphaCommandInputV1) => Promise<GrowerAlphaProjectionV1 | null>
  refresh: () => Promise<void>
  applyProjection: (projection: GrowerAlphaProjectionV1) => void
}

export const GrowerAuthorityContext = createContext<GrowerAuthorityValue | null>(null)
