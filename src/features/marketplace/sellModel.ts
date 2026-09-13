import { getSpeciesById } from '../../data/species'
import type { GameState } from '../../game/gameState'
import type { CollectedPlant } from '../../game/gameState'
import { getListingForPlant } from './marketplaceModel'

const geneticKeys = ['vigor', 'growthSpeed', 'size', 'flowering', 'mutationChance'] as const

export function getNpcSaleValue(plant: CollectedPlant): number | null {
  const species = getSpeciesById(plant.speciesId)
  if (!species) return null

  const averageGenetics = geneticKeys.reduce((total, key) => total + plant.genetics[key], 0) / geneticKeys.length
  const qualityMultiplier = 0.85 + (averageGenetics / 100) * 0.3
  return Math.max(1, Math.round(species.harvestValue * qualityMultiplier))
}

export function canSellPlantToNpc(state: GameState, plantId: string): boolean {
  const plant = state.ownedPlants.find((specimen) => specimen.id === plantId)
  return Boolean(
    plant
    && !plant.isListedForSale
    && !getListingForPlant(state.marketplaceListings, plantId)
    && getNpcSaleValue(plant) !== null,
  )
}
