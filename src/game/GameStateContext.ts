import { createContext } from 'react'
import type { InventoryItem } from '../types/inventory'
import type { GameState } from './gameState'
import type { BredSeed } from '../types/bredSeed'
import type { MarketplaceListing } from '../types/marketplace'

export interface GameStateContextValue {
  state: GameState
  plantSeed: (slotId: string, speciesId: string) => boolean
  collectPlant: (slotId: string) => boolean
  addInventoryItem: (item: InventoryItem) => void
  removeInventoryItem: (itemId: string, quantity: number) => boolean
  getSeedQuantity: (speciesId: string) => number
  breedPlants: (parent1Id: string, parent2Id: string) => BredSeed | null
  plantBredSeed: (slotId: string, seedId: string) => boolean
  sellPlantToNpc: (plantId: string) => number | null
  listPlant: (plantId: string, price: number) => MarketplaceListing | null
  cancelListing: (listingId: string) => boolean
  observePlant: (plantId: string) => void
  analyzePlant: (plantId: string) => void
  comparePlants: (firstPlantId: string, secondPlantId: string) => void
  dismissLevelUp: (noticeId: string) => void
}

export const GameStateContext = createContext<GameStateContextValue | null>(null)
