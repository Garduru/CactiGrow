import type { GrowthStage } from '../../types/species'
import type { Plant } from '../../types/plant'
import type { BredSeed } from '../../types/bredSeed'

export type NurseryPlant = Plant

export interface NurserySlotState {
  id: string
  plant: NurseryPlant | null
}

export interface NurseryGrowth {
  stage: GrowthStage
  progress: number
  isMature: boolean
}

// Development timing only. The server will eventually provide authoritative time.
export const MOCK_GROWTH_DURATION_MS = 2 * 60 * 1000

const growthStages: readonly GrowthStage[] = [
  'seed',
  'seedling',
  'juvenile',
  'mature',
]

export function calculateNurseryGrowth(
  plantedAt: string,
  now: number,
): NurseryGrowth {
  const elapsed = Math.max(0, now - Date.parse(plantedAt))
  const progress = Math.min(elapsed / MOCK_GROWTH_DURATION_MS, 1)
  const stageIndex = Math.min(
    Math.floor(progress * growthStages.length),
    growthStages.length - 1,
  )

  return {
    stage: growthStages[stageIndex],
    progress,
    isMature: progress >= 1,
  }
}

export function createNurseryPlant(speciesId: string, now: number): NurseryPlant {
  const timestamp = new Date(now).toISOString()

  return {
    id: crypto.randomUUID(),
    ownerId: 'local-player',
    speciesId,
    stage: 'seed',
    plantedAt: timestamp,
    lastUpdatedAt: timestamp,
    genetics: {
      vigor: 50,
      growthSpeed: 50,
      size: 50,
      flowering: 50,
      mutationChance: 1,
    },
    isHarvestable: false,
    isListedForSale: false,
  }
}

export function createNurseryPlantFromBredSeed(seed: BredSeed, now: number): NurseryPlant {
  const timestamp = new Date(now).toISOString()
  return {
    id: seed.id,
    ownerId: 'local-player',
    speciesId: seed.speciesId,
    stage: 'seed',
    plantedAt: timestamp,
    lastUpdatedAt: timestamp,
    genetics: seed.genetics,
    parentPlantIds: seed.parentPlantIds,
    parentSpeciesIds: seed.parentSpeciesIds,
    isHybrid: seed.isHybrid,
    isHarvestable: false,
    isListedForSale: false,
  }
}

export function createInitialNurserySlots(now: number): NurserySlotState[] {
  return [
    {
      id: 'slot-1',
      plant: {
        id: 'demo-seedling',
        ownerId: 'local-player',
        speciesId: 'echinopsis-pachanoi',
        stage: 'seedling',
        plantedAt: new Date(now - MOCK_GROWTH_DURATION_MS * 0.32).toISOString(),
        lastUpdatedAt: new Date(now).toISOString(),
        genetics: { vigor: 55, growthSpeed: 52, size: 48, flowering: 50, mutationChance: 1 },
        isHarvestable: false,
        isListedForSale: false,
      },
    },
    {
      id: 'slot-2',
      plant: {
        id: 'demo-juvenile',
        ownerId: 'local-player',
        speciesId: 'lophophora-williamsii',
        stage: 'juvenile',
        plantedAt: new Date(now - MOCK_GROWTH_DURATION_MS * 0.67).toISOString(),
        lastUpdatedAt: new Date(now).toISOString(),
        genetics: { vigor: 48, growthSpeed: 46, size: 53, flowering: 57, mutationChance: 2 },
        isHarvestable: false,
        isListedForSale: false,
      },
    },
    {
      id: 'slot-3',
      plant: {
        id: 'demo-mature',
        ownerId: 'local-player',
        speciesId: 'echinopsis-pachanoi',
        stage: 'mature',
        plantedAt: new Date(now - MOCK_GROWTH_DURATION_MS * 1.1).toISOString(),
        lastUpdatedAt: new Date(now).toISOString(),
        genetics: { vigor: 58, growthSpeed: 51, size: 61, flowering: 49, mutationChance: 1 },
        isHarvestable: true,
        isListedForSale: false,
      },
    },
    ...Array.from({ length: 3 }, (_, index) => ({
      id: `slot-${index + 4}`,
      plant: null,
    })),
  ]
}
