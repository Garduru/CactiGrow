import type { GrowthStage } from './species'
import type { PlantGenetics } from './genetics'
import type { GeneticFeatureState, SpecialVariantState } from './geneticFeature'

export interface Plant {
  id: string
  ownerId: string
  speciesId: string
  cloneLineId: string

  nickname?: string

  stage: GrowthStage
  plantedAt: string
  lastUpdatedAt: string

  genetics: PlantGenetics
  geneticFeatures: GeneticFeatureState[]
  specialVariants: SpecialVariantState[]

  parentPlantIds?: [string, string]
  parentSpeciesIds?: [string, string]
  isHybrid?: boolean

  isHarvestable: boolean
  isListedForSale: boolean
}
