import type { ResearchDepthId } from '../../types/research'

export const GENETICS_RESEARCH_REWARDS = {
  firstObservation: 15,
  firstSpeciesResearch: 25,
  firstGenusResearch: 30,
  firstVisibleFeatureResearch: 35,
  firstShinyResearch: 150,
  firstHybridResearch: 50,
  firstCloneComparison: 20,
  firstCrossSpeciesComparison: 20,
  firstVisibleTwoFeatureSpecimen: 40,
  firstVisibleThreeFeatureSpecimen: 60,
  basicAnalysis: 25,
  inheritanceAnalysis: 40,
  carrierDetection: 30,
  advancedAnalysis: 75,
  fullyCharacterized: 125,
} as const

export const researchDiscoveryMilestoneIds = {
  species: (speciesId: string) => `species:${speciesId}`,
  genus: (genus: string) => `genus:${genus}`,
  visibleFeature: (featureId: string) => `feature:${featureId}`,
  shiny: 'finding:shiny',
  hybrid: 'finding:hybrid',
  firstComparison: 'comparison:first',
  firstCrossSpeciesComparison: 'comparison:cross-species',
  visibleTwoFeatureSpecimen: 'finding:visible-features-2',
  visibleThreeFeatureSpecimen: 'finding:visible-features-3',
} as const

export const researchDepthDefinitions: readonly {
  id: ResearchDepthId
  label: string
  requiredLevel: number
}[] = [
  { id: 'observed', label: 'Observed', requiredLevel: 1 },
  { id: 'basic-analysis', label: 'Basic analysis', requiredLevel: 10 },
  { id: 'inheritance-analysis', label: 'Inheritance analysis', requiredLevel: 20 },
  { id: 'advanced-analysis', label: 'Advanced analysis', requiredLevel: 35 },
  { id: 'fully-characterized', label: 'Fully characterized', requiredLevel: 99 },
]

export function getResearchDepthDefinition(depth: ResearchDepthId) {
  return researchDepthDefinitions.find((definition) => definition.id === depth)!
}
