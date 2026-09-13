import { getSpeciesById } from '../../data/species'
import type { GeneticsLabState, GeneticsLabTierId, TissueSample, TissueSampleQualityBand } from '../../types/lab'
import type { Plant } from '../../types/plant'
import { TISSUE_SAMPLING_COOLDOWN_MS, TISSUE_SAMPLING_LAB_TIER, TISSUE_SAMPLING_LEVEL, geneticsLabTiers } from './labConfig'

export interface LabCapabilityStatus {
  available: boolean
  missingLevel: boolean
  missingLabTier: boolean
  cooldownUntil?: string
}

export function createGeneticsLabState(): GeneticsLabState {
  return { tier: 0, tissueSamples: [], specimenSampling: {}, geneticExtracts: [], extractionAttemptIds: [] }
}

export function getInitialSampleUses(band: TissueSampleQualityBand): number { return band === 'poor' ? 1 : band === 'standard' ? 2 : 3 }
export function normalizeTissueSample(sample: TissueSample): TissueSample {
  const initialUses = Number.isSafeInteger(sample.initialUses) ? sample.initialUses : getInitialSampleUses(sample.qualityBand)
  const remainingUses = Number.isSafeInteger(sample.remainingUses) ? Math.min(initialUses, Math.max(0, sample.remainingUses)) : initialUses
  return { ...sample, initialUses, remainingUses, status: remainingUses === 0 ? 'depleted' : 'stored' }
}

export function getTissueSamplingStatus(lab: GeneticsLabState, geneticsLevel: number, specimenId: string, now: number): LabCapabilityStatus {
  const cooldownUntil = lab.specimenSampling[specimenId]?.nextSampleEligibleAt
  const coolingDown = Boolean(cooldownUntil && Date.parse(cooldownUntil) > now)
  const missingLevel = geneticsLevel < TISSUE_SAMPLING_LEVEL
  const missingLabTier = lab.tier < TISSUE_SAMPLING_LAB_TIER
  return { available: !missingLevel && !missingLabTier && !coolingDown, missingLevel, missingLabTier, cooldownUntil: coolingDown ? cooldownUntil : undefined }
}

export function getSampleQualityBand(quality: number): TissueSampleQualityBand {
  if (quality < 30) return 'poor'
  if (quality < 55) return 'standard'
  if (quality < 80) return 'good'
  return 'excellent'
}

// Gameplay preparation quality only. It does not measure genetic potency.
export function resolveSampleQuality(geneticsLevel: number, labTier: GeneticsLabTierId, random: () => number): number {
  const levelBonus = Math.max(0, geneticsLevel - TISSUE_SAMPLING_LEVEL) * 0.45
  const tierBonus = Math.max(0, labTier - TISSUE_SAMPLING_LAB_TIER) * 7
  return Math.round(Math.min(100, Math.max(0, 48 + levelBonus + tierBonus + ((random() - 0.5) * 44))))
}

export function createTissueSample(
  plant: Plant,
  playerId: string,
  geneticsLevel: number,
  labTier: GeneticsLabTierId,
  now: number,
  random: () => number = Math.random,
  createId: () => string = () => crypto.randomUUID(),
): TissueSample | null {
  const id = createId()
  if (!id || !Number.isFinite(now) || !getSpeciesById(plant.speciesId)) return null
  const quality = resolveSampleQuality(geneticsLevel, labTier, random)
  const qualityBand = getSampleQualityBand(quality)
  const initialUses = getInitialSampleUses(qualityBand)
  return { id, donorSpecimenId: plant.id, donorCloneLineId: plant.cloneLineId, donorSpeciesId: plant.speciesId, collectorId: playerId, collectedAt: new Date(now).toISOString(), sampleType: 'stem-tissue', quality, qualityBand, donorQuantitativeGenetics: { ...plant.genetics }, initialUses, remainingUses: initialUses, status: 'stored' }
}

export function canUpgradeLab(lab: GeneticsLabState, targetTier: GeneticsLabTierId, tokens: number): boolean {
  const definition = geneticsLabTiers.find((tier) => tier.id === targetTier)
  return Boolean(definition && targetTier === lab.tier + 1 && tokens >= definition.cost)
}

export function addTissueSample(lab: GeneticsLabState, sample: TissueSample): GeneticsLabState | null {
  if (lab.tissueSamples.some((entry) => entry.id === sample.id)) return null
  const nextEligibleAt = new Date(Date.parse(sample.collectedAt) + TISSUE_SAMPLING_COOLDOWN_MS).toISOString()
  const previous = lab.specimenSampling[sample.donorSpecimenId]
  return {
    ...lab,
    tissueSamples: [...lab.tissueSamples, sample],
    specimenSampling: { ...lab.specimenSampling, [sample.donorSpecimenId]: { lastSampledAt: sample.collectedAt, nextSampleEligibleAt: nextEligibleAt, sampleCount: (previous?.sampleCount ?? 0) + 1 } },
  }
}
