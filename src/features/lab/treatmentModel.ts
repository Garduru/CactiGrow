import type { BredSeed } from '../../types/bredSeed'
import type { GeneticExtract, GeneticsLabState } from '../../types/lab'
import type { PlayerState } from '../../types/player'
import type { QuantitativeSeedTreatment } from '../../types/treatment'
import { getLevelFromXp } from '../progression/progressionModel.ts'
import { quantitativeExtractTargets, QUANTITATIVE_EXTRACTION_LAB_TIER, QUANTITATIVE_EXTRACTION_LEVEL } from './extractionModel.ts'

export const QUANTITATIVE_TREATMENT_LEVEL = QUANTITATIVE_EXTRACTION_LEVEL
export const QUANTITATIVE_TREATMENT_LAB_TIER = QUANTITATIVE_EXTRACTION_LAB_TIER
export const MAX_QUANTITATIVE_TREATMENTS_PER_SEED = 1
export const MEANINGFUL_TREATMENT_GAIN = 10

const clampUnit = (value: number) => Math.min(1, Math.max(0, value))
const normalized = (value: number, minimum: number, maximum: number) => clampUnit((value - minimum) / (maximum - minimum))

export function isValidStoredQuantitativeExtract(extract: GeneticExtract | undefined, lab: GeneticsLabState, playerId: string): extract is GeneticExtract {
  if (!extract || extract.category !== 'quantitative' || extract.status !== 'stored' || extract.researcherId !== playerId) return false
  if (!extract.id || !extract.sourceTissueSampleId || !extract.donorSpecimenId || !extract.donorCloneLineId || !extract.donorSpeciesId || !quantitativeExtractTargets.includes(extract.target)) return false
  if (!Number.isSafeInteger(extract.extractionQuality) || extract.extractionQuality < 0 || extract.extractionQuality > 100 || !Number.isSafeInteger(extract.potency) || extract.potency < 0 || extract.potency > 100) return false
  const sample = lab.tissueSamples.find((entry) => entry.id === extract.sourceTissueSampleId)
  return Boolean(sample && sample.donorSpecimenId === extract.donorSpecimenId && sample.donorCloneLineId === extract.donorCloneLineId && sample.donorSpeciesId === extract.donorSpeciesId)
}

export function canApplyQuantitativeTreatment(lab: GeneticsLabState, player: PlayerState, seed: BredSeed | undefined, extract: GeneticExtract | undefined): boolean {
  return Boolean(seed && getLevelFromXp(player.skills.genetics.xp) >= QUANTITATIVE_TREATMENT_LEVEL && lab.tier >= QUANTITATIVE_TREATMENT_LAB_TIER && (seed.quantitativeTreatments?.length ?? 0) < MAX_QUANTITATIVE_TREATMENTS_PER_SEED && isValidStoredQuantitativeExtract(extract, lab, player.id))
}

export function createQuantitativeSeedTreatment(lab: GeneticsLabState, player: PlayerState, seed: BredSeed | undefined, extract: GeneticExtract | undefined, now: number, createId: () => string = () => crypto.randomUUID()): QuantitativeSeedTreatment | null {
  if (!Number.isFinite(now) || !canApplyQuantitativeTreatment(lab, player, seed, extract)) return null
  const id = createId()
  if (!id) return null
  return { id, seedId: seed!.id, target: extract!.target, extractId: extract!.id, sourceTissueSampleId: extract!.sourceTissueSampleId, donorSpecimenId: extract!.donorSpecimenId, donorCloneLineId: extract!.donorCloneLineId, donorSpeciesId: extract!.donorSpeciesId, extractionQuality: extract!.extractionQuality, extractionQualityBand: extract!.extractionQualityBand, extractPotency: extract!.potency, appliedAt: new Date(now).toISOString(), appliedBy: player.id, geneticsLevelAtApplication: getLevelFromXp(player.skills.genetics.xp), labTierAtApplication: lab.tier, status: 'pending' }
}

export function getTreatmentExpressionProbability(treatment: QuantitativeSeedTreatment): number {
  return Math.min(.9, .35 + treatment.extractPotency / 100 * .3 + treatment.extractionQuality / 100 * .15 + normalized(treatment.geneticsLevelAtApplication, 50, 99) * .07 + normalized(treatment.labTierAtApplication, 3, 5) * .03)
}

export function resolveQuantitativeTreatment(treatment: QuantitativeSeedTreatment, originalValue: number, now: number, expressionRoll: number, gainRoll: number): QuantitativeSeedTreatment | null {
  if (treatment.status !== 'pending' || treatment.resolution || !Number.isFinite(now) || !Number.isFinite(originalValue) || originalValue < 0 || originalValue > 100 || expressionRoll < 0 || expressionRoll >= 1 || gainRoll < 0 || gainRoll >= 1) return null
  const headroom = 100 - originalValue
  let gain = 0
  if (expressionRoll < getTreatmentExpressionProbability(treatment) && headroom > 0) {
    const potentialRate = .04 + treatment.extractPotency / 100 * .16 + treatment.extractionQuality / 100 * .08 + normalized(treatment.geneticsLevelAtApplication, 50, 99) * .04 + normalized(treatment.labTierAtApplication, 3, 5) * .03
    gain = Math.max(0, Math.round(headroom * potentialRate * (.35 + gainRoll * .65)))
  }
  return { ...treatment, status: 'resolved', resolution: { originalValue, gain, finalValue: Math.min(100, originalValue + gain), resolvedAt: new Date(now).toISOString() } }
}
