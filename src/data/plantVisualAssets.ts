import type { PlantSilhouette, PlantStageAsset, VisualGrowthStage } from '../types/plantVisual'

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
