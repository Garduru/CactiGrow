import type { PlantGenetics } from './genetics'
import type { GeneticFeatureState, SpecialVariantState } from './geneticFeature'

export interface BredSeed {
  id: string
  speciesId: string
  cloneLineId: string
  createdAt: string
  genetics: PlantGenetics
  parentPlantIds: [string, string]
  parentSpeciesIds: [string, string]
  isHybrid: boolean
  geneticFeatures: GeneticFeatureState[]
  specialVariants: SpecialVariantState[]
}
