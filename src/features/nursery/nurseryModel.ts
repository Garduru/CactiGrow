import type { GrowthStage } from '../../types/species'

export interface NurserySeedStack {
  speciesId: string
  quantity: number
}

export interface NurseryPlant {
  id: string
  speciesId: string
  plantedAt: string
}

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
  return {
    id: crypto.randomUUID(),
    speciesId,
    plantedAt: new Date(now).toISOString(),
  }
}

export function createInitialNurserySlots(now: number): NurserySlotState[] {
  return [
    {
      id: 'slot-1',
      plant: {
        id: 'demo-seedling',
        speciesId: 'echinopsis-pachanoi',
        plantedAt: new Date(now - MOCK_GROWTH_DURATION_MS * 0.32).toISOString(),
      },
    },
    {
      id: 'slot-2',
      plant: {
        id: 'demo-juvenile',
        speciesId: 'lophophora-williamsii',
        plantedAt: new Date(now - MOCK_GROWTH_DURATION_MS * 0.67).toISOString(),
      },
    },
    {
      id: 'slot-3',
      plant: {
        id: 'demo-mature',
        speciesId: 'echinopsis-pachanoi',
        plantedAt: new Date(now - MOCK_GROWTH_DURATION_MS * 1.1).toISOString(),
      },
    },
    ...Array.from({ length: 3 }, (_, index) => ({
      id: `slot-${index + 4}`,
      plant: null,
    })),
  ]
}
