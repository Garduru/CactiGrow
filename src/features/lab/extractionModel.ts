import type { ExtractionAttempt, GeneticExtract, GeneticsLabState, QuantitativeExtractTarget, TissueSample } from '../../types/lab'
import { normalizeTissueSample } from './labModel.ts'

export const QUANTITATIVE_EXTRACTION_LEVEL = 50
export const QUANTITATIVE_EXTRACTION_LAB_TIER = 3
export const quantitativeExtractTargets: readonly QuantitativeExtractTarget[] = ['vigor', 'growthSpeed', 'size', 'flowering', 'mutationChance']
export const extractTargetLabels: Record<QuantitativeExtractTarget, string> = { vigor: 'Vigor', growthSpeed: 'Growth Speed', size: 'Size', flowering: 'Flowering', mutationChance: 'Mutation Tendency' }
const clamp = (value: number) => Math.round(Math.min(100, Math.max(0, value)))
const normalized = (value: number, minimum: number, maximum: number) => Math.min(1, Math.max(0, (value - minimum) / (maximum - minimum)))

export function canExtractQuantitative(lab: GeneticsLabState, level: number, sample: TissueSample | undefined): boolean { return Boolean(sample && level >= QUANTITATIVE_EXTRACTION_LEVEL && lab.tier >= QUANTITATIVE_EXTRACTION_LAB_TIER && sample.status === 'stored' && sample.remainingUses > 0) }
export function getExtractionSuccessProbability(sample: TissueSample, level: number, tier: number): number { return Math.min(.95, Math.max(.55, .55 + sample.quality / 100 * .18 + normalized(level, 50, 99) * .12 + normalized(tier, 3, 5) * .1)) }
export function getLowYieldProbability(sample: TissueSample, level: number, tier: number): number { return Math.min(.4, Math.max(.08, .4 - sample.quality / 100 * .18 - normalized(level, 50, 99) * .08 - normalized(tier, 3, 5) * .06)) }
export function resolveExtractionQuality(sample: TissueSample, level: number, tier: number, lowYield: boolean, random: () => number): number { return clamp(sample.quality * .45 + normalized(level, 50, 99) * 20 + normalized(tier, 3, 5) * 15 + random() * 20 - (lowYield ? 25 : 0)) }
export function resolveExtractPotency(sample: TissueSample, target: QuantitativeExtractTarget, quality: number, level: number, tier: number, lowYield: boolean, random: () => number): number { return clamp(sample.donorQuantitativeGenetics[target] * .45 + quality * .25 + normalized(level, 50, 99) * 15 + normalized(tier, 3, 5) * 10 + random() * 5 - (lowYield ? 5 : 0)) }

export function createExtractionAttempt(lab: GeneticsLabState, sampleId: string, target: QuantitativeExtractTarget, level: number, playerId: string, now: number, random: () => number = Math.random, createId: () => string = () => crypto.randomUUID(), createExtractId: () => string = () => crypto.randomUUID()): ExtractionAttempt | null {
  const storedSample = lab.tissueSamples.find((entry) => entry.id === sampleId)
  const sample = storedSample ? normalizeTissueSample(storedSample) : undefined
  if (!canExtractQuantitative(lab, level, sample) || !quantitativeExtractTargets.includes(target)) return null
  const id = createId(); if (!id) return null
  const attemptedAt = new Date(now).toISOString()
  if (random() >= getExtractionSuccessProbability(sample!, level, lab.tier)) return { id, sampleId, target, attemptedAt, outcome: 'failure' }
  const lowYield = random() < getLowYieldProbability(sample!, level, lab.tier)
  const extractionQuality = resolveExtractionQuality(sample!, level, lab.tier, lowYield, random)
  const potency = resolveExtractPotency(sample!, target, extractionQuality, level, lab.tier, lowYield, random)
  const extractId = createExtractId(); if (!extractId) return null
  const extract: GeneticExtract = { id: extractId, category: 'quantitative', target, sourceTissueSampleId: sample!.id, donorSpecimenId: sample!.donorSpecimenId, donorCloneLineId: sample!.donorCloneLineId, donorSpeciesId: sample!.donorSpeciesId, researcherId: playerId, createdAt: attemptedAt, outcome: lowYield ? 'low-yield' : 'success', extractionQuality, extractionQualityBand: extractionQuality < 30 ? 'poor' : extractionQuality < 55 ? 'standard' : extractionQuality < 80 ? 'good' : 'excellent', potency, status: 'stored' }
  return { id, sampleId, target, attemptedAt, outcome: extract.outcome, extract }
}
