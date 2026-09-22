import { isCommoditySeedStackV1, isNurserySlotIdV1, isPlantSpecimenV1, type CommoditySeedStackV1, type NurserySlotIdV1, type PlantGeneticsV1, type PlantSpecimenV1 } from './plantLifecycleV1.ts'
import type { GeneticFeatureState } from '../../src/types/geneticFeature.ts'

export interface PlantSpecimenV2 extends Omit<PlantSpecimenV1, 'geneticFeatures'> {
  geneticFeatures: GeneticFeatureState[]
  parentPlantIds: [string, string] | null
  parentSpeciesIds: [string, string] | null
  isHybrid: boolean
  sourceBredSeedId: string | null
}
export interface BredSeedV2 {
  seedId: string
  cloneLineId: string
  speciesId: string
  parentPlantIds: [string, string]
  parentSpeciesIds: [string, string]
  isHybrid: boolean
  createdAt: string
  genetics: PlantGeneticsV1
  geneticFeatures: GeneticFeatureState[]
  specialVariants: PlantSpecimenV1['specialVariants']
}
export type NurserySlotV2 = { slotId: NurserySlotIdV1; occupancy: null } | {
  slotId: NurserySlotIdV1
  occupancy: { specimen: PlantSpecimenV2; plantedAt: string; readyAt: string; growthRuleVersion: number; version: number }
}
export interface PlantLifecycleProjectionV2 {
  projectionVersion: 2
  lifecycleVersion: string
  generatedAt: string
  seedStacks: CommoditySeedStackV1[]
  bredSeeds: BredSeedV2[]
  nursery: { slots: NurserySlotV2[] }
  ownedSpecimens: PlantSpecimenV2[]
}
export interface BreedSpecimensCommandV2 { parent1SpecimenId: string; parent2SpecimenId: string; expectedParent1Version: number; expectedParent2Version: number }
export interface PlantBredSeedCommandV2 { slotId: NurserySlotIdV1; seedId: string }
export interface BreedSpecimensResultV2 { commandId: string; lifecycleVersion: string; seed: BredSeedV2 }
export interface PlantBredSeedResultV2 { commandId: string; lifecycleVersion: string; seedId: string; slot: NurserySlotV2 }

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const keys = (value: Record<string, unknown>, expected: string[]) => Object.keys(value).length === expected.length && expected.every((key) => key in value)
const date = (value: unknown): value is string => typeof value === 'string' && !Number.isNaN(Date.parse(value))
const pair = (value: unknown): value is [string, string] => Array.isArray(value) && value.length === 2 && value.every((id) => typeof id === 'string')
const feature = (value: unknown): value is GeneticFeatureState => object(value) && typeof value.featureId === 'string' && object(value.genotype) && typeof value.expressed === 'boolean' && Number.isInteger(value.expressionStrength) && typeof value.stability === 'string' && typeof value.origin === 'string'
const features = (value: unknown): value is GeneticFeatureState[] => Array.isArray(value) && value.every(feature)
const specimenBaseKeys = ['specimenId','cloneLineId','speciesId','lifecycleStatus','plantedAt','collectedAt','genetics','geneticFeatures','specialVariants','geneticRepresentationVersion','visualDerivationVersion','version']
export function isPlantSpecimenV2(value: unknown): value is PlantSpecimenV2 {
  if (!object(value) || !keys(value, [...specimenBaseKeys,'parentPlantIds','parentSpeciesIds','isHybrid','sourceBredSeedId']) || !features(value.geneticFeatures)) return false
  const base = Object.fromEntries(specimenBaseKeys.map((key) => [key, key === 'geneticFeatures' ? [] : value[key]]))
  return isPlantSpecimenV1(base) && (value.parentPlantIds === null || pair(value.parentPlantIds)) && (value.parentSpeciesIds === null || pair(value.parentSpeciesIds)) && typeof value.isHybrid === 'boolean' && (value.sourceBredSeedId === null || (typeof value.sourceBredSeedId === 'string' && uuid.test(value.sourceBredSeedId)))
}
export function isBredSeedV2(value: unknown): value is BredSeedV2 {
  if (!object(value) || !keys(value, ['seedId','cloneLineId','speciesId','parentPlantIds','parentSpeciesIds','isHybrid','createdAt','genetics','geneticFeatures','specialVariants'])) return false
  const specimen = { specimenId: value.seedId, cloneLineId: value.cloneLineId, speciesId: value.speciesId, lifecycleStatus: 'growing', plantedAt: value.createdAt, collectedAt: null, genetics: value.genetics, geneticFeatures: [], specialVariants: value.specialVariants, geneticRepresentationVersion: 1, visualDerivationVersion: 1, version: 1 }
  return isPlantSpecimenV1(specimen) && pair(value.parentPlantIds) && pair(value.parentSpeciesIds) && typeof value.isHybrid === 'boolean' && features(value.geneticFeatures) && date(value.createdAt)
}
export function isNurserySlotV2(value: unknown): value is NurserySlotV2 {
  if (!object(value) || !keys(value, ['slotId','occupancy']) || !isNurserySlotIdV1(value.slotId)) return false
  if (value.occupancy === null) return true
  if (!object(value.occupancy) || !keys(value.occupancy, ['specimen','plantedAt','readyAt','growthRuleVersion','version']) || !isPlantSpecimenV2(value.occupancy.specimen)) return false
  return date(value.occupancy.plantedAt) && date(value.occupancy.readyAt) && Number.isInteger(value.occupancy.growthRuleVersion) && Number(value.occupancy.growthRuleVersion) >= 1 && Number.isInteger(value.occupancy.version) && Number(value.occupancy.version) >= 1
}
export function isPlantLifecycleProjectionV2(value: unknown): value is PlantLifecycleProjectionV2 {
  return object(value) && keys(value, ['projectionVersion','lifecycleVersion','generatedAt','seedStacks','bredSeeds','nursery','ownedSpecimens']) && value.projectionVersion === 2 && typeof value.lifecycleVersion === 'string' && date(value.generatedAt) && Array.isArray(value.seedStacks) && value.seedStacks.every(isCommoditySeedStackV1) && Array.isArray(value.bredSeeds) && value.bredSeeds.every(isBredSeedV2) && object(value.nursery) && keys(value.nursery, ['slots']) && Array.isArray(value.nursery.slots) && value.nursery.slots.length === 6 && value.nursery.slots.every(isNurserySlotV2) && new Set(value.nursery.slots.map((slot) => slot.slotId)).size === 6 && Array.isArray(value.ownedSpecimens) && value.ownedSpecimens.every(isPlantSpecimenV2)
}
export function isBreedSpecimensCommandV2(value: unknown): value is BreedSpecimensCommandV2 { return object(value) && keys(value, ['parent1SpecimenId','parent2SpecimenId','expectedParent1Version','expectedParent2Version']) && typeof value.parent1SpecimenId === 'string' && uuid.test(value.parent1SpecimenId) && typeof value.parent2SpecimenId === 'string' && uuid.test(value.parent2SpecimenId) && Number.isInteger(value.expectedParent1Version) && Number(value.expectedParent1Version) >= 1 && Number.isInteger(value.expectedParent2Version) && Number(value.expectedParent2Version) >= 1 }
export function isPlantBredSeedCommandV2(value: unknown): value is PlantBredSeedCommandV2 { return object(value) && keys(value, ['slotId','seedId']) && isNurserySlotIdV1(value.slotId) && typeof value.seedId === 'string' && uuid.test(value.seedId) }
export function isBreedSpecimensResultV2(value: unknown): value is BreedSpecimensResultV2 { return object(value) && keys(value, ['commandId','lifecycleVersion','seed']) && typeof value.commandId === 'string' && uuid.test(value.commandId) && typeof value.lifecycleVersion === 'string' && isBredSeedV2(value.seed) }
export function isPlantBredSeedResultV2(value: unknown): value is PlantBredSeedResultV2 { return object(value) && keys(value, ['commandId','lifecycleVersion','seedId','slot']) && typeof value.commandId === 'string' && uuid.test(value.commandId) && typeof value.lifecycleVersion === 'string' && typeof value.seedId === 'string' && uuid.test(value.seedId) && isNurserySlotV2(value.slot) }
