import { createContext, useContext } from 'react'
import type { StartingCommandInput, StartingExperienceV1 } from '../../../shared/api/startingExperienceV1.ts'
export interface StartingValue { now(): number; active: boolean; state: StartingExperienceV1 | null; error: string; pending: boolean; refresh(): Promise<void>; execute(command: StartingCommandInput): Promise<boolean> }
export const StartingContext = createContext<StartingValue>({ now: () => Date.now(), active: false, state: null, error: '', pending: false, refresh: async () => {}, execute: async () => false })
export const useStartingExperience = () => useContext(StartingContext)
