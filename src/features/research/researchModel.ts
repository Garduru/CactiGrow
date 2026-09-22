import { getGeneticFeatureDefinition } from '../../data/geneticFeatures.ts'
import { getSpeciesById } from '../../data/species.ts'
import type { GeneticFeatureState } from '../../types/geneticFeature'
import type { Plant } from '../../types/plant'
import type { CloneResearchMilestoneId, CloneResearchRecord, GeneticsResearchState, ResearchDepthId, ResearchKnowledgeCategory } from '../../types/research'
import { GENETICS_RESEARCH_REWARDS, getResearchDepthDefinition, researchDiscoveryMilestoneIds } from './researchConfig.ts'

export interface ResearchResult {
  research: GeneticsResearchState
  xpAwarded: number
  changed: boolean
}

export interface ProjectedFeatureKnowledge {
  name: string
  classification?: 'trait' | 'mutation'
  expressionStrength?: number
  stability?: string
  inheritanceEstimate?: string
  carrier: boolean
}

export interface GeneticKnowledgeProjection {
  depth: ResearchDepthId | 'unstudied'
  depthLabel: string
  speciesName?: string
  scientificName?: string
  cloneLineId: string
  shiny: boolean | null
  hybrid: boolean | null
  quantitativeGenetics?: Plant['genetics']
  quantitativeInterpretation: boolean
  visibleFeatures: ProjectedFeatureKnowledge[]
  carrierFeatures: ProjectedFeatureKnowledge[]
}

const depthOrder: readonly ResearchDepthId[] = [
  'observed', 'basic-analysis', 'inheritance-analysis', 'advanced-analysis', 'fully-characterized',
]

export function createGeneticsResearchState(): GeneticsResearchState {
  return { records: {}, completedDiscoveryMilestoneIds: [] }
}

export function isResearchDepthAtLeast(current: ResearchDepthId, required: ResearchDepthId): boolean {
  return depthOrder.indexOf(current) >= depthOrder.indexOf(required)
}

function visibleFeatures(plant: Plant): GeneticFeatureState[] {
  return plant.geneticFeatures.filter((feature) => feature.expressed && feature.expressionStrength > 0)
}

function isHiddenCarrier(feature: GeneticFeatureState): boolean {
  if (feature.expressed) return false
  if (feature.genotype.kind === 'presence') return feature.genotype.state === 'carrier'
  if (feature.genotype.kind === 'allelic') {
    return feature.genotype.alleles.filter((allele) => allele === 'feature').length === 1
  }
  return false
}

function addUnique<T extends string>(values: readonly T[], additions: readonly T[]): T[] {
  return [...new Set([...values, ...additions])]
}

function discoveryReward(id: string): number {
  if (id.startsWith('species:')) return GENETICS_RESEARCH_REWARDS.firstSpeciesResearch
  if (id.startsWith('genus:')) return GENETICS_RESEARCH_REWARDS.firstGenusResearch
  if (id.startsWith('feature:')) return GENETICS_RESEARCH_REWARDS.firstVisibleFeatureResearch
  if (id === researchDiscoveryMilestoneIds.shiny) return GENETICS_RESEARCH_REWARDS.firstShinyResearch
  if (id === researchDiscoveryMilestoneIds.hybrid) return GENETICS_RESEARCH_REWARDS.firstHybridResearch
  if (id === researchDiscoveryMilestoneIds.firstComparison) return GENETICS_RESEARCH_REWARDS.firstCloneComparison
  if (id === researchDiscoveryMilestoneIds.firstCrossSpeciesComparison) return GENETICS_RESEARCH_REWARDS.firstCrossSpeciesComparison
  if (id === researchDiscoveryMilestoneIds.visibleTwoFeatureSpecimen) return GENETICS_RESEARCH_REWARDS.firstVisibleTwoFeatureSpecimen
  if (id === researchDiscoveryMilestoneIds.visibleThreeFeatureSpecimen) return GENETICS_RESEARCH_REWARDS.firstVisibleThreeFeatureSpecimen
  if (id === researchDiscoveryMilestoneIds.firstTissueSample) return GENETICS_RESEARCH_REWARDS.firstTissueSample
  if (id.startsWith('sampling:clone:')) return GENETICS_RESEARCH_REWARDS.firstSampledCloneLine
  if (id === researchDiscoveryMilestoneIds.firstGoodQualitySample) return GENETICS_RESEARCH_REWARDS.firstGoodQualitySample
  if (id === researchDiscoveryMilestoneIds.firstExcellentQualitySample) return GENETICS_RESEARCH_REWARDS.firstExcellentQualitySample
  if (id === researchDiscoveryMilestoneIds.firstQuantitativeExtraction) return GENETICS_RESEARCH_REWARDS.firstQuantitativeExtraction
  if (id.startsWith('extraction:target:')) return GENETICS_RESEARCH_REWARDS.firstExtractTarget
  if (id === researchDiscoveryMilestoneIds.firstLowYieldExtract) return GENETICS_RESEARCH_REWARDS.firstLowYieldExtract
  if (id === researchDiscoveryMilestoneIds.firstGoodExtraction) return GENETICS_RESEARCH_REWARDS.firstGoodExtraction
  if (id === researchDiscoveryMilestoneIds.firstExcellentExtraction) return GENETICS_RESEARCH_REWARDS.firstExcellentExtraction
  if (id === researchDiscoveryMilestoneIds.firstQuantitativeTreatment) return GENETICS_RESEARCH_REWARDS.firstQuantitativeTreatment
  if (id.startsWith('treatment:target:')) return GENETICS_RESEARCH_REWARDS.firstTreatmentTarget
  if (id === researchDiscoveryMilestoneIds.firstExpressedTreatment) return GENETICS_RESEARCH_REWARDS.firstExpressedTreatment
  if (id === researchDiscoveryMilestoneIds.firstMeaningfulTreatmentGain) return GENETICS_RESEARCH_REWARDS.firstMeaningfulTreatmentGain
  return 0
}

export function recordTreatmentMilestones(research: GeneticsResearchState, target: string, gain?: number, meaningfulGain = 10): ResearchResult {
  const ids = gain === undefined
    ? [researchDiscoveryMilestoneIds.firstQuantitativeTreatment, researchDiscoveryMilestoneIds.treatmentTarget(target)]
    : [...(gain > 0 ? [researchDiscoveryMilestoneIds.firstExpressedTreatment] : []), ...(gain >= meaningfulGain ? [researchDiscoveryMilestoneIds.firstMeaningfulTreatmentGain] : [])]
  const additions = ids.filter((id) => !research.completedDiscoveryMilestoneIds.includes(id))
  if (!additions.length) return { research, xpAwarded: 0, changed: false }
  return { research: { ...research, completedDiscoveryMilestoneIds: [...research.completedDiscoveryMilestoneIds, ...additions] }, xpAwarded: additions.reduce((sum, id) => sum + discoveryReward(id), 0), changed: true }
}

export function recordExtractionMilestones(research: GeneticsResearchState, target: string, outcome: 'success' | 'low-yield', qualityBand: 'poor' | 'standard' | 'good' | 'excellent'): ResearchResult {
  const ids = [researchDiscoveryMilestoneIds.firstQuantitativeExtraction, researchDiscoveryMilestoneIds.extractTarget(target), ...(outcome === 'low-yield' ? [researchDiscoveryMilestoneIds.firstLowYieldExtract] : []), ...(qualityBand === 'good' || qualityBand === 'excellent' ? [researchDiscoveryMilestoneIds.firstGoodExtraction] : []), ...(qualityBand === 'excellent' ? [researchDiscoveryMilestoneIds.firstExcellentExtraction] : [])]
  const additions = ids.filter((id) => !research.completedDiscoveryMilestoneIds.includes(id))
  if (!additions.length) return { research, xpAwarded: 0, changed: false }
  return { research: { ...research, completedDiscoveryMilestoneIds: [...research.completedDiscoveryMilestoneIds, ...additions] }, xpAwarded: additions.reduce((sum, id) => sum + discoveryReward(id), 0), changed: true }
}

export function recordTissueSamplingMilestones(
  research: GeneticsResearchState,
  cloneLineId: string,
  qualityBand: 'poor' | 'standard' | 'good' | 'excellent',
): ResearchResult {
  const milestoneIds = [
    researchDiscoveryMilestoneIds.firstTissueSample,
    researchDiscoveryMilestoneIds.sampledCloneLine(cloneLineId),
    ...(qualityBand === 'good' || qualityBand === 'excellent' ? [researchDiscoveryMilestoneIds.firstGoodQualitySample] : []),
    ...(qualityBand === 'excellent' ? [researchDiscoveryMilestoneIds.firstExcellentQualitySample] : []),
  ]
  const newMilestones = milestoneIds.filter((id) => !research.completedDiscoveryMilestoneIds.includes(id))
  if (!newMilestones.length) return { research, xpAwarded: 0, changed: false }
  return {
    research: { ...research, completedDiscoveryMilestoneIds: [...research.completedDiscoveryMilestoneIds, ...newMilestones] },
    xpAwarded: newMilestones.reduce((total, id) => total + discoveryReward(id), 0),
    changed: true,
  }
}

export function observeCloneLine(
  research: GeneticsResearchState,
  plant: Plant,
  now: number,
): ResearchResult {
  if (!Number.isFinite(now) || research.records[plant.cloneLineId]) return { research, xpAwarded: 0, changed: false }
  const timestamp = new Date(now).toISOString()
  const observedFeatures = visibleFeatures(plant).map((feature) => feature.featureId)
  const genus = getSpeciesById(plant.speciesId)?.genus
  const discoveryIds = [
    researchDiscoveryMilestoneIds.species(plant.speciesId),
    ...(genus ? [researchDiscoveryMilestoneIds.genus(genus)] : []),
    ...observedFeatures.map(researchDiscoveryMilestoneIds.visibleFeature),
    ...(plant.specialVariants.some((variant) => variant.variantId === 'shiny') ? [researchDiscoveryMilestoneIds.shiny] : []),
    ...(plant.isHybrid ? [researchDiscoveryMilestoneIds.hybrid] : []),
    ...(observedFeatures.length >= 2 ? [researchDiscoveryMilestoneIds.visibleTwoFeatureSpecimen] : []),
    ...(observedFeatures.length >= 3 ? [researchDiscoveryMilestoneIds.visibleThreeFeatureSpecimen] : []),
  ]
  const newDiscoveries = discoveryIds.filter((id) => !research.completedDiscoveryMilestoneIds.includes(id))
  const record: CloneResearchRecord = {
    cloneLineId: plant.cloneLineId,
    speciesId: plant.speciesId,
    analysisDepth: 'observed',
    firstAnalyzedAt: timestamp,
    lastAnalyzedAt: timestamp,
    completedResearchMilestones: ['first-observation'],
    revealedKnowledge: ['identity', 'visible-phenotype', 'quantitative-genetics'],
    knownVisibleFeatureIds: observedFeatures,
    knownCarrierFeatureIds: [],
    observedShiny: plant.specialVariants.some((variant) => variant.variantId === 'shiny'),
    observedHybrid: Boolean(plant.isHybrid),
  }
  return {
    research: {
      ...research,
      records: { ...research.records, [plant.cloneLineId]: record },
      completedDiscoveryMilestoneIds: addUnique(research.completedDiscoveryMilestoneIds, newDiscoveries),
    },
    xpAwarded: GENETICS_RESEARCH_REWARDS.firstObservation
      + newDiscoveries.reduce((total, id) => total + discoveryReward(id), 0),
    changed: true,
  }
}

interface AnalysisStep {
  milestone: CloneResearchMilestoneId
  depth?: ResearchDepthId
  requiredLevel: number
  reward: number
  knowledge: ResearchKnowledgeCategory[]
}

function nextAnalysisStep(record: CloneResearchRecord): AnalysisStep | null {
  if (record.analysisDepth === 'observed') return { milestone: 'basic-analysis', depth: 'basic-analysis', requiredLevel: 10, reward: GENETICS_RESEARCH_REWARDS.basicAnalysis, knowledge: ['feature-classification'] }
  if (record.analysisDepth === 'basic-analysis') return { milestone: 'inheritance-analysis', depth: 'inheritance-analysis', requiredLevel: 20, reward: GENETICS_RESEARCH_REWARDS.inheritanceAnalysis, knowledge: ['stability', 'inheritance-estimate'] }
  if (record.analysisDepth === 'inheritance-analysis' && !record.completedResearchMilestones.includes('carrier-detection')) return { milestone: 'carrier-detection', requiredLevel: 30, reward: GENETICS_RESEARCH_REWARDS.carrierDetection, knowledge: ['hidden-carriers'] }
  if (record.analysisDepth === 'inheritance-analysis') return { milestone: 'advanced-analysis', depth: 'advanced-analysis', requiredLevel: 35, reward: GENETICS_RESEARCH_REWARDS.advancedAnalysis, knowledge: ['stability', 'inheritance-estimate'] }
  if (record.analysisDepth === 'advanced-analysis') return { milestone: 'fully-characterized', depth: 'fully-characterized', requiredLevel: 99, reward: GENETICS_RESEARCH_REWARDS.fullyCharacterized, knowledge: ['hidden-carriers'] }
  return null
}

export function getNextResearchStep(record: CloneResearchRecord | undefined): { label: string; requiredLevel: number } {
  if (!record) return { label: 'Basic Observation', requiredLevel: 1 }
  const step = nextAnalysisStep(record)
  if (!step) return { label: 'Research complete', requiredLevel: 99 }
  return { label: step.milestone.split('-').map((word) => word[0].toUpperCase() + word.slice(1)).join(' '), requiredLevel: step.requiredLevel }
}

export function analyzeCloneLine(
  research: GeneticsResearchState,
  plant: Plant | undefined,
  geneticsLevel: number,
  now: number,
): ResearchResult {
  if (!plant || !Number.isFinite(now)) return { research, xpAwarded: 0, changed: false }
  const record = research.records[plant.cloneLineId]
  if (!record) return { research, xpAwarded: 0, changed: false }
  const step = nextAnalysisStep(record)
  if (!step || geneticsLevel < step.requiredLevel) return { research, xpAwarded: 0, changed: false }
  const carrierIds = step.milestone === 'carrier-detection' || step.milestone === 'fully-characterized'
    ? plant.geneticFeatures.filter(isHiddenCarrier).map((feature) => feature.featureId)
    : []
  const nextRecord: CloneResearchRecord = {
    ...record,
    analysisDepth: step.depth ?? record.analysisDepth,
    lastAnalyzedAt: new Date(now).toISOString(),
    completedResearchMilestones: addUnique(record.completedResearchMilestones, [step.milestone]),
    revealedKnowledge: addUnique(record.revealedKnowledge, step.knowledge),
    knownCarrierFeatureIds: addUnique(record.knownCarrierFeatureIds, carrierIds),
  }
  return {
    research: { ...research, records: { ...research.records, [plant.cloneLineId]: nextRecord } },
    xpAwarded: step.reward,
    changed: true,
  }
}

export function compareCloneLines(
  research: GeneticsResearchState,
  first: Plant | undefined,
  second: Plant | undefined,
  geneticsLevel: number,
): ResearchResult {
  if (!first || !second || first.cloneLineId === second.cloneLineId || geneticsLevel < 5) return { research, xpAwarded: 0, changed: false }
  const milestoneIds = [
    researchDiscoveryMilestoneIds.firstComparison,
    ...(first.speciesId !== second.speciesId ? [researchDiscoveryMilestoneIds.firstCrossSpeciesComparison] : []),
  ]
  const newMilestones = milestoneIds.filter((id) => !research.completedDiscoveryMilestoneIds.includes(id))
  if (!newMilestones.length) return { research, xpAwarded: 0, changed: false }
  return {
    research: {
      ...research,
      completedDiscoveryMilestoneIds: [...research.completedDiscoveryMilestoneIds, ...newMilestones],
    },
    xpAwarded: newMilestones.reduce((total, id) => total + discoveryReward(id), 0),
    changed: true,
  }
}

function inheritanceEstimate(featureId: string): string {
  const chances = getGeneticFeatureDefinition(featureId)?.gameplay.inheritanceChances
  const probability = chances?.oneParent ?? 0
  if (probability >= 0.6) return 'Very High'
  if (probability >= 0.35) return 'High'
  if (probability >= 0.15) return 'Moderate'
  if (probability >= 0.05) return 'Low'
  return 'Very Low'
}

export function projectGeneticKnowledge(
  plant: Plant | undefined,
  record: CloneResearchRecord | undefined,
  geneticsLevel: number,
): GeneticKnowledgeProjection {
  const species = record ? getSpeciesById(record.speciesId) : plant ? getSpeciesById(plant.speciesId) : undefined
  const depth = record?.analysisDepth ?? 'unstudied'
  const classificationVisible = Boolean(record && geneticsLevel >= 10 && isResearchDepthAtLeast(record.analysisDepth, 'basic-analysis'))
  const stabilityVisible = Boolean(record && geneticsLevel >= 15 && isResearchDepthAtLeast(record.analysisDepth, 'basic-analysis'))
  const inheritanceVisible = Boolean(record && geneticsLevel >= 20 && isResearchDepthAtLeast(record.analysisDepth, 'inheritance-analysis'))
  const visibleStates = plant?.geneticFeatures.filter((state) => record?.knownVisibleFeatureIds.includes(state.featureId)) ?? []
  const stateById = new Map(visibleStates.map((state) => [state.featureId, state]))
  const projectFeature = (featureId: string, carrier: boolean): ProjectedFeatureKnowledge => {
    const definition = getGeneticFeatureDefinition(featureId)
    const actual = stateById.get(featureId)
    return {
      name: definition?.displayName ?? 'Unknown feature',
      classification: classificationVisible ? definition?.classification : undefined,
      expressionStrength: carrier ? undefined : actual?.expressionStrength,
      stability: stabilityVisible && !carrier ? actual?.stability ?? definition?.defaultStability : undefined,
      inheritanceEstimate: inheritanceVisible ? inheritanceEstimate(featureId) : undefined,
      carrier,
    }
  }
  return {
    depth,
    depthLabel: depth === 'unstudied' ? 'Unstudied' : getResearchDepthDefinition(depth).label,
    speciesName: species?.commonName,
    scientificName: species?.scientificName,
    cloneLineId: record?.cloneLineId ?? plant?.cloneLineId ?? '',
    shiny: record ? record.observedShiny : null,
    hybrid: record ? record.observedHybrid : null,
    quantitativeGenetics: record && plant ? plant.genetics : undefined,
    quantitativeInterpretation: Boolean(record && plant && geneticsLevel >= 25 && isResearchDepthAtLeast(record.analysisDepth, 'basic-analysis')),
    visibleFeatures: (record?.knownVisibleFeatureIds ?? []).map((id) => projectFeature(id, false)),
    carrierFeatures: geneticsLevel >= 30 && record?.completedResearchMilestones.includes('carrier-detection')
      ? record.knownCarrierFeatureIds.map((id) => projectFeature(id, true))
      : [],
  }
}
