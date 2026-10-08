import { createContext, useContext } from 'react'
import type { LocalMinimapStore } from './localMinimap'
interface MinimapValue { store: LocalMinimapStore; open: boolean; toggle(): void }
export const LocalMinimapContext = createContext<MinimapValue | null>(null)
export const useLocalMinimap = () => useContext(LocalMinimapContext)
