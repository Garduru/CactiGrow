import { createContext } from 'react'
import type { InventoryItem } from '../types/inventory'
import type { GameState } from './gameState'

export interface GameStateContextValue {
  state: GameState
  plantSeed: (slotId: string, speciesId: string) => boolean
  collectPlant: (slotId: string) => boolean
  addInventoryItem: (item: InventoryItem) => void
  removeInventoryItem: (itemId: string, quantity: number) => boolean
  getSeedQuantity: (speciesId: string) => number
}

export const GameStateContext = createContext<GameStateContextValue | null>(null)
