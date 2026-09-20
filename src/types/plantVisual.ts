export type VisualGrowthStage = 'seedling' | 'juvenile' | 'developing' | 'mature'
export type PlantSilhouette = 'columnar' | 'button' | 'generic'
export type PlantVisualSupport = 'full' | 'partial' | 'fallback'

export interface PlantStageAsset {
  key: string
  path: string
}

export type VariegationPattern = 'pattern-a' | 'pattern-b' | 'pattern-c'
export interface PlantPigmentationMaskAsset extends PlantStageAsset {
  featureId: 'variegation'
  pattern: VariegationPattern
  bodyFamily: 'normal'
  version: 'v01'
}

export interface ResolvedPlantPigmentation {
  featureId: 'variegation'
  pattern: VariegationPattern
  maskAsset: PlantPigmentationMaskAsset | null
  treatmentVersion: 'yellow-green-v02'
}

// Plant appearance only. Soil, pots, benches, shadows, and scene decoration are context-owned.
export interface PlantVisualDescriptor {
  specimenId: string
  speciesVisualKey: string
  visualStage: VisualGrowthStage
  baseRecipeKey: string
  baseAsset: PlantStageAsset | null
  supportState: PlantVisualSupport
  missingVisualLayers: string[]
  pigmentation: ResolvedPlantPigmentation | null
  silhouette: PlantSilhouette
  variation: { paletteIndex: number; formIndex: number; orientationIndex: number; scaleBucket: number }
  morphologyRecipeKeys: string[]
  pigmentationRecipeKeys: string[]
  spineRecipeKey: string | null
  specialTreatmentKey: string | null
  visualRevision: string
}
