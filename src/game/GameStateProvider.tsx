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
import { assignGardenDisplay as assignGardenDisplayForState } from '../features/garden/gardenDisplayModel'
import { getDeploymentMode } from '../config/deploymentMode'
import { useGrowerAuthority } from '../app/useGrowerAuthority'
import { usePlantLifecycle } from '../app/usePlantLifecycle'
import { useGardenAuthority } from '../app/useGardenAuthority'

export function GameStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameStateReducer, undefined, () => createInitialGameState(Date.now(), getDeploymentMode() === 'staging'))
  const grower = useGrowerAuthority()
  const lifecycle = usePlantLifecycle()
  const garden = useGardenAuthority()
  const server = grower.state.authority === 'server' && grower.state.status === 'ready' ? grower.state.projection : null
  const serverPlants = lifecycle.state.authority === 'server' && lifecycle.state.status === 'ready' ? lifecycle.state.projection : null
  const effectiveState = useMemo(() => {
    if (!server) return state
    const ownedPlants = serverPlants?.ownedSpecimens.map((plant) => ({ id: plant.specimenId, ownerId: server.player.playerId, speciesId: plant.speciesId, cloneLineId: plant.cloneLineId, stage: 'mature' as const, plantedAt: plant.plantedAt, lastUpdatedAt: plant.collectedAt ?? plant.plantedAt, collectedAt: plant.collectedAt ?? plant.plantedAt, genetics: plant.genetics, geneticFeatures: plant.geneticFeatures, specialVariants: plant.specialVariants, isHarvestable: false, isListedForSale: server.marketplaceListings.some((listing) => listing.plantId === plant.specimenId && listing.status === 'active'), isHybrid: plant.isHybrid })) ?? []
    const bredSeeds = serverPlants?.bredSeeds.map((seed) => ({ id: seed.seedId, speciesId: seed.speciesId, cloneLineId: seed.cloneLineId, createdAt: seed.createdAt, genetics: seed.genetics, parentPlantIds: seed.parentPlantIds, parentSpeciesIds: seed.parentSpeciesIds, isHybrid: seed.isHybrid, geneticFeatures: seed.geneticFeatures, specialVariants: seed.specialVariants, ...(server.seedTreatments[seed.seedId] ? { quantitativeTreatments: [server.seedTreatments[seed.seedId]] } : {}) })) ?? []
    return { ...state, player: { id: server.player.playerId, username: 'Grower', tokens: server.player.tokenBalance, skills: { cultivation: { xp: server.player.skills.cultivationXp }, breeding: { xp: server.player.skills.breedingXp }, genetics: { xp: server.player.skills.geneticsXp } } }, ownedPlants, bredSeeds, marketplaceListings: server.marketplaceListings, achievements: server.achievements, speciesDiscoveries: server.discoveries, journalStats: server.journalStats, geneticsResearch: server.research, geneticsLab: server.lab, property: server.property, gardenOrganization: garden.projection?.organization ?? {}, gardenDisplayAssignments: garden.projection?.displayAssignments ?? state.gardenDisplayAssignments }
  }, [garden.projection, server, serverPlants, state])

  const value = useMemo<GameStateContextValue>(() => ({
    state: effectiveState,
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
    async sellPlantToNpc(plantId) {
      if (!canSellPlantToNpc(effectiveState, plantId)) return null
      const plant = effectiveState.ownedPlants.find((specimen) => specimen.id === plantId)
      const saleValue = plant ? getNpcSaleValue(plant) : null
      if (saleValue === null) return null
      if (server) return await grower.mutate({ type: 'sell-specimen-to-npc', specimenId: plantId }) ? saleValue : null
      dispatch({ type: 'plant/sold-to-npc', plantId, expectedValue: saleValue, now: Date.now() })
      return saleValue
    },
    async listPlant(plantId, price) {
      if (!canListPlant(effectiveState, plantId, price)) return null
      const plant = effectiveState.ownedPlants.find((specimen) => specimen.id === plantId)
      if (!plant) return null
      if (server) { const projection = await grower.mutate({ type: 'list-specimen', specimenId: plantId, askingPrice: price }); return projection?.marketplaceListings.find((listing) => listing.plantId === plantId && listing.status === 'active') ?? null }
      const listing = createMarketplaceListing(plant, state.player.id, price, Date.now())
      if (!listing) return null
      dispatch({ type: 'marketplace/listed', listing })
      return listing
    },
    async cancelListing(listingId) {
      if (!canCancelListing(effectiveState, listingId)) return false
      if (server) return Boolean(await grower.mutate({ type: 'cancel-listing', listingId }))
      dispatch({ type: 'marketplace/cancelled', listingId, now: Date.now() })
      return true
    },
    async observePlant(plantId) {
      if (server) return Boolean(await grower.mutate({ type: 'observe-specimen', specimenId: plantId }))
      dispatch({ type: 'research/observed', plantId, now: Date.now() })
      return true
    },
    async analyzePlant(plantId) {
      if (server) return Boolean(await grower.mutate({ type: 'analyze-specimen', specimenId: plantId }))
      dispatch({ type: 'research/analyzed', plantId, now: Date.now() })
      return true
    },
    async comparePlants(firstPlantId, secondPlantId) {
      if (server) return Boolean(await grower.mutate({ type: 'compare-specimens', firstSpecimenId: firstPlantId, secondSpecimenId: secondPlantId }))
      dispatch({ type: 'research/compared', firstPlantId, secondPlantId, now: Date.now() })
      return true
    },
    async upgradeLab(targetTier) {
      if (server) return Boolean(await grower.mutate({ type: 'upgrade-lab', targetTier }))
      dispatch({ type: 'lab/upgraded', targetTier, now: Date.now() })
      return true
    },
    async upgradeProperty(upgradeId) {
      if (!getPropertyUpgradeStatus(effectiveState.property, effectiveState.player, upgradeId).eligible) return false
      if (server) return Boolean(await grower.mutate({ type: 'upgrade-property', upgradeId }))
      dispatch({ type: 'property/upgraded', upgradeId, now: Date.now() })
      return true
    },
    async setFarmAccessPreference(preference) {
      if (server) return Boolean(await grower.mutate({ type: 'set-farm-access', preference }))
      dispatch({ type: 'property/farm-access-set', preference })
      return true
    },
    async setGardenFavorite(plantId, favorite) {
      if (effectiveState.property.buildings.garden.level < 2 || !effectiveState.ownedPlants.some((plant) => plant.id === plantId)) return false
      if (setGardenFavoriteForState(effectiveState.gardenOrganization, plantId, favorite) === effectiveState.gardenOrganization) return false
      if (server) return Boolean(await garden.mutate({ type: 'favorite', specimenId: plantId, favorite }))
      dispatch({ type: 'garden/favorite-set', plantId, favorite })
      return true
    },
    async assignGardenDisplay(slotId, plantId) {
      if (!effectiveState.ownedPlants.some((plant) => plant.id === plantId)) return false
      if (assignGardenDisplayForState(effectiveState.gardenDisplayAssignments, slotId, plantId) === effectiveState.gardenDisplayAssignments) return false
      if (server) return Boolean(await garden.mutate({ type: 'assign-display', slotId, specimenId: plantId }))
      dispatch({ type: 'garden/display-assigned', slotId, plantId })
      return true
    },
    async clearGardenDisplay(slotId) {
      if (server) return Boolean(await garden.mutate({ type: 'clear-display', slotId }))
      dispatch({ type: 'garden/display-cleared', slotId })
      return true
    },
    async addGardenTag(plantId, tag) {
      if (effectiveState.property.buildings.garden.level < 2 || !effectiveState.ownedPlants.some((plant) => plant.id === plantId)) return false
      if (addGardenTagForState(effectiveState.gardenOrganization, plantId, tag) === effectiveState.gardenOrganization) return false
      if (server) return Boolean(await garden.mutate({ type: 'add-tag', specimenId: plantId, tag }))
      dispatch({ type: 'garden/tag-added', plantId, tag })
      return true
    },
    async removeGardenTag(plantId, tag) {
      if (effectiveState.property.buildings.garden.level < 2 || !effectiveState.ownedPlants.some((plant) => plant.id === plantId)) return false
      if (removeGardenTagForState(effectiveState.gardenOrganization, plantId, tag) === effectiveState.gardenOrganization) return false
      if (server) return Boolean(await garden.mutate({ type: 'remove-tag', specimenId: plantId, tag }))
      dispatch({ type: 'garden/tag-removed', plantId, tag })
      return true
    },
    async collectTissueSample(plantId) {
      if (server) { await grower.mutate({ type: 'collect-tissue-sample', specimenId: plantId }); return null }
      const sample = collectTissueSampleForState(state, plantId, Date.now())
      if (!sample) return null
      dispatch({ type: 'sample/collected', sample })
      return sample
    },
    async extractFromSample(sampleId, target) {
      if (server) { await grower.mutate({ type: 'extract-sample', sampleId, target }); return null }
      const attempt = extractFromSampleForState(state, sampleId, target, Date.now())
      if (!attempt) return null
      dispatch({ type: 'extraction/attempted', attempt })
      return attempt
    },
    async applyTreatment(extractId, seedId) {
      if (server) { const projection = await grower.mutate({ type: 'apply-seed-treatment', extractId, seedId }); return projection?.seedTreatments[seedId] ?? null }
      const now = Date.now()
      const treatment = createTreatmentForState(state, extractId, seedId, now)
      if (!treatment) return null
      dispatch({ type: 'treatment/applied', extractId, seedId, treatmentId: treatment.id, now })
      return treatment
    },
    dismissLevelUp(noticeId) {
      dispatch({ type: 'progression/notice-dismissed', noticeId })
    },
  }), [effectiveState, garden, grower, server, state])

  return <GameStateContext.Provider value={value}>{children}</GameStateContext.Provider>
}
