import { canBreed, createBredSeed, hasValidGenetics, resolveOffspringSpecies } from '../features/breeding/breedingModel'
import { calculateNurseryGrowth, createInitialNurserySlots, createNurseryPlant, createNurseryPlantFromBredSeed, type NurserySlotState } from '../features/nursery/nurseryModel'
import { canCancelListing, canListPlant, getActiveListings, getListingForPlant } from '../features/marketplace/marketplaceModel'
import { canSellPlantToNpc, getNpcSaleValue } from '../features/marketplace/sellModel'
import type { BredSeed } from '../types/bredSeed'
import type { InventoryItem } from '../types/inventory'
import type { MarketplaceListing } from '../types/marketplace'
import type { Plant } from '../types/plant'

export interface CollectedPlant extends Plant {
  collectedAt: string
}

export interface GameState {
  player: {
    id: string
    username: string
    tokens: number
    level: number
    xp: number
    xpRequired: number
  }
  inventory: InventoryItem[]
  nurserySlots: NurserySlotState[]
  ownedPlants: CollectedPlant[]
  bredSeeds: BredSeed[]
  marketplaceListings: MarketplaceListing[]
}

export type GameAction =
  | { type: 'seed/planted'; slotId: string; speciesId: string; now: number }
  | { type: 'plant/collected'; slotId: string; now: number }
  | { type: 'inventory/added'; item: InventoryItem }
  | { type: 'inventory/removed'; itemId: string; quantity: number }
  | { type: 'offspring/created'; seed: BredSeed }
  | { type: 'bred-seed/planted'; slotId: string; seedId: string; now: number }
  | { type: 'plant/sold-to-npc'; plantId: string; expectedValue: number }
  | { type: 'marketplace/listed'; listing: MarketplaceListing }
  | { type: 'marketplace/cancelled'; listingId: string; now: number }

export function createInitialGameState(now = Date.now()): GameState {
  return {
    player: {
      id: 'local-player',
      username: 'Player',
      tokens: 1216,
      level: 4,
      xp: 315,
      xpRequired: 388,
    },
    inventory: [
      { id: 'seed-echinopsis-pachanoi', itemType: 'seed', itemKey: 'echinopsis-pachanoi', quantity: 4 },
      { id: 'seed-lophophora-williamsii', itemType: 'seed', itemKey: 'lophophora-williamsii', quantity: 2 },
    ],
    nurserySlots: createInitialNurserySlots(now),
    ownedPlants: [],
    bredSeeds: [],
    marketplaceListings: [],
  }
}

export function getSeedQuantity(state: GameState, speciesId: string): number {
  return state.inventory.find((item) => item.itemType === 'seed' && item.itemKey === speciesId)?.quantity ?? 0
}

export function getTotalSeedQuantity(state: GameState): number {
  return state.bredSeeds.length + state.inventory.reduce((total, item) => (
    item.itemType === 'seed' ? total + item.quantity : total
  ), 0)
}

export function canPlantSeed(state: GameState, slotId: string, speciesId: string): boolean {
  const slot = state.nurserySlots.find((entry) => entry.id === slotId)
  return Boolean(slot && !slot.plant && getSeedQuantity(state, speciesId) > 0)
}

export function canCollectPlant(state: GameState, slotId: string, now: number): boolean {
  const plant = state.nurserySlots.find((entry) => entry.id === slotId)?.plant
  return Boolean(plant && calculateNurseryGrowth(plant.plantedAt, now).isMature)
}

export function canPlantBredSeed(state: GameState, slotId: string, seedId: string): boolean {
  const slot = state.nurserySlots.find((entry) => entry.id === slotId)
  return Boolean(slot && !slot.plant && state.bredSeeds.some((seed) => seed.id === seedId))
}

export function breedPlants(state: GameState, parent1Id: string, parent2Id: string, now: number): BredSeed | null {
  const parent1 = state.ownedPlants.find((plant) => plant.id === parent1Id)
  const parent2 = state.ownedPlants.find((plant) => plant.id === parent2Id)
  return parent1 && parent2 ? createBredSeed(parent1, parent2, now) : null
}

export { getActiveListings, getListingForPlant }

export function gameStateReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'seed/planted': {
      if (!canPlantSeed(state, action.slotId, action.speciesId)) return state

      return {
        ...state,
        inventory: state.inventory.map((item) => (
          item.itemType === 'seed' && item.itemKey === action.speciesId
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )),
        nurserySlots: state.nurserySlots.map((slot) => (
          slot.id === action.slotId
            ? { ...slot, plant: createNurseryPlant(action.speciesId, action.now) }
            : slot
        )),
      }
    }

    case 'plant/collected': {
      if (!canCollectPlant(state, action.slotId, action.now)) return state
      const plant = state.nurserySlots.find((slot) => slot.id === action.slotId)?.plant
      if (!plant) return state

      const collectedAt = new Date(action.now).toISOString()
      return {
        ...state,
        nurserySlots: state.nurserySlots.map((slot) => (
          slot.id === action.slotId ? { ...slot, plant: null } : slot
        )),
        ownedPlants: [
          ...state.ownedPlants,
          {
            ...plant,
            stage: 'mature',
            lastUpdatedAt: collectedAt,
            isHarvestable: false,
            collectedAt,
          },
        ],
      }
    }

    case 'inventory/added': {
      if (!Number.isFinite(action.item.quantity) || action.item.quantity <= 0) return state
      const existing = state.inventory.find((item) => item.id === action.item.id)
      return {
        ...state,
        inventory: existing
          ? state.inventory.map((item) => item.id === action.item.id
            ? { ...item, quantity: item.quantity + action.item.quantity }
            : item)
          : [...state.inventory, action.item],
      }
    }

    case 'inventory/removed': {
      if (!Number.isFinite(action.quantity) || action.quantity <= 0) return state
      const item = state.inventory.find((entry) => entry.id === action.itemId)
      if (!item || item.quantity < action.quantity) return state
      return {
        ...state,
        inventory: state.inventory.map((entry) => entry.id === action.itemId
          ? { ...entry, quantity: entry.quantity - action.quantity }
          : entry),
      }
    }

    case 'offspring/created': {
      const [parent1Id, parent2Id] = action.seed.parentPlantIds
      const parent1 = state.ownedPlants.find((plant) => plant.id === parent1Id)
      const parent2 = state.ownedPlants.find((plant) => plant.id === parent2Id)
      if (!parent1 || !parent2 || !canBreed(parent1, parent2) || !hasValidGenetics(action.seed.genetics)) return state
      if (action.seed.speciesId !== resolveOffspringSpecies(parent1)) return state
      if (state.bredSeeds.some((seed) => seed.id === action.seed.id)) return state
      return { ...state, bredSeeds: [...state.bredSeeds, action.seed] }
    }

    case 'bred-seed/planted': {
      if (!canPlantBredSeed(state, action.slotId, action.seedId)) return state
      const seed = state.bredSeeds.find((entry) => entry.id === action.seedId)
      if (!seed) return state
      return {
        ...state,
        bredSeeds: state.bredSeeds.filter((entry) => entry.id !== action.seedId),
        nurserySlots: state.nurserySlots.map((slot) => slot.id === action.slotId
          ? { ...slot, plant: createNurseryPlantFromBredSeed(seed, action.now) }
          : slot),
      }
    }

    case 'plant/sold-to-npc': {
      if (!canSellPlantToNpc(state, action.plantId)) return state
      const plant = state.ownedPlants.find((specimen) => specimen.id === action.plantId)
      if (!plant) return state
      const saleValue = getNpcSaleValue(plant)
      if (saleValue === null || saleValue !== action.expectedValue) return state
      const nextTokens = state.player.tokens + saleValue
      if (!Number.isSafeInteger(nextTokens) || nextTokens < 0) return state

      return {
        ...state,
        player: { ...state.player, tokens: nextTokens },
        ownedPlants: state.ownedPlants.filter((specimen) => specimen.id !== action.plantId),
      }
    }

    case 'marketplace/listed': {
      const { listing } = action
      if (listing.sellerId !== state.player.id) return state
      if (!listing.id || listing.status !== 'active' || !Number.isFinite(Date.parse(listing.createdAt))) return state
      if (!canListPlant(state, listing.plantId, listing.askingPrice)) return state
      if (state.marketplaceListings.some((entry) => entry.id === listing.id)) return state
      const plant = state.ownedPlants.find((specimen) => specimen.id === listing.plantId)
      if (!plant) return state

      return {
        ...state,
        ownedPlants: state.ownedPlants.map((specimen) => specimen.id === listing.plantId
          ? { ...specimen, isListedForSale: true }
          : specimen),
        marketplaceListings: [...state.marketplaceListings, listing],
      }
    }

    case 'marketplace/cancelled': {
      if (!canCancelListing(state, action.listingId)) return state
      const listing = state.marketplaceListings.find((entry) => entry.id === action.listingId)
      if (!listing) return state
      const cancelledAt = new Date(action.now).toISOString()

      return {
        ...state,
        ownedPlants: state.ownedPlants.map((specimen) => specimen.id === listing.plantId
          ? { ...specimen, isListedForSale: false }
          : specimen),
        marketplaceListings: state.marketplaceListings.map((entry) => entry.id === action.listingId
          ? { ...entry, status: 'cancelled', cancelledAt }
          : entry),
      }
    }
  }
}
