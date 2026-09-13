import { createContext } from 'react'
import type { InventoryItem } from '../types/inventory'
import type { GameState } from './gameState'
import type { BredSeed } from '../types/bredSeed'

export interface GameStateContextValue {
  state: GameState
  plantSeed: (slotId: string, speciesId: string) => boolean
  collectPlant: (slotId: string) => boolean
  addInventoryItem: (item: InventoryItem) => void
  removeInventoryItem: (itemId: string, quantity: number) => boolean
  getSeedQuantity: (speciesId: string) => number
  breedPlants: (parent1Id: string, parent2Id: string) => BredSeed | null
  plantBredSeed: (slotId: string, seedId: string) => boolean
}

export const GameStateContext = createContext<GameStateContextValue | null>(null)
