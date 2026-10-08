import { createContext, useContext } from 'react'
import type { ExplorationCommandV1, ExplorationDevCommandV1, ExplorationProjectionV1 } from '../../../shared/api/explorationV1.ts'

export interface ExplorationNotice { id: number; title: string; detail?: string; retryable?: boolean; retryLabel?: string }
type IntentOf<T> = T extends ExplorationCommandV1 ? Omit<T, 'v' | 'commandId' | 'expectedWorldRevision'> : never
export type ExplorationIntent = IntentOf<ExplorationCommandV1>
export interface ExplorationValue {
  active: boolean
  projection: ExplorationProjectionV1 | null
  pending: boolean
  error: string
  notice: ExplorationNotice | null
  now(): number
  refresh(): Promise<void>
  execute(intent: ExplorationIntent): Promise<boolean>
  reset(type: ExplorationDevCommandV1['type']): Promise<boolean>
  dismissNotice(): void
  retryNotice(): Promise<boolean>
}
export const ExplorationContext = createContext<ExplorationValue>({ active: false, projection: null, pending: false, error: '', notice: null, now: () => Date.now(), refresh: async () => {}, execute: async () => false, reset: async () => false, dismissNotice() {}, retryNotice: async () => false })
export const useExploration = () => useContext(ExplorationContext)
