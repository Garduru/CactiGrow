import type { GrowthStage } from './species'
import type { PlantGenetics } from './genetics'
import type { GeneticFeatureState, SpecialVariantState } from './geneticFeature'
import type { QuantitativeSeedTreatment } from './treatment'

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
  quantitativeTreatments?: QuantitativeSeedTreatment[]

  isHarvestable: boolean
  isListedForSale: boolean
}
