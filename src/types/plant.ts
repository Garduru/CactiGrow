import type { GrowthStage } from './species'
import type { PlantGenetics } from './genetics'

export interface Plant {
  id: string
  ownerId: string
  speciesId: string

  nickname?: string

  stage: GrowthStage
  plantedAt: string
  lastUpdatedAt: string

  genetics: PlantGenetics

  parentPlantIds?: [string, string]
  parentSpeciesIds?: [string, string]
  isHybrid?: boolean

  isHarvestable: boolean
  isListedForSale: boolean
}
