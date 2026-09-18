import { getSpeciesById } from '../../data/species'
import { getGeneticFeatureDefinition } from '../../data/geneticFeatures'
import { plantVisualAssets } from '../../data/plantVisualAssets'
import { getExpressedGeneticFeatures } from '../genetics/geneticFeatureModel'
import type { Plant } from '../../types/plant'
import type { PlantVisualDescriptor, VisualGrowthStage } from '../../types/plantVisual'

function stableHash(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function visualStageFromProgress(progress: number, isMature: boolean): VisualGrowthStage {
  if (isMature) return 'mature'
  if (progress >= .65) return 'developing'
  if (progress >= .40) return 'juvenile'
  return 'seedling'
}

export function createPlantVisualDescriptor(plant: Plant, visualStage: VisualGrowthStage = 'mature'): PlantVisualDescriptor {
  const speciesVisualKey = getSpeciesById(plant.speciesId)?.imageKey ?? plant.speciesId
  const features = getExpressedGeneticFeatures(plant.geneticFeatures)
  const tags = features.flatMap((feature) => getGeneticFeatureDefinition(feature.featureId)?.artTags ?? [])
  const morphologyRecipeKeys = tags.filter((tag) => ['crested', 'monstrose', 'melted', 'spiral', 'dichotomous'].includes(tag))
  const pigmentationRecipeKeys = tags.filter((tag) => tag === 'variegated')
  const spineRecipeKey = tags.includes('dense-spines') ? 'dense-spines' : null
  const specialTreatmentKey = plant.specialVariants.some((variant) => variant.variantId === 'shiny') ? 'shiny' : null
  const geneticHash = stableHash(`plant-v1:clone:${plant.cloneLineId}`)
  const physicalHash = stableHash(`plant-v1:specimen:${plant.id}`)
  const variation = {
    paletteIndex: geneticHash % 3,
    formIndex: (geneticHash >>> 8) % 3,
    orientationIndex: physicalHash % 3,
    scaleBucket: (geneticHash >>> 16) % 3,
  }
  const baseRecipeKey = `${speciesVisualKey}:${visualStage}`
  const registeredAsset = plantVisualAssets[speciesVisualKey]?.stages[visualStage] ?? null
  const normalAppearance = features.length === 0 && specialTreatmentKey === null
  const baseAsset = normalAppearance ? registeredAsset : null
  return {
    specimenId: plant.id,
    speciesVisualKey,
    visualStage,
    baseRecipeKey,
    baseAsset,
    supportState: baseAsset ? 'full' : registeredAsset ? 'partial' : 'fallback',
    silhouette: plantVisualAssets[speciesVisualKey]?.silhouette ?? 'generic',
    variation,
    morphologyRecipeKeys,
    pigmentationRecipeKeys,
    spineRecipeKey,
    specialTreatmentKey,
    visualRevision: [baseRecipeKey, ...Object.values(variation), ...tags, specialTreatmentKey ?? 'normal'].join(':'),
  }
}
