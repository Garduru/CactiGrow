import type { PlantPigmentationMaskAsset, PlantSilhouette, PlantStageAsset, VariegationPattern, VisualGrowthStage } from '../types/plantVisual'

const sanPedroBase = '/assets/plants/species/echinopsis-pachanoi/'

export const plantVisualAssets: Readonly<Record<string, { silhouette: PlantSilhouette; stages: Partial<Record<VisualGrowthStage, PlantStageAsset>> }>> = {
  'echinopsis-pachanoi': { silhouette: 'columnar', stages: {
    seedling: { key: 'plant-echinopsis-pachanoi-seedling-base-v01', path: `${sanPedroBase}plant-echinopsis-pachanoi-seedling-base-v01.webp` },
    juvenile: { key: 'plant-echinopsis-pachanoi-juvenile-base-v01', path: `${sanPedroBase}plant-echinopsis-pachanoi-juvenile-base-v01.webp` },
    developing: { key: 'plant-echinopsis-pachanoi-developing-base-v01', path: `${sanPedroBase}plant-echinopsis-pachanoi-developing-base-v01.webp` },
    mature: { key: 'plant-echinopsis-pachanoi-mature-base-v01', path: `${sanPedroBase}plant-echinopsis-pachanoi-mature-base-v01.webp` },
  } },
  'lophophora-williamsii': { silhouette: 'button', stages: {} },
}

export const registeredPlantStageAssets = Object.values(plantVisualAssets).flatMap(({ stages }) => Object.values(stages))

const variegationBase = `${sanPedroBase}variegation/`
export const plantPigmentationMasks: Readonly<Record<string, Partial<Record<VisualGrowthStage, Partial<Record<VariegationPattern, PlantPigmentationMaskAsset>>>>>> = {
  'echinopsis-pachanoi': {
    seedling: {
      'pattern-a': { featureId: 'variegation', pattern: 'pattern-a', bodyFamily: 'normal', version: 'v01', key: 'plant-echinopsis-pachanoi-seedling-variegation-pattern-a-mask-v01', path: `${variegationBase}plant-echinopsis-pachanoi-seedling-variegation-pattern-a-mask-v01.webp` },
    },
    juvenile: {
      'pattern-a': { featureId: 'variegation', pattern: 'pattern-a', bodyFamily: 'normal', version: 'v01', key: 'plant-echinopsis-pachanoi-juvenile-variegation-pattern-a-mask-v01', path: `${variegationBase}plant-echinopsis-pachanoi-juvenile-variegation-pattern-a-mask-v01.webp` },
    },
    developing: {
      'pattern-a': { featureId: 'variegation', pattern: 'pattern-a', bodyFamily: 'normal', version: 'v01', key: 'plant-echinopsis-pachanoi-developing-variegation-pattern-a-mask-v01', path: `${variegationBase}plant-echinopsis-pachanoi-developing-variegation-pattern-a-mask-v01.webp` },
    },
    mature: {
      'pattern-a': { featureId: 'variegation', pattern: 'pattern-a', bodyFamily: 'normal', version: 'v01', key: 'plant-echinopsis-pachanoi-mature-variegation-pattern-a-mask-v01', path: `${variegationBase}plant-echinopsis-pachanoi-mature-variegation-pattern-a-mask-v01.webp` },
      'pattern-b': { featureId: 'variegation', pattern: 'pattern-b', bodyFamily: 'normal', version: 'v01', key: 'plant-echinopsis-pachanoi-mature-variegation-pattern-b-mask-v01', path: `${variegationBase}plant-echinopsis-pachanoi-mature-variegation-pattern-b-mask-v01.webp` },
      'pattern-c': { featureId: 'variegation', pattern: 'pattern-c', bodyFamily: 'normal', version: 'v01', key: 'plant-echinopsis-pachanoi-mature-variegation-pattern-c-mask-v01', path: `${variegationBase}plant-echinopsis-pachanoi-mature-variegation-pattern-c-mask-v01.webp` },
    },
  },
}

export const registeredPlantPigmentationAssets = Object.values(plantPigmentationMasks).flatMap((stages) => Object.values(stages).flatMap((patterns) => Object.values(patterns ?? {})))
