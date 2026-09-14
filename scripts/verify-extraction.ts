import { createExtractionAttempt, resolveExtractPotency, resolveExtractionQuality } from '../src/features/lab/extractionModel'
import { createTissueSample, getInitialSampleUses, normalizeTissueSample } from '../src/features/lab/labModel'
import { XP_THRESHOLDS } from '../src/features/progression/progressionModel'
import { createInitialGameState, gameStateReducer, type CollectedPlant } from '../src/game/gameState'

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message) }
function sequence(values: number[]) { let index = 0; return () => values[index++] ?? 0.5 }
assert(getInitialSampleUses('poor') === 1 && getInitialSampleUses('standard') === 2 && getInitialSampleUses('good') === 3 && getInitialSampleUses('excellent') === 3, 'Quality bands must assign 1/2/3/3 uses')

const now = Date.UTC(2026, 0, 1)
let state = createInitialGameState(now)
const plant: CollectedPlant = { ...state.nurserySlots[0].plant!, stage: 'mature', collectedAt: new Date(now).toISOString() }
const sample = createTissueSample(plant, state.player.id, 50, 3, now, () => 0.5, () => 'sample')!
const legacySample = normalizeTissueSample({ ...sample, quality: 73, qualityBand: 'good', initialUses: undefined, remainingUses: undefined } as unknown as typeof sample)
assert(legacySample.quality === 73 && legacySample.qualityBand === 'good' && legacySample.initialUses === 3 && legacySample.remainingUses === 3, 'Legacy samples must derive uses without rerolling quality')
state = { ...state, ownedPlants: [plant], geneticsLab: { ...state.geneticsLab, tier: 3, tissueSamples: [sample] }, player: { ...state.player, skills: { ...state.player.skills, genetics: { xp: XP_THRESHOLDS[49] } } } }
const lockedLevel = { ...state, player: { ...state.player, skills: { ...state.player.skills, genetics: { xp: XP_THRESHOLDS[48] } } } }
assert(gameStateReducer(lockedLevel, { type: 'extraction/attempted', attempt: { id: 'invalid', sampleId: sample.id, target: 'vigor', attemptedAt: new Date(now).toISOString(), outcome: 'failure' } }) === lockedLevel, 'Level lock must consume nothing')
const lockedLab = { ...state, geneticsLab: { ...state.geneticsLab, tier: 2 as const } }
assert(!createExtractionAttempt(lockedLab.geneticsLab, sample.id, 'vigor', 50, state.player.id, now, () => 0), 'Tier lock must block extraction')

const success = createExtractionAttempt(state.geneticsLab, sample.id, 'vigor', 50, state.player.id, now + 1, sequence([0, 1, .5, .5]), () => 'attempt-1', () => 'extract-1')!
const donorSnapshot = JSON.stringify(plant)
const afterSuccess = gameStateReducer(state, { type: 'extraction/attempted', attempt: success })
assert(afterSuccess.geneticsLab.tissueSamples[0].remainingUses === sample.remainingUses - 1 && afterSuccess.geneticsLab.geneticExtracts.length === 1, 'Success must consume one use and create one extract')
const extract = afterSuccess.geneticsLab.geneticExtracts[0]
assert(extract.target === 'vigor' && extract.sourceTissueSampleId === sample.id && extract.donorSpecimenId === plant.id && extract.donorCloneLineId === plant.cloneLineId && extract.donorSpeciesId === plant.speciesId, 'Extract must preserve full provenance')
assert(JSON.stringify(afterSuccess.ownedPlants[0]) === donorSnapshot && !('specialVariants' in extract), 'Extraction must not alter donor or copy Shiny')
assert(gameStateReducer(afterSuccess, { type: 'extraction/attempted', attempt: success }) === afterSuccess, 'Duplicate attempt must not consume twice')
const malformed = { ...success, id: 'malformed', extract: { ...success.extract!, potency: 101 } }
assert(gameStateReducer(afterSuccess, { type: 'extraction/attempted', attempt: malformed }) === afterSuccess, 'Malformed extracts must consume nothing')
assert(!createExtractionAttempt(afterSuccess.geneticsLab, sample.id, 'shiny' as never, 50, state.player.id, now, () => 0), 'Shiny and non-quantitative targets must be rejected')

const lowYield = createExtractionAttempt(afterSuccess.geneticsLab, sample.id, 'mutationChance', 50, state.player.id, now + 2, sequence([0, 0, .5, .5]), () => 'attempt-2', () => 'extract-2')!
const afterLow = gameStateReducer(afterSuccess, { type: 'extraction/attempted', attempt: lowYield })
assert(lowYield.outcome === 'low-yield' && afterLow.geneticsLab.geneticExtracts.length === 2 && !('geneticFeatures' in lowYield.extract!), 'Mutation Tendency must remain a quantitative low-yield extract')
assert(lowYield.extract!.extractionQuality < success.extract!.extractionQuality && lowYield.extract!.potency < success.extract!.potency, 'Low yield must reduce quality and potency')

const poor = createTissueSample(plant, state.player.id, 40, 2, now, () => 0, () => 'poor')!
const failureState = { ...state, geneticsLab: { ...state.geneticsLab, tissueSamples: [poor], geneticExtracts: [], extractionAttemptIds: [] } }
const failure = createExtractionAttempt(failureState.geneticsLab, poor.id, 'size', 50, state.player.id, now + 3, () => 1, () => 'failure')!
const afterFailure = gameStateReducer(failureState, { type: 'extraction/attempted', attempt: failure })
assert(failure.outcome === 'failure' && afterFailure.geneticsLab.tissueSamples[0].remainingUses === 0 && afterFailure.geneticsLab.tissueSamples[0].status === 'depleted' && afterFailure.geneticsLab.tissueSamples[0].depletedAt && !afterFailure.geneticsLab.geneticExtracts.length, 'Valid failure must consume and deplete without extract')
assert(gameStateReducer(afterFailure, { type: 'extraction/attempted', attempt: { ...failure, id: 'fourth' } }) === afterFailure, 'Depleted sample must block further attempts')

const good = createTissueSample(plant, state.player.id, 40, 2, now, () => 1, () => 'good')!
let threeUseState = { ...state, geneticsLab: { ...state.geneticsLab, tissueSamples: [good], geneticExtracts: [], extractionAttemptIds: [] } }
for (let index = 1; index <= 3; index += 1) {
  const attempt = createExtractionAttempt(threeUseState.geneticsLab, good.id, 'flowering', 50, state.player.id, now + 10 + index, () => 1, () => `three-use-${index}`)!
  threeUseState = gameStateReducer(threeUseState, { type: 'extraction/attempted', attempt })
}
assert(threeUseState.geneticsLab.tissueSamples[0].remainingUses === 0 && threeUseState.geneticsLab.tissueSamples[0].status === 'depleted', 'Three-use sample must deplete exactly on its third attempt')
assert(!createExtractionAttempt(threeUseState.geneticsLab, good.id, 'flowering', 50, state.player.id, now + 20, () => 0), 'Fourth attempt against a three-use sample must be impossible')
assert(createExtractionAttempt({ ...state.geneticsLab, tissueSamples: [sample] }, sample.id, 'size', 50, state.player.id, now + 21, () => 0), 'Extraction must not require the donor to remain owned')

assert(resolveExtractPotency({ ...sample, donorQuantitativeGenetics: { ...sample.donorQuantitativeGenetics, vigor: 90 } }, 'vigor', 50, 50, 3, false, () => .5) > resolveExtractPotency({ ...sample, donorQuantitativeGenetics: { ...sample.donorQuantitativeGenetics, vigor: 30 } }, 'vigor', 50, 50, 3, false, () => .5), 'Donor stat must influence potency')
assert(resolveExtractionQuality({ ...sample, quality: 80 }, 80, 4, false, () => .5) > resolveExtractionQuality({ ...sample, quality: 30 }, 50, 3, false, () => .5), 'Sample quality, skill, and lab must influence extraction quality')
assert(resolveExtractPotency({ ...sample, donorQuantitativeGenetics: { ...sample.donorQuantitativeGenetics, vigor: 100 } }, 'vigor', 100, 99, 5, false, () => 0) < 100, 'Perfect donor stat must not guarantee perfect potency')

console.log('Extraction verification passed')
