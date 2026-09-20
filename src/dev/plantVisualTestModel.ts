import { getGeneticFeatureDefinition } from '../data/geneticFeatures'
import type { CollectedPlant } from '../game/gameState'
import { MOCK_GROWTH_DURATION_MS } from '../features/nursery/nurseryModel'
import { hasValidGeneticFeatureStates } from '../features/genetics/geneticFeatureModel'
import type { GeneticFeatureState } from '../types/geneticFeature'
import type { NurseryPresentationStage } from '../features/nursery/nurseryPresentation'
import type { VariegationPattern } from '../types/plantVisual'

export interface PlantVisualTestConfig {
  speciesId: string
  stage: NurseryPresentationStage
  variegated: boolean
  pattern: VariegationPattern
  featureIds: string[]
  shiny: boolean
}

export const defaultPlantVisualTestConfig: PlantVisualTestConfig = {
  speciesId: 'echinopsis-pachanoi', stage: 'developing', variegated: false,
  pattern: 'pattern-a', featureIds: [], shiny: false,
}

const stageProgress: Record<NurseryPresentationStage, number> = {
  germinating: .08, seedling: .25, juvenile: .5, developing: .8, mature: 1,
}

export function createPlantVisualTestSpecimen(config: PlantVisualTestConfig, now: number): CollectedPlant {
  const featureIds = [...new Set([...config.featureIds, ...(config.variegated ? ['variegation'] : [])])].sort()
  const geneticFeatures: GeneticFeatureState[] = featureIds.map((featureId) => {
    const definition = getGeneticFeatureDefinition(featureId)
    if (!definition) throw new Error(`Unknown visual test feature: ${featureId}`)
    return {
      featureId, genotype: { kind: 'presence', state: 'present' }, expressed: true,
      expressionStrength: Math.max(1, definition.gameplay.expressionStrength[0]),
      stability: definition.defaultStability, origin: 'founder',
    }
  })
  if (!hasValidGeneticFeatureStates(geneticFeatures)) throw new Error('Incompatible visual test features')
  const identity = [config.speciesId, config.stage, config.variegated ? `variegated-${config.pattern}` : 'normal', ...featureIds, config.shiny ? 'shiny' : 'standard'].join('-')
  const plantedAt = new Date(now - MOCK_GROWTH_DURATION_MS * stageProgress[config.stage]).toISOString()
  const timestamp = new Date(now).toISOString()
  return {
    id: `dev-test-plant-${identity}`, ownerId: 'dev-visual-test', speciesId: config.speciesId,
    cloneLineId: `dev-test-clone-${identity}`, stage: config.stage === 'mature' ? 'mature' : config.stage === 'germinating' ? 'seed' : config.stage === 'developing' ? 'juvenile' : config.stage,
    plantedAt, lastUpdatedAt: timestamp, collectedAt: timestamp,
    genetics: { vigor: 50, growthSpeed: 50, size: 50, flowering: 50, mutationChance: 1 },
    geneticFeatures, specialVariants: config.shiny ? [{ variantId: 'shiny', origin: 'unknown', establishedAt: timestamp }] : [],
    isHarvestable: config.stage === 'mature', isListedForSale: false,
  }
}
