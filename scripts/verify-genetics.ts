import { geneticFeatureDefinitions } from '../src/data/geneticFeatures'
import { species } from '../src/data/species'
import { createBredSeed } from '../src/features/breeding/breedingModel'
import {
  getMutationTendencyMultiplier,
  getSpontaneousFeatureProbability,
  resolveSexualGeneticFeatures,
  resolveShiny,
  SHINY_PROBABILITY,
} from '../src/features/genetics/geneticFeatureResolver'
import { getExpressedGeneticFeatures } from '../src/features/genetics/geneticFeatureModel'
import { getShinyDiscoveryCount, recordShinyDiscovery } from '../src/features/journal/journalModel'
import { getNpcSaleValue } from '../src/features/marketplace/sellModel'
import { createNurseryPlantFromBredSeed, MOCK_GROWTH_DURATION_MS } from '../src/features/nursery/nurseryModel'
import { createInitialGameState, gameStateReducer } from '../src/game/gameState'
import type { GeneticFeatureState } from '../src/types/geneticFeature'
import type { Plant } from '../src/types/plant'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function randomSequence(values: number[], fallback = 1): () => number {
  let index = 0
  return () => values[index++] ?? fallback
}

function feature(featureId: string, expressed = true): GeneticFeatureState {
  return {
    featureId,
    genotype: { kind: 'presence', state: 'present' },
    expressed,
    expressionStrength: expressed ? 70 : 0,
    stability: 'variable',
    origin: 'founder',
  }
}

function plant(id: string, speciesId = 'echinopsis-pachanoi', features: GeneticFeatureState[] = [], shiny = false): Plant {
  return {
    id,
    ownerId: 'local-player',
    speciesId,
    cloneLineId: `clone-${id}`,
    stage: 'mature',
    plantedAt: '2026-01-01T00:00:00.000Z',
    lastUpdatedAt: '2026-01-02T00:00:00.000Z',
    genetics: { vigor: 50, growthSpeed: 50, size: 50, flowering: 50, mutationChance: 50 },
    geneticFeatures: features,
    specialVariants: shiny ? [{ variantId: 'shiny', origin: 'random', establishedAt: '2026-01-01T00:00:00.000Z' }] : [],
    isHarvestable: false,
    isListedForSale: false,
  }
}

const parentA = plant('parent-a')
const parentB = plant('parent-b')
const parentSnapshot = JSON.stringify([parentA, parentB])
const ordinarySeed = createBredSeed(parentA, parentB, Date.UTC(2026, 0, 3), () => 1, () => 'seed-1', () => 'clone-seed-1')
assert(ordinarySeed, 'No-feature parents should create an offspring')
assert(JSON.stringify([parentA, parentB]) === parentSnapshot, 'Breeding must not mutate parents')

const context = { offspringSpeciesId: parentA.speciesId, isHybrid: false, mutationTendency: 50, establishedAt: ordinarySeed.createdAt }
const denseResult = resolveSexualGeneticFeatures(plant('dense-a', parentA.speciesId, [feature('dense-spination')]), parentB, context, () => 0)
assert(denseResult.some((state) => state.featureId === 'dense-spination' && state.origin === 'inherited'), 'Dense Spination should use generic inheritance')

const carrier: GeneticFeatureState = {
  featureId: 'variegation',
  genotype: { kind: 'allelic', alleles: ['feature', 'standard'] },
  expressed: false,
  expressionStrength: 0,
  stability: 'variable',
  origin: 'inherited',
}
const carrierResult = resolveSexualGeneticFeatures(plant('carrier', parentA.speciesId, [carrier]), parentB, context, randomSequence([0]))
const inheritedCarrier = carrierResult.find((state) => state.featureId === 'variegation')
assert(inheritedCarrier?.genotype.kind === 'allelic' && !inheritedCarrier.expressed, 'Carrier genotype should persist without expression')
assert(!getExpressedGeneticFeatures(carrierResult).some((state) => state.featureId === 'variegation'), 'Hidden carriers must not enter visible feature output')

const crestResult = resolveSexualGeneticFeatures(
  plant('crest', parentA.speciesId, [feature('crested')]),
  parentB,
  context,
  randomSequence([1, 0, 0, 0.5]),
)
assert(crestResult.some((state) => state.featureId === 'crested' && state.origin === 'inherited'), 'Probabilistic mutation should transmit from an affected parent')
const crestDefinition = geneticFeatureDefinitions.find((entry) => entry.id === 'crested')!
assert(crestDefinition.gameplay.inheritanceChances!.bothParents > crestDefinition.gameplay.inheritanceChances!.oneParent, 'Two affected parents must have better configured odds')

const spontaneous = resolveSexualGeneticFeatures(parentA, parentB, context, randomSequence([0, 0, 0.5]))
assert(spontaneous.some((state) => state.featureId === 'variegation' && state.origin === 'spontaneous'), 'Deterministic input should trigger spontaneous mutation')
assert(getMutationTendencyMultiplier(100) < 4 && getMutationTendencyMultiplier(100) > getMutationTendencyMultiplier(0), 'Mutation Tendency must be bounded and meaningful')
assert(getSpontaneousFeatureProbability(crestDefinition, 100) < 0.01, 'Maximum tendency must not make rare mutation common')

const inheritedOnly = resolveSexualGeneticFeatures(plant('carrier-2', parentA.speciesId, [carrier]), parentB, context, randomSequence([0, 0, 0.5]))
assert(inheritedOnly.filter((state) => state.featureId === 'variegation').length === 1, 'Inherited feature must not duplicate through spontaneous resolution')

const stackedParent = plant('stacked', parentA.speciesId, [feature('monstrose'), feature('melted')])
const stacked = resolveSexualGeneticFeatures(stackedParent, stackedParent.id === parentB.id ? parentA : parentB, context, randomSequence([1, 1, 1, 0, 0, 0.5, 0, 0, 0.5]))
assert(stacked.some((state) => state.featureId === 'monstrose') && stacked.some((state) => state.featureId === 'melted'), 'Melted and Monstrose must coexist')

const shinyTime = '2026-01-03T00:00:00.000Z'
assert(resolveShiny(shinyTime, () => SHINY_PROBABILITY - Number.EPSILON).length === 1, 'Value below 1/4096 should be Shiny')
assert(resolveShiny(shinyTime, () => SHINY_PROBABILITY).length === 0, 'Exact upper boundary should not be Shiny')
assert(resolveShiny(shinyTime, () => 0)[0].variantId === 'shiny', 'Shiny roll should be deterministic')

let journalStats = { shinyCloneLineIds: [] as string[] }
const shinyVariant = resolveShiny(shinyTime, () => 0)
journalStats = recordShinyDiscovery(journalStats, 'shiny-line-1', shinyVariant)
journalStats = recordShinyDiscovery(journalStats, 'shiny-line-1', shinyVariant)
assert(getShinyDiscoveryCount(journalStats) === 1, 'Same Shiny clone line should count once')
journalStats = recordShinyDiscovery(journalStats, 'shiny-line-2', shinyVariant)
assert(getShinyDiscoveryCount(journalStats) === 2, 'Distinct Shiny clone line should increment discovery')

const shinySeed = { ...ordinarySeed, id: 'shiny-seed', cloneLineId: 'shiny-line-1', geneticFeatures: spontaneous, specialVariants: shinyVariant }
const nurseryPlant = createNurseryPlantFromBredSeed(shinySeed, 0)
assert(JSON.stringify(nurseryPlant.geneticFeatures) === JSON.stringify(shinySeed.geneticFeatures), 'Feature state must persist into Nursery')
assert(JSON.stringify(nurseryPlant.specialVariants) === JSON.stringify(shinySeed.specialVariants), 'Shiny state must persist into Nursery')

species.push({
  id: 'test-echinopsis',
  commonName: 'Verification cactus',
  scientificName: 'Echinopsis testii',
  genus: 'Echinopsis',
  rarity: 'common',
  growthTimeHours: 24,
  baseValue: 1,
  harvestValue: 1,
  imageKey: 'test-only',
})
const hybridParent = plant('hybrid-parent', 'test-echinopsis')
const hybridSeed = createBredSeed(parentA, hybridParent, Date.UTC(2026, 0, 3), () => 1, () => 'hybrid-seed', () => 'hybrid-line')
assert(hybridSeed?.isHybrid && hybridSeed.speciesId === parentA.speciesId, 'Same-genus hybrid should retain existing species resolution')
species.pop()

let state = createInitialGameState(Date.UTC(2026, 0, 3))
state = { ...state, ownedPlants: [{ ...parentA, collectedAt: shinyTime }, { ...parentB, collectedAt: shinyTime }] }
const breedingXpBefore = state.player.skills.breeding.xp
const afterBreed = gameStateReducer(state, { type: 'offspring/created', seed: ordinarySeed })
assert(afterBreed.bredSeeds.length === 1, 'One breeding action should create one seed')
assert(afterBreed.ownedPlants.length === 2 && JSON.stringify(afterBreed.ownedPlants) === JSON.stringify(state.ownedPlants), 'Reducer must preserve both parents')
assert(afterBreed.player.skills.breeding.xp - breedingXpBefore === 40, 'Successful breeding should award exactly 40 Breeding XP')
const afterDuplicate = gameStateReducer(afterBreed, { type: 'offspring/created', seed: ordinarySeed })
assert(afterDuplicate === afterBreed, 'Duplicate seed submission should not commit twice')
const secondSeed = createBredSeed(parentA, parentB, Date.UTC(2026, 0, 4), () => 1, () => 'seed-2', () => 'clone-seed-2')!
const afterRepeat = gameStateReducer(afterBreed, { type: 'offspring/created', seed: secondSeed })
assert(afterRepeat.bredSeeds.length === 2 && afterRepeat.ownedPlants.length === 2, 'Same parents should breed repeatedly and remain owned')

const afterShiny = gameStateReducer(state, { type: 'offspring/created', seed: shinySeed })
assert(getShinyDiscoveryCount(afterShiny.journalStats) === 1, 'Legitimate Shiny seed should record its clone line')
const plantedState = {
  ...afterShiny,
  nurserySlots: afterShiny.nurserySlots.map((slot, index) => index === 5 ? { ...slot, plant: nurseryPlant } : slot),
  bredSeeds: afterShiny.bredSeeds.filter((seed) => seed.id !== shinySeed.id),
}
const collectedState = gameStateReducer(plantedState, { type: 'plant/collected', slotId: plantedState.nurserySlots[5].id, now: MOCK_GROWTH_DURATION_MS + 1 })
const collectedShiny = collectedState.ownedPlants.find((entry) => entry.id === shinySeed.id)
assert(collectedShiny?.specialVariants.some((variant) => variant.variantId === 'shiny'), 'Shiny must persist through collection')
assert(JSON.stringify(collectedShiny.geneticFeatures) === JSON.stringify(shinySeed.geneticFeatures), 'Resolved expression must persist through collection')
assert(getShinyDiscoveryCount(collectedState.journalStats) === 1, 'Lifecycle movement must not increment Shiny history')
const saleValue = getNpcSaleValue(collectedShiny)
assert(saleValue !== null, 'Collected Shiny should be eligible for the existing NPC sale check')
const soldState = gameStateReducer(collectedState, { type: 'plant/sold-to-npc', plantId: collectedShiny.id, expectedValue: saleValue, now: MOCK_GROWTH_DURATION_MS + 2 })
assert(getShinyDiscoveryCount(soldState.journalStats) === 1, 'Selling must not erase Shiny discovery history')

const invalid = { ...ordinarySeed, id: 'invalid', parentPlantIds: [parentA.id, parentA.id] as [string, string] }
const afterInvalid = gameStateReducer(state, { type: 'offspring/created', seed: invalid })
assert(afterInvalid === state && afterInvalid.player.skills.breeding.xp === breedingXpBefore, 'Invalid breeding must not create offspring or XP')

assert(!ordinarySeed.specialVariants.length, 'Non-Shiny outcome must remain stored as non-Shiny')
const shinyParentA = plant('shiny-a', parentA.speciesId, [], true)
const shinyParentB = plant('shiny-b', parentB.speciesId, [], true)
const shinyFromNormalParents = createBredSeed(parentA, parentB, Date.UTC(2026, 0, 5), () => 0, () => 'normal-parent-seed', () => 'normal-parent-line')!
const shinyFromShinyParents = createBredSeed(shinyParentA, shinyParentB, Date.UTC(2026, 0, 5), () => 0, () => 'shiny-parent-seed', () => 'shiny-parent-line')!
assert(shinyFromNormalParents.specialVariants.length === 1 && shinyFromShinyParents.specialVariants.length === 1, 'One or two Shiny parents must not alter the independent roll')

console.log('Genetics verification passed')
