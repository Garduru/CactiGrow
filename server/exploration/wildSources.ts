import type { PlantGeneticsV1 } from '../../shared/api/plantLifecycleV1.ts'
import type { WildFindOutcome, WildFindRarity } from '../../shared/api/wildGeneticsV1.ts'
import type { GeneticFeatureState } from '../../src/types/geneticFeature.ts'
import type { Plant } from '../../src/types/plant.ts'
import { inheritGenetics } from '../../src/features/breeding/breedingModel.ts'
import { resolveSexualGeneticOutcome } from '../../src/features/genetics/geneticFeatureResolver.ts'
import { findArea } from '../../shared/world/world.ts'

export const WILD_FIND_TUNING = { version: 1, uncommonChance: 0.08, rareChance: 0.01, seedsPerLot: 3 } as const
// No Harvesting bonus in V1: preserve the accepted skill/quantity economy.
export interface WildSource {
  nodeId: string; areaId: string; speciesId: string; populationId: string; region: string; landmarkId: string | null; special: boolean; tendency: number
}
const source = (nodeId: string, areaId: string, region: string, landmarkId: string | null, tendency: number, special = false): WildSource => {
  const node = findArea(areaId)?.interactables?.find(n => n.entityId === nodeId && !n.tutorial && n.kind === 'harvestable')
  if (!node?.speciesId) throw new Error('Wild genetic source is missing its authored node.')
  return { nodeId, areaId, speciesId: node.speciesId, region, landmarkId, special, tendency, populationId: `${nodeId}-population` }
}
// Existing authored node IDs are deployment-stable; no client-generated source identity.
export const WILD_SOURCES: readonly WildSource[] = [
  source('cross-wild-san-pedro', 'cross-path-1', 'Cross Path', null, 0),
  source('path-2-wild-san-pedro', 'path-2', 'Town Trail', null, 1),
  source('path-2-wild-peyote', 'path-2', 'Town Trail', null, -1),
  source('path-3-wild-san-pedro', 'path-3', 'Cave Trail', null, -2),
  source('path-3-wild-peyote', 'path-3', 'Cave Trail', null, 2),
  source('path-4-wild-san-pedro', 'path-4', 'Basin Approach', null, 2),
  source('path-4-wild-peyote', 'path-4', 'Basin Approach', null, -2),
  source('basin-san-pedro-entrance', 'the-first-basin', 'Entrance Grove', 'entrance-grove', 1),
  source('basin-peyote-west', 'the-first-basin', 'Western Basin', null, -1),
  source('basin-san-pedro-wash', 'the-first-basin', 'Dry Wash', 'dry-wash', -2),
  source('basin-peyote-south', 'the-first-basin', 'Southern Basin', null, 2),
  source('basin-san-pedro-cairn', 'the-first-basin', 'Old Cairn Stand', 'cairn', -3, true),
  source('basin-peyote-ridge', 'the-first-basin', 'Isolated Eastern Ridge', 'eastern-ridge', 3, true),
]
export function resolveWildFind(random: () => number): WildFindOutcome {
  const roll = random()
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1) throw new Error('Invalid wild random value.')
  return roll < WILD_FIND_TUNING.rareChance ? 'rare' : roll < WILD_FIND_TUNING.rareChance + WILD_FIND_TUNING.uncommonChance ? 'uncommon' : 'normal'
}
export function wildSourceParents(source: WildSource, rarity: WildFindRarity): [Plant, Plant] {
  const t = source.tendency, spread = rarity === 'rare' ? 12 : 5
  const profile = (offset: number): PlantGeneticsV1 => ({ vigor: 50 + t + offset, growthSpeed: 50 - t - offset, size: 50 + offset, flowering: 50 - offset, mutationChance: 1 })
  // Rare is a different balanced combination, not a multiplier or guaranteed mutation.
  const carrier: GeneticFeatureState = { featureId: 'variegation', genotype: { kind: 'allelic', alleles: ['feature', 'standard'] }, expressed: false, expressionStrength: 0, stability: 'variable', origin: 'founder' }
  const parent = (i: number): Plant => ({ id: `${source.populationId}-source-${i}`, ownerId: 'wild', cloneLineId: `${source.populationId}-genetic-${i}`, speciesId: source.speciesId,
    stage: 'mature', plantedAt: '2026-10-08T00:00:00.000Z', lastUpdatedAt: '2026-10-08T00:00:00.000Z',
    genetics: profile(i ? -Math.round(spread / 2) : spread), geneticFeatures: rarity === 'rare' ? [carrier] : [], specialVariants: [], isHarvestable: false, isListedForSale: false })
  return [parent(0), parent(1)]
}
export function resolveWildSeed(source: WildSource, rarity: WildFindRarity, now: Date, random: () => number) {
  const parents = wildSourceParents(source, rarity)
  const genetics = inheritGenetics(parents[0], parents[1], random)
  const outcome = resolveSexualGeneticOutcome(parents[0], parents[1], { offspringSpeciesId: source.speciesId, isHybrid: false, mutationTendency: genetics.mutationChance, establishedAt: now.toISOString() }, random)
  return { genetics, ...outcome, sourceGenetics: { parents: parents.map(p => p.genetics) as [PlantGeneticsV1, PlantGeneticsV1], features: parents.map(p => p.geneticFeatures) as [GeneticFeatureState[], GeneticFeatureState[]] } }
}
