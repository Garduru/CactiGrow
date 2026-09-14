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
  collectTissueSampleForState,
  extractFromSampleForState,
  createTreatmentForState,
} from './gameState'
import { canCancelListing, canListPlant, createMarketplaceListing } from '../features/marketplace/marketplaceModel'
import { canSellPlantToNpc, getNpcSaleValue } from '../features/marketplace/sellModel'
import { getPropertyUpgradeStatus } from '../features/property/propertyModel'
import { addGardenTag as addGardenTagForState, removeGardenTag as removeGardenTagForState, setGardenFavorite as setGardenFavoriteForState } from '../features/garden/gardenOrganizationModel'

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
      dispatch({ type: 'bred-seed/planted', slotId, seedId, now: Date.now(), treatmentRolls: [Math.random(), Math.random()] })
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
    upgradeLab(targetTier) {
      dispatch({ type: 'lab/upgraded', targetTier, now: Date.now() })
    },
    upgradeProperty(upgradeId) {
      if (!getPropertyUpgradeStatus(state.property, state.player, upgradeId).eligible) return false
      dispatch({ type: 'property/upgraded', upgradeId, now: Date.now() })
      return true
    },
    setGardenFavorite(plantId, favorite) {
      if (state.property.buildings.garden.level < 2 || !state.ownedPlants.some((plant) => plant.id === plantId)) return false
      if (setGardenFavoriteForState(state.gardenOrganization, plantId, favorite) === state.gardenOrganization) return false
      dispatch({ type: 'garden/favorite-set', plantId, favorite })
      return true
    },
    addGardenTag(plantId, tag) {
      if (state.property.buildings.garden.level < 2 || !state.ownedPlants.some((plant) => plant.id === plantId)) return false
      if (addGardenTagForState(state.gardenOrganization, plantId, tag) === state.gardenOrganization) return false
      dispatch({ type: 'garden/tag-added', plantId, tag })
      return true
    },
    removeGardenTag(plantId, tag) {
      if (state.property.buildings.garden.level < 2 || !state.ownedPlants.some((plant) => plant.id === plantId)) return false
      if (removeGardenTagForState(state.gardenOrganization, plantId, tag) === state.gardenOrganization) return false
      dispatch({ type: 'garden/tag-removed', plantId, tag })
      return true
    },
    collectTissueSample(plantId) {
      const sample = collectTissueSampleForState(state, plantId, Date.now())
      if (!sample) return null
      dispatch({ type: 'sample/collected', sample })
      return sample
    },
    extractFromSample(sampleId, target) {
      const attempt = extractFromSampleForState(state, sampleId, target, Date.now())
      if (!attempt) return null
      dispatch({ type: 'extraction/attempted', attempt })
      return attempt
    },
    applyTreatment(extractId, seedId) {
      const now = Date.now()
      const treatment = createTreatmentForState(state, extractId, seedId, now)
      if (!treatment) return null
      dispatch({ type: 'treatment/applied', extractId, seedId, treatmentId: treatment.id, now })
      return treatment
    },
    dismissLevelUp(noticeId) {
      dispatch({ type: 'progression/notice-dismissed', noticeId })
    },
  }), [state])

  return <GameStateContext.Provider value={value}>{children}</GameStateContext.Provider>
}
