import { getSpeciesById } from '../../data/species'
import { getGeneticFeatureDefinition } from '../../data/geneticFeatures'
import { plantPigmentationMasks, plantVisualAssets } from '../../data/plantVisualAssets'
import { getExpressedGeneticFeatures } from '../genetics/geneticFeatureModel'
import type { Plant } from '../../types/plant'
import type { PlantVisualDescriptor, VariegationPattern, VisualGrowthStage } from '../../types/plantVisual'

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

export function createPlantVisualDescriptor(plant: Plant, visualStage: VisualGrowthStage = 'mature', options?: { variegationPattern?: VariegationPattern }): PlantVisualDescriptor {
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
  // An unsupported optional layer must not discard an approved species/stage body.
  const requestedVariegation = pigmentationRecipeKeys.includes('variegated')
  const maskAsset = requestedVariegation && options?.variegationPattern
    ? plantPigmentationMasks[speciesVisualKey]?.[visualStage]?.[options.variegationPattern] ?? null
    : null
  const pigmentation = requestedVariegation && options?.variegationPattern
    ? { featureId: 'variegation' as const, pattern: options.variegationPattern, maskAsset, treatmentVersion: 'yellow-green-v02' as const }
    : null
  const missingVisualLayers = [...morphologyRecipeKeys, ...(requestedVariegation && !maskAsset ? [`variegation:${options?.variegationPattern ?? 'pattern-unassigned'}`] : []), ...(spineRecipeKey ? [spineRecipeKey] : []), ...(specialTreatmentKey ? [specialTreatmentKey] : [])]
  const baseAsset = registeredAsset
  return {
    specimenId: plant.id,
    speciesVisualKey,
    visualStage,
    baseRecipeKey,
    baseAsset,
    supportState: !baseAsset ? 'fallback' : missingVisualLayers.length ? 'partial' : 'full',
    missingVisualLayers,
    pigmentation,
    silhouette: plantVisualAssets[speciesVisualKey]?.silhouette ?? 'generic',
    variation,
    morphologyRecipeKeys,
    pigmentationRecipeKeys,
    spineRecipeKey,
    specialTreatmentKey,
    visualRevision: [baseRecipeKey, ...Object.values(variation), ...tags, pigmentation?.pattern ?? 'no-pattern', pigmentation?.maskAsset?.version ?? 'no-mask', specialTreatmentKey ?? 'normal'].join(':'),
  }
}
