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
import { usesServerLifecycle } from '../config/deploymentMode'
import { useGrowerAuthority } from '../app/useGrowerAuthority'
import { usePlantLifecycle } from '../app/usePlantLifecycle'
import { useGardenAuthority } from '../app/useGardenAuthority'
import { restoreServerGameState } from './restoreServerGameState'

export function GameStateProvider({ children }: { children: ReactNode }) {
  const serverBacked = usesServerLifecycle()
  const [state, dispatch] = useReducer(gameStateReducer, undefined, () => createInitialGameState(Date.now(), serverBacked))
  const grower = useGrowerAuthority()
  const lifecycle = usePlantLifecycle()
  const garden = useGardenAuthority()
  const server = grower.state.authority === 'server' && grower.state.status === 'ready' ? grower.state.projection : null
  const serverPlants = lifecycle.state.authority === 'server' && lifecycle.state.status === 'ready' ? lifecycle.state.projection : null
  const effectiveState = useMemo(() => {
    if (!server) return state
    if (!serverPlants || !garden.projection) return state
    return restoreServerGameState(state, server, serverPlants, garden.projection)
  }, [garden.projection, server, serverPlants, state])

  const value = useMemo<GameStateContextValue>(() => ({
    state: effectiveState,
    plantSeed(slotId, speciesId) {
      if (serverBacked) return false
      if (!canPlantSeed(state, slotId, speciesId)) return false
      dispatch({ type: 'seed/planted', slotId, speciesId, now: Date.now() })
      return true
    },
    collectPlant(slotId) {
      if (serverBacked) return false
      const now = Date.now()
      if (!canCollectPlant(state, slotId, now)) return false
      dispatch({ type: 'plant/collected', slotId, now })
      return true
    },
    addInventoryItem(item: InventoryItem) {
      if (serverBacked) return
      dispatch({ type: 'inventory/added', item, now: Date.now() })
    },
    removeInventoryItem(itemId, quantity) {
      if (serverBacked) return false
      const item = state.inventory.find((entry) => entry.id === itemId)
      if (!item || !Number.isFinite(quantity) || quantity <= 0 || item.quantity < quantity) return false
      dispatch({ type: 'inventory/removed', itemId, quantity })
      return true
    },
    getSeedQuantity(speciesId) {
      return getSeedQuantity(effectiveState, speciesId)
    },
    breedPlants(parent1Id, parent2Id) {
      if (serverBacked) return null
      const seed = createBredSeedForState(state, parent1Id, parent2Id, Date.now())
      if (!seed) return null
      dispatch({ type: 'offspring/created', seed })
      return seed
    },
    plantBredSeed(slotId, seedId) {
      if (serverBacked) return false
      if (!canPlantBredSeed(state, slotId, seedId)) return false
      dispatch({ type: 'bred-seed/planted', slotId, seedId, now: Date.now(), treatmentRolls: [Math.random(), Math.random()] })
      return true
    },
    async sellPlantToNpc(plantId) {
      // A loading/failed server projection must never select the demo reducer.
      if (grower.state.authority === 'server' && !server) return null
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
      if (!effectiveState.ownedPlants.some((plant) => plant.id === plantId)) return false
      if (favorite && effectiveState.ownedPlants.find((plant) => plant.id === plantId)?.isListedForSale) throw new Error('Cancel the Marketplace listing before favoriting this plant.')
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
  }), [effectiveState, garden, grower, server, state, serverBacked])

  if (serverBacked && (!server || !serverPlants || !garden.projection)) {
    const failed = (grower.state.authority === 'server' && grower.state.status === 'error')
      || (lifecycle.state.authority === 'server' && lifecycle.state.status === 'error') || garden.error
    return <main className="deployment-access-state" role={failed ? 'alert' : 'status'}>
      <h1>{failed ? 'Unable to load your saved game' : 'Loading your saved game...'}</h1>
      {failed && <><p>Your saved progress has not been replaced. Reload to try again.</p><button type="button" onClick={() => window.location.reload()}>Reload saved game</button></>}
    </main>
  }
  return <GameStateContext.Provider value={value}>{children}</GameStateContext.Provider>
}
