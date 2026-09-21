import { createContext } from 'react'
import type { PlayerBootstrapV1 } from '../../shared/api/playerBootstrapV1'

export type PlayerBootstrapState =
  | { status: 'loading' }
  | { status: 'authenticated'; bootstrap: PlayerBootstrapV1; requestId: string }
  | { status: 'unauthenticated'; requestId?: string }
  | { status: 'error'; message: string; requestId?: string }

export const PlayerBootstrapContext = createContext<PlayerBootstrapState | null>(null)
