import { useMemo, useReducer } from 'react'
import type { ReactNode } from 'react'
import type { InventoryItem } from '../types/inventory'
import { GameStateContext, type GameStateContextValue } from './GameStateContext'
import {
  canCollectPlant,
  canPlantBredSeed,
  canPlantSeed,
  breedPlants as createBredSeedForState,
  createInitialGameState,
  gameStateReducer,
  getSeedQuantity,
} from './gameState'
import { canCancelListing, canListPlant, createMarketplaceListing } from '../features/marketplace/marketplaceModel'
import { canSellPlantToNpc, getNpcSaleValue } from '../features/marketplace/sellModel'

export function GameStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameStateReducer, undefined, () => createInitialGameState())

  const value = useMemo<GameStateContextValue>(() => ({
    state,
    plantSeed(slotId, speciesId) {
      if (!canPlantSeed(state, slotId, speciesId)) return false
      dispatch({ type: 'seed/planted', slotId, speciesId, now: Date.now() })
      return true
    },
    collectPlant(slotId) {
      const now = Date.now()
      if (!canCollectPlant(state, slotId, now)) return false
      dispatch({ type: 'plant/collected', slotId, now })
      return true
    },
    addInventoryItem(item: InventoryItem) {
      dispatch({ type: 'inventory/added', item, now: Date.now() })
    },
    removeInventoryItem(itemId, quantity) {
      const item = state.inventory.find((entry) => entry.id === itemId)
      if (!item || !Number.isFinite(quantity) || quantity <= 0 || item.quantity < quantity) return false
      dispatch({ type: 'inventory/removed', itemId, quantity })
      return true
    },
    getSeedQuantity(speciesId) {
      return getSeedQuantity(state, speciesId)
    },
    breedPlants(parent1Id, parent2Id) {
      const seed = createBredSeedForState(state, parent1Id, parent2Id, Date.now())
      if (!seed) return null
      dispatch({ type: 'offspring/created', seed })
      return seed
    },
    plantBredSeed(slotId, seedId) {
      if (!canPlantBredSeed(state, slotId, seedId)) return false
      dispatch({ type: 'bred-seed/planted', slotId, seedId, now: Date.now() })
      return true
    },
    sellPlantToNpc(plantId) {
      if (!canSellPlantToNpc(state, plantId)) return null
      const plant = state.ownedPlants.find((specimen) => specimen.id === plantId)
      const saleValue = plant ? getNpcSaleValue(plant) : null
      if (saleValue === null) return null
      dispatch({ type: 'plant/sold-to-npc', plantId, expectedValue: saleValue, now: Date.now() })
      return saleValue
    },
    listPlant(plantId, price) {
      if (!canListPlant(state, plantId, price)) return null
      const plant = state.ownedPlants.find((specimen) => specimen.id === plantId)
      if (!plant) return null
      const listing = createMarketplaceListing(plant, state.player.id, price, Date.now())
      if (!listing) return null
      dispatch({ type: 'marketplace/listed', listing })
      return listing
    },
    cancelListing(listingId) {
      if (!canCancelListing(state, listingId)) return false
      dispatch({ type: 'marketplace/cancelled', listingId, now: Date.now() })
      return true
    },
    observePlant(plantId) {
      dispatch({ type: 'research/observed', plantId, now: Date.now() })
    },
    analyzePlant(plantId) {
      dispatch({ type: 'research/analyzed', plantId, now: Date.now() })
    },
    comparePlants(firstPlantId, secondPlantId) {
      dispatch({ type: 'research/compared', firstPlantId, secondPlantId, now: Date.now() })
    },
    dismissLevelUp(noticeId) {
      dispatch({ type: 'progression/notice-dismissed', noticeId })
    },
  }), [state])

  return <GameStateContext.Provider value={value}>{children}</GameStateContext.Provider>
}
