import { calculateNurseryGrowth, createInitialNurserySlots, createNurseryPlant, type NurserySlotState } from '../features/nursery/nurseryModel'
import type { InventoryItem } from '../types/inventory'
import type { Plant } from '../types/plant'

export interface CollectedPlant extends Plant {
  collectedAt: string
}

export interface GameState {
  inventory: InventoryItem[]
  nurserySlots: NurserySlotState[]
  ownedPlants: CollectedPlant[]
}

export type GameAction =
  | { type: 'seed/planted'; slotId: string; speciesId: string; now: number }
  | { type: 'plant/collected'; slotId: string; now: number }
  | { type: 'inventory/added'; item: InventoryItem }
  | { type: 'inventory/removed'; itemId: string; quantity: number }

export function createInitialGameState(now = Date.now()): GameState {
  return {
    inventory: [
      { id: 'seed-echinopsis-pachanoi', itemType: 'seed', itemKey: 'echinopsis-pachanoi', quantity: 4 },
      { id: 'seed-lophophora-williamsii', itemType: 'seed', itemKey: 'lophophora-williamsii', quantity: 2 },
    ],
    nurserySlots: createInitialNurserySlots(now),
    ownedPlants: [],
  }
}

export function getSeedQuantity(state: GameState, speciesId: string): number {
  return state.inventory.find((item) => item.itemType === 'seed' && item.itemKey === speciesId)?.quantity ?? 0
}

export function getTotalSeedQuantity(state: GameState): number {
  return state.inventory.reduce((total, item) => (
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
  }
}
