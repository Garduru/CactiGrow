export type GeneticsLabTierId = 0 | 1 | 2 | 3 | 4 | 5
export type TissueSampleQualityBand = 'poor' | 'standard' | 'good' | 'excellent'

export interface TissueSample {
  id: string
  donorSpecimenId: string
  donorCloneLineId: string
  donorSpeciesId: string
  collectorId: string
  collectedAt: string
  sampleType: 'stem-tissue'
  quality: number
  qualityBand: TissueSampleQualityBand
  donorQuantitativeGenetics: import('./genetics').PlantGenetics
  initialUses: number
  remainingUses: number
  status: 'stored' | 'depleted'
  depletedAt?: string
}

export type QuantitativeExtractTarget = keyof import('./genetics').PlantGenetics
export type ExtractionOutcome = 'success' | 'low-yield' | 'failure'
export interface GeneticExtract {
  id: string
  category: 'quantitative'
  target: QuantitativeExtractTarget
  sourceTissueSampleId: string
  donorSpecimenId: string
  donorCloneLineId: string
  donorSpeciesId: string
  researcherId: string
  createdAt: string
  outcome: 'success' | 'low-yield'
  extractionQuality: number
  extractionQualityBand: TissueSampleQualityBand
  potency: number
  status: 'stored'
}
export interface ExtractionAttempt { id: string; sampleId: string; target: QuantitativeExtractTarget; attemptedAt: string; outcome: ExtractionOutcome; extract?: GeneticExtract }

export interface SpecimenSamplingState {
  lastSampledAt: string
  nextSampleEligibleAt: string
  sampleCount: number
}

export interface GeneticsLabState {
  tier: GeneticsLabTierId
  installedAt?: string
  upgradedAt?: string
  tissueSamples: TissueSample[]
  specimenSampling: Record<string, SpecimenSamplingState>
  geneticExtracts: GeneticExtract[]
  extractionAttemptIds: string[]
}
