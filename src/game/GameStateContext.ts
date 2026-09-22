import { createContext } from 'react'
import type { InventoryItem } from '../types/inventory'
import type { GameState } from './gameState'
import type { BredSeed } from '../types/bredSeed'
import type { MarketplaceListing } from '../types/marketplace'
import type { ExtractionAttempt, GeneticsLabTierId, QuantitativeExtractTarget, TissueSample } from '../types/lab'
import type { QuantitativeSeedTreatment } from '../types/treatment'
import type { FarmAccessPreference } from '../types/property'
import type { GardenDisplaySlotId } from '../types/garden'

export interface GameStateContextValue {
  state: GameState
  plantSeed: (slotId: string, speciesId: string) => boolean
  collectPlant: (slotId: string) => boolean
  addInventoryItem: (item: InventoryItem) => void
  removeInventoryItem: (itemId: string, quantity: number) => boolean
  getSeedQuantity: (speciesId: string) => number
  breedPlants: (parent1Id: string, parent2Id: string) => BredSeed | null
  plantBredSeed: (slotId: string, seedId: string) => boolean
  sellPlantToNpc: (plantId: string) => Promise<number | null>
  listPlant: (plantId: string, price: number) => Promise<MarketplaceListing | null>
  cancelListing: (listingId: string) => Promise<boolean>
  observePlant: (plantId: string) => Promise<boolean>
  analyzePlant: (plantId: string) => Promise<boolean>
  comparePlants: (firstPlantId: string, secondPlantId: string) => Promise<boolean>
  upgradeLab: (targetTier: GeneticsLabTierId) => Promise<boolean>
  upgradeProperty: (upgradeId: string) => Promise<boolean>
  setFarmAccessPreference: (preference: FarmAccessPreference) => Promise<boolean>
  setGardenFavorite: (plantId: string, favorite: boolean) => Promise<boolean>
  assignGardenDisplay: (slotId: GardenDisplaySlotId, plantId: string) => Promise<boolean>
  clearGardenDisplay: (slotId: GardenDisplaySlotId) => Promise<boolean>
  addGardenTag: (plantId: string, tag: string) => Promise<boolean>
  removeGardenTag: (plantId: string, tag: string) => Promise<boolean>
  collectTissueSample: (plantId: string) => Promise<TissueSample | null>
  extractFromSample: (sampleId: string, target: QuantitativeExtractTarget) => Promise<ExtractionAttempt | null>
  applyTreatment: (extractId: string, seedId: string) => Promise<QuantitativeSeedTreatment | null>
  dismissLevelUp: (noticeId: string) => void
}

export const GameStateContext = createContext<GameStateContextValue | null>(null)
