export type GeneticFeatureClassification = 'trait' | 'mutation'

export type GeneticFeatureFamily =
  | 'morphology'
  | 'rib-structure'
  | 'spination'
  | 'epidermis-color'
  | 'chlorophyll'
  | 'branching-offsetting'
  | 'flowering'
  | 'growth-habit'
  | 'crest-fasciation'
  | 'monstrose'
  | 'melted'
  | 'spiral-helical'
  | 'dichotomous'
  | 'dwarf-compact'
  | 'giant-vigorous'
  | 'root-morphology'
  | 'reproductive'
  | 'developmental-anomaly'
  | 'stress-response'
  | 'special-other'

export type FeatureInheritanceModel =
  | 'dominant'
  | 'recessive'
  | 'incomplete-dominant'
  | 'codominant'
  | 'polygenic'
  | 'probabilistic'
  | 'developmental'
  | 'clonal'
  | 'unknown'

export type FeatureExpressionModel = 'binary' | 'variable' | 'developmental' | 'probabilistic' | 'unknown'
export type FeatureStability = 'stable' | 'variable' | 'unstable' | 'unknown'
export type GeneticFeatureOrigin = 'inherited' | 'spontaneous' | 'induced' | 'founder' | 'unknown'

export interface FeatureInheritanceChances {
  neitherParent: number
  oneParent: number
  bothParents: number
}

export interface GeneticFeatureGameplayRules {
  evidenceStatus: 'game-model' | 'botanically-supported' | 'unknown'
  inheritanceChances?: FeatureInheritanceChances
  spontaneousBaseRate?: number
  expressionChance: number
  expressionStrength: readonly [number, number]
}

export type GenotypeState =
  | { kind: 'allelic'; alleles: string[] }
  | { kind: 'quantitative'; value: number }
  | { kind: 'presence'; state: 'present' | 'carrier' | 'unknown' }
  | { kind: 'developmental'; state: string }
  | { kind: 'unknown' }

export interface GeneticFeatureDefinition {
  id: string
  displayName: string
  classification: GeneticFeatureClassification
  family: GeneticFeatureFamily
  description: string
  inheritanceModel: FeatureInheritanceModel
  expressionModel: FeatureExpressionModel
  applicableSpeciesIds?: readonly string[]
  applicableGenera?: readonly string[]
  inheritable: boolean
  spontaneous: boolean
  extractable: boolean
  inducible: boolean
  defaultStability: FeatureStability
  occurrence: { rarity: 'common' | 'uncommon' | 'rare' | 'very-rare' | 'unknown'; baseRate?: number }
  incompatibleFeatureIds?: readonly string[]
  requiredFeatureIds?: readonly string[]
  suppressedByFeatureIds?: readonly string[]
  journalTrackable: boolean
  visuallyObvious: boolean
  artTags: readonly string[]
  gameplay: GeneticFeatureGameplayRules
}

export interface GeneticFeatureState {
  featureId: string
  genotype: GenotypeState
  expressed: boolean
  expressionStrength: number
  stability: FeatureStability
  origin: GeneticFeatureOrigin
}

export type SpecialVariantId = 'shiny'

export interface SpecialVariantState {
  variantId: SpecialVariantId
  origin: 'random' | 'unknown'
  establishedAt: string
}
