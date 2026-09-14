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
  firstTissueSample: 25,
  firstSampledCloneLine: 15,
  firstGoodQualitySample: 20,
  firstExcellentQualitySample: 40,
  firstQuantitativeExtraction: 40,
  firstExtractTarget: 25,
  firstLowYieldExtract: 15,
  firstGoodExtraction: 25,
  firstExcellentExtraction: 50,
  firstQuantitativeTreatment: 50,
  firstTreatmentTarget: 25,
  firstExpressedTreatment: 40,
  firstMeaningfulTreatmentGain: 30,
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
  firstTissueSample: 'sampling:first',
  sampledCloneLine: (cloneLineId: string) => `sampling:clone:${cloneLineId}`,
  firstGoodQualitySample: 'sampling:quality:good',
  firstExcellentQualitySample: 'sampling:quality:excellent',
  firstQuantitativeExtraction: 'extraction:quantitative:first',
  extractTarget: (target: string) => `extraction:target:${target}`,
  firstLowYieldExtract: 'extraction:outcome:low-yield',
  firstGoodExtraction: 'extraction:quality:good',
  firstExcellentExtraction: 'extraction:quality:excellent',
  firstQuantitativeTreatment: 'treatment:quantitative:first',
  treatmentTarget: (target: string) => `treatment:target:${target}`,
  firstExpressedTreatment: 'treatment:expressed:first',
  firstMeaningfulTreatmentGain: 'treatment:meaningful-gain:first',
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
