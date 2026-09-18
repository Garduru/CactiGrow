export type VisualGrowthStage = 'seedling' | 'juvenile' | 'developing' | 'mature'
export type PlantSilhouette = 'columnar' | 'button' | 'generic'
export type PlantVisualSupport = 'full' | 'partial' | 'fallback'

export interface PlantStageAsset {
  key: string
  path: string
}

// Plant appearance only. Soil, pots, benches, shadows, and scene decoration are context-owned.
export interface PlantVisualDescriptor {
  specimenId: string
  speciesVisualKey: string
  visualStage: VisualGrowthStage
  baseRecipeKey: string
  baseAsset: PlantStageAsset | null
  supportState: PlantVisualSupport
  silhouette: PlantSilhouette
  variation: { paletteIndex: number; formIndex: number; orientationIndex: number; scaleBucket: number }
  morphologyRecipeKeys: string[]
  pigmentationRecipeKeys: string[]
  spineRecipeKey: string | null
  specialTreatmentKey: string | null
  visualRevision: string
}
