export type ResearchDepthId =
  | 'observed'
  | 'basic-analysis'
  | 'inheritance-analysis'
  | 'advanced-analysis'
  | 'fully-characterized'

export type ResearchKnowledgeCategory =
  | 'identity'
  | 'visible-phenotype'
  | 'quantitative-genetics'
  | 'feature-classification'
  | 'stability'
  | 'inheritance-estimate'
  | 'hidden-carriers'

export type CloneResearchMilestoneId =
  | 'first-observation'
  | 'basic-analysis'
  | 'inheritance-analysis'
  | 'carrier-detection'
  | 'advanced-analysis'
  | 'fully-characterized'

export interface CloneResearchRecord {
  cloneLineId: string
  speciesId: string
  analysisDepth: ResearchDepthId
  firstAnalyzedAt: string
  lastAnalyzedAt: string
  completedResearchMilestones: CloneResearchMilestoneId[]
  revealedKnowledge: ResearchKnowledgeCategory[]
  knownVisibleFeatureIds: string[]
  knownCarrierFeatureIds: string[]
  observedShiny: boolean
  observedHybrid: boolean
}

export interface GeneticsResearchState {
  records: Record<string, CloneResearchRecord>
  completedDiscoveryMilestoneIds: string[]
}
