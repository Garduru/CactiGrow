import { createContext, useContext } from 'react'
import type { Guidance } from './tutorialGuidance'
export const TutorialGuidanceContext = createContext<Guidance>({ target: null, instruction: '' })
export const useTutorialGuidance = () => useContext(TutorialGuidanceContext)
