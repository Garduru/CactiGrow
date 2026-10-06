import { createContext, useContext } from 'react'
import type { WorldLocation } from '../../shared/world/types.ts'
export interface WorldLocationState { active: boolean; location: WorldLocation | null; error: string; pending: boolean; transition(exitId: string): Promise<void>; travel(destinationId: string): Promise<void>; reload(): void }
export const WorldLocationContext = createContext<WorldLocationState>({ active: false, location: null, error: '', pending: false, transition: async () => {}, travel: async () => {}, reload() {} })
export const useWorldLocation = () => useContext(WorldLocationContext)
