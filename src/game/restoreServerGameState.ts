import type { GameState } from './gameState.ts'
import type { GrowerAlphaProjectionV1 } from '../../shared/api/growerAlphaV1.ts'
import type { PlantLifecycleProjectionV3 } from '../../shared/api/plantLifecycleV3.ts'
import type { GardenProjectionV1 } from '../../shared/api/gardenV1.ts'

/** Rebuild durable fields exclusively from the signed-in player's projections. */
export function restoreServerGameState(state: GameState, server: GrowerAlphaProjectionV1, serverPlants: PlantLifecycleProjectionV3, garden: GardenProjectionV1): GameState {
    const ownedPlants = serverPlants.ownedSpecimens.map((plant) => ({ id: plant.specimenId, ownerId: server.player.playerId, speciesId: plant.speciesId, cloneLineId: plant.cloneLineId, stage: 'mature' as const, plantedAt: plant.plantedAt, lastUpdatedAt: plant.collectedAt ?? plant.plantedAt, collectedAt: plant.collectedAt ?? plant.plantedAt, genetics: plant.genetics, geneticFeatures: plant.geneticFeatures, specialVariants: plant.specialVariants, isHarvestable: false, isListedForSale: server.marketplaceListings.some((listing) => listing.plantId === plant.specimenId && listing.status === 'active'), isHybrid: plant.isHybrid, parentPlantIds: plant.parentPlantIds ?? undefined, parentSpeciesIds: plant.parentSpeciesIds ?? undefined })) ?? []
    const bredSeeds = serverPlants.bredSeeds.map((seed) => ({ id: seed.seedId, speciesId: seed.speciesId, cloneLineId: seed.cloneLineId, createdAt: seed.createdAt, genetics: seed.genetics, parentPlantIds: seed.parentPlantIds, parentSpeciesIds: seed.parentSpeciesIds, isHybrid: seed.isHybrid, geneticFeatures: seed.geneticFeatures, specialVariants: seed.specialVariants, ...(server.seedTreatments[seed.seedId] ? { quantitativeTreatments: [server.seedTreatments[seed.seedId]] } : {}) })) ?? []
    const inventory = serverPlants.seedStacks.map(stack => ({ id: 'server-seed-' + stack.speciesId, itemType: 'seed' as const, itemKey: stack.speciesId, quantity: stack.quantity }))
    const nurserySlots = serverPlants.nursery.slots.slice(0, serverPlants.nursery.capacity).map(slot => ({ id: slot.slotId, plant: slot.occupancy ? {
      id: slot.occupancy.specimen.specimenId, ownerId: server.player.playerId,
      speciesId: slot.occupancy.specimen.speciesId, cloneLineId: slot.occupancy.specimen.cloneLineId,
      stage: 'seed' as const, plantedAt: slot.occupancy.plantedAt, lastUpdatedAt: slot.occupancy.plantedAt,
      genetics: slot.occupancy.specimen.genetics, geneticFeatures: slot.occupancy.specimen.geneticFeatures,
      specialVariants: slot.occupancy.specimen.specialVariants, isHybrid: slot.occupancy.specimen.isHybrid,
      isHarvestable: false, isListedForSale: false,
    } : null }))
    return { ...state, inventory, nurserySlots, player: { id: server.player.playerId, username: 'Grower', tokens: server.player.tokenBalance, skills: { cultivation: { xp: server.player.skills.cultivationXp }, breeding: { xp: server.player.skills.breedingXp }, genetics: { xp: server.player.skills.geneticsXp } } }, ownedPlants, bredSeeds, marketplaceListings: server.marketplaceListings, achievements: server.achievements, speciesDiscoveries: server.discoveries, journalStats: server.journalStats, geneticsResearch: server.research, geneticsLab: server.lab, property: server.property, gardenOrganization: garden.organization, gardenDisplayAssignments: garden.displayAssignments }
}
