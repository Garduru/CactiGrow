import { geneticFeatureDefinitions } from '../../data/geneticFeatures.ts'
import { getSpeciesById } from '../../data/species.ts'
import type { GeneticFeatureDefinition, GeneticFeatureState, GenotypeState, SpecialVariantState } from '../../types/geneticFeature'
import type { Plant } from '../../types/plant'

export type RandomSource = () => number

export interface GeneticResolutionContext {
  offspringSpeciesId: string
  isHybrid: boolean
  mutationTendency: number
  establishedAt: string
}

export interface GeneticFeatureResolution {
  geneticFeatures: GeneticFeatureState[]
  specialVariants: SpecialVariantState[]
}

export const SHINY_PROBABILITY = 1 / 4096
const MAX_SPONTANEOUS_PROBABILITY = 0.01
const MAX_MUTATION_TENDENCY_MULTIPLIER = 3

function roll(random: RandomSource, probability: number): boolean {
  return random() < Math.min(1, Math.max(0, probability))
}

function randomStrength(random: RandomSource, range: readonly [number, number]): number {
  const [minimum, maximum] = range
  return Math.round(minimum + (Math.min(1, Math.max(0, random())) * (maximum - minimum)))
}

// Mutation Tendency is a 0-100 rating, not a percentage. This bounded curve has
// diminishing returns and can multiply a feature's rare base rate by at most 3.
export function getMutationTendencyMultiplier(tendency: number): number {
  const normalized = Math.min(100, Math.max(0, tendency)) / 100
  const curve = (1 - Math.exp(-3 * normalized)) / (1 - Math.exp(-3))
  return 1 + ((MAX_MUTATION_TENDENCY_MULTIPLIER - 1) * curve)
}

export function getSpontaneousFeatureProbability(definition: GeneticFeatureDefinition, tendency: number): number {
  const baseRate = definition.gameplay.spontaneousBaseRate ?? 0
  return Math.min(MAX_SPONTANEOUS_PROBABILITY, baseRate * getMutationTendencyMultiplier(tendency))
}

function isApplicable(definition: GeneticFeatureDefinition, speciesId: string): boolean {
  const species = getSpeciesById(speciesId)
  if (!species) return false
  if (definition.applicableSpeciesIds && !definition.applicableSpeciesIds.includes(speciesId)) return false
  if (definition.applicableGenera && !definition.applicableGenera.includes(species.genus)) return false
  return true
}

function getFeatureState(parent: Plant, featureId: string): GeneticFeatureState | undefined {
  return parent.geneticFeatures.find((state) => state.featureId === featureId)
}

function hasGeneticPresence(state: GeneticFeatureState | undefined): boolean {
  if (!state) return false
  if (state.genotype.kind === 'presence') return state.genotype.state !== 'unknown'
  if (state.genotype.kind === 'allelic') return state.genotype.alleles.includes('feature')
  return state.genotype.kind !== 'unknown'
}

function featureAlleleCount(state: GeneticFeatureState | undefined): number {
  if (!state) return 0
  if (state.genotype.kind === 'allelic') {
    return state.genotype.alleles.filter((allele) => allele === 'feature').length
  }
  if (state.genotype.kind === 'presence') return state.genotype.state === 'present' ? 2 : state.genotype.state === 'carrier' ? 1 : 0
  return hasGeneticPresence(state) ? 2 : 0
}

function inheritRecessiveGenotype(parent1: Plant, parent2: Plant, featureId: string, random: RandomSource): GenotypeState | null {
  const inheritAllele = (parent: Plant) => {
    const alleleCount = featureAlleleCount(getFeatureState(parent, featureId))
    return alleleCount >= 2 || (alleleCount === 1 && roll(random, 0.5))
  }
  const alleles = [inheritAllele(parent1), inheritAllele(parent2)]
  if (!alleles.some(Boolean)) return null
  return { kind: 'allelic', alleles: alleles.map((present) => present ? 'feature' : 'standard') }
}

function inheritConfiguredPresence(
  definition: GeneticFeatureDefinition,
  parent1: Plant,
  parent2: Plant,
  random: RandomSource,
  hybridModifier: number,
): GenotypeState | null {
  const carryingParents = [parent1, parent2].filter((parent) => hasGeneticPresence(getFeatureState(parent, definition.id))).length
  const chances = definition.gameplay.inheritanceChances
  if (!chances) return null
  const probability = carryingParents === 2 ? chances.bothParents : carryingParents === 1 ? chances.oneParent : chances.neitherParent
  return roll(random, probability * hybridModifier) ? { kind: 'presence', state: 'present' } : null
}

function resolveInheritedGenotype(
  definition: GeneticFeatureDefinition,
  parent1: Plant,
  parent2: Plant,
  random: RandomSource,
  hybridModifier: number,
): GenotypeState | null {
  if (!definition.inheritable) return null
  switch (definition.inheritanceModel) {
    case 'recessive':
      return inheritRecessiveGenotype(parent1, parent2, definition.id, random)
    case 'dominant':
    case 'incomplete-dominant':
    case 'codominant':
    case 'polygenic':
    case 'probabilistic':
    case 'developmental':
    case 'unknown':
      return inheritConfiguredPresence(definition, parent1, parent2, random, hybridModifier)
    case 'clonal':
      return null
  }
}

function genotypeCanExpress(definition: GeneticFeatureDefinition, genotype: GenotypeState): boolean {
  if (definition.inheritanceModel !== 'recessive') return true
  return genotype.kind === 'allelic' && genotype.alleles.filter((allele) => allele === 'feature').length >= 2
}

function createResolvedState(
  definition: GeneticFeatureDefinition,
  genotype: GenotypeState,
  origin: 'inherited' | 'spontaneous',
  random: RandomSource,
): GeneticFeatureState {
  const expressed = genotypeCanExpress(definition, genotype) && roll(random, definition.gameplay.expressionChance)
  return {
    featureId: definition.id,
    genotype,
    expressed,
    expressionStrength: expressed ? randomStrength(random, definition.gameplay.expressionStrength) : 0,
    stability: definition.defaultStability,
    origin,
  }
}

function createSpontaneousGenotype(definition: GeneticFeatureDefinition): GenotypeState {
  return definition.inheritanceModel === 'recessive'
    ? { kind: 'allelic', alleles: ['feature', 'feature'] }
    : { kind: 'presence', state: 'present' }
}

// Neutral today. Kept as a feature-level boundary for future approved hybrid balance rules.
export function getHybridFeatureModifier(_definition: GeneticFeatureDefinition, isHybrid: boolean): number {
  return isHybrid ? 1 : 1
}

function applyCompatibility(states: GeneticFeatureState[]): GeneticFeatureState[] {
  const accepted: GeneticFeatureState[] = []
  for (const state of states) {
    const definition = geneticFeatureDefinitions.find((entry) => entry.id === state.featureId)
    if (!definition) continue
    const acceptedIds = new Set(accepted.map((entry) => entry.featureId))
    if (definition.requiredFeatureIds?.some((id) => !states.some((entry) => entry.featureId === id))) continue
    const conflictsWithAccepted = accepted.some((entry) => (
      geneticFeatureDefinitions.find((candidate) => candidate.id === entry.featureId)?.incompatibleFeatureIds?.includes(state.featureId)
    ))
    if (conflictsWithAccepted || definition.incompatibleFeatureIds?.some((id) => acceptedIds.has(id))) continue
    const suppressed = definition.suppressedByFeatureIds?.some((id) => states.some((entry) => entry.featureId === id)) ?? false
    accepted.push(suppressed ? { ...state, expressed: false, expressionStrength: 0 } : state)
  }
  return accepted
}

export function resolveSexualGeneticFeatures(
  parent1: Plant,
  parent2: Plant,
  context: GeneticResolutionContext,
  random: RandomSource,
): GeneticFeatureState[] {
  const states: GeneticFeatureState[] = []
  for (const definition of geneticFeatureDefinitions) {
    if (!isApplicable(definition, context.offspringSpeciesId)) continue
    const hybridModifier = getHybridFeatureModifier(definition, context.isHybrid)
    const inherited = resolveInheritedGenotype(definition, parent1, parent2, random, hybridModifier)
    if (inherited) {
      states.push(createResolvedState(definition, inherited, 'inherited', random))
      continue
    }
    if (definition.spontaneous && roll(random, getSpontaneousFeatureProbability(definition, context.mutationTendency) * hybridModifier)) {
      states.push(createResolvedState(definition, createSpontaneousGenotype(definition), 'spontaneous', random))
    }
  }
  return applyCompatibility(states)
}

export function resolveShiny(establishedAt: string, random: RandomSource): SpecialVariantState[] {
  return roll(random, SHINY_PROBABILITY)
    ? [{ variantId: 'shiny', origin: 'random', establishedAt }]
    : []
}

export function resolveSexualGeneticOutcome(
  parent1: Plant,
  parent2: Plant,
  context: GeneticResolutionContext,
  random: RandomSource,
): GeneticFeatureResolution {
  return {
    geneticFeatures: resolveSexualGeneticFeatures(parent1, parent2, context, random),
    specialVariants: resolveShiny(context.establishedAt, random),
  }
}
