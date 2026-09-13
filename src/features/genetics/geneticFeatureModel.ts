import { getGeneticFeatureDefinition } from '../../data/geneticFeatures'
import type { GeneticFeatureState, SpecialVariantState } from '../../types/geneticFeature'

function hasValidGenotype(state: GeneticFeatureState): boolean {
  const genotype = state.genotype
  switch (genotype.kind) {
    case 'allelic':
      return genotype.alleles.length === 2
        && genotype.alleles.every((allele) => allele === 'feature' || allele === 'standard')
    case 'quantitative':
      return Number.isFinite(genotype.value) && genotype.value >= 0 && genotype.value <= 100
    case 'presence':
      return genotype.state === 'present' || genotype.state === 'carrier' || genotype.state === 'unknown'
    case 'developmental':
      return Boolean(genotype.state)
    case 'unknown':
      return true
  }
}

export function hasValidGeneticFeatureStates(states: readonly GeneticFeatureState[]): boolean {
  const ids = new Set<string>()
  const statesAreValid = states.every((state) => {
    if (!getGeneticFeatureDefinition(state.featureId)
      || ids.has(state.featureId)
      || !hasValidGenotype(state)
      || !Number.isFinite(state.expressionStrength)
      || state.expressionStrength < 0
      || state.expressionStrength > 100
      || (!state.expressed && state.expressionStrength !== 0)
      || (state.expressed && state.expressionStrength <= 0)) return false
    ids.add(state.featureId)
    return true
  })
  if (!statesAreValid) return false

  return states.every((state) => {
    const definition = getGeneticFeatureDefinition(state.featureId)!
    return !definition.incompatibleFeatureIds?.some((id) => ids.has(id))
      && (definition.requiredFeatureIds?.every((id) => ids.has(id)) ?? true)
  })
}

export function hasValidSpecialVariantStates(states: readonly SpecialVariantState[]): boolean {
  const ids = new Set<string>()
  return states.every((state) => {
    if (state.variantId !== 'shiny'
      || ids.has(state.variantId)
      || !Number.isFinite(Date.parse(state.establishedAt))) return false
    ids.add(state.variantId)
    return true
  })
}

export function getExpressedGeneticFeatures(states: readonly GeneticFeatureState[]): GeneticFeatureState[] {
  return states.filter((state) => state.expressed && state.expressionStrength > 0)
}
