import type { QuantitativeExtractTarget, TissueSampleQualityBand } from './lab'

export interface QuantitativeTreatmentResolution {
  originalValue: number
  gain: number
  finalValue: number
  resolvedAt: string
}

export interface QuantitativeSeedTreatment {
  id: string
  seedId: string
  target: QuantitativeExtractTarget
  extractId: string
  sourceTissueSampleId: string
  donorSpecimenId: string
  donorCloneLineId: string
  donorSpeciesId: string
  extractionQuality: number
  extractionQualityBand: TissueSampleQualityBand
  extractPotency: number
  appliedAt: string
  appliedBy: string
  geneticsLevelAtApplication: number
  labTierAtApplication: number
  status: 'pending' | 'resolved'
  resolution?: QuantitativeTreatmentResolution
}
