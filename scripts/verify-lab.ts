import { createTissueSample, getSampleQualityBand, resolveSampleQuality } from '../src/features/lab/labModel'
import { TISSUE_SAMPLING_COOLDOWN_MS } from '../src/features/lab/labConfig'
import { getNpcSaleValue } from '../src/features/marketplace/sellModel'
import { XP_THRESHOLDS } from '../src/features/progression/progressionModel'
import { createInitialGameState, gameStateReducer, type CollectedPlant } from '../src/game/gameState'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const startedAt = Date.UTC(2026, 0, 1)
let state = createInitialGameState(startedAt)
const source = state.nurserySlots[0].plant!
const donor: CollectedPlant = { ...source, stage: 'mature', collectedAt: new Date(startedAt).toISOString() }
state = { ...state, ownedPlants: [donor] }
const plantSnapshot = JSON.stringify(donor)

const lockedSample = createTissueSample(donor, state.player.id, 1, state.geneticsLab.tier, startedAt, () => 0.5, () => 'locked')!
const lockedState = gameStateReducer(state, { type: 'sample/collected', sample: lockedSample })
assert(lockedState === state && !lockedState.geneticsLab.tissueSamples.length && lockedState.player.skills.genetics.xp === 0, 'Level below 40 must not sample or mutate cooldown')

state = { ...state, player: { ...state.player, skills: { ...state.player.skills, genetics: { xp: XP_THRESHOLDS[39] } } } }
const noLabState = gameStateReducer(state, { type: 'sample/collected', sample: lockedSample })
assert(noLabState === state, 'Level 40 still requires the Microscope Station')

const tokensBefore = state.player.tokens
const tierOne = gameStateReducer(state, { type: 'lab/upgraded', targetTier: 1, now: startedAt })
assert(tierOne.geneticsLab.tier === 1 && tierOne.player.tokens === tokensBefore - 250, 'Tier 1 should charge exactly once')
const duplicateTier = gameStateReducer(tierOne, { type: 'lab/upgraded', targetTier: 1, now: startedAt })
assert(duplicateTier === tierOne, 'Duplicate lab upgrade must be rejected')
const tierTwo = gameStateReducer(tierOne, { type: 'lab/upgraded', targetTier: 2, now: startedAt })
assert(tierTwo.geneticsLab.tier === 2 && tierTwo.player.tokens === tokensBefore - 1000, 'Sequential Tier 2 upgrade should charge configured cost')
const skipped = gameStateReducer(tierTwo, { type: 'lab/upgraded', targetTier: 4, now: startedAt })
assert(skipped === tierTwo && skipped.player.tokens >= 0, 'Skipped or unaffordable upgrades must charge nothing')

assert(getSampleQualityBand(resolveSampleQuality(40, 2, () => 0)) === 'poor', 'Low deterministic roll should produce Poor at minimum capability')
assert(getSampleQualityBand(resolveSampleQuality(40, 2, () => 0.5)) === 'standard', 'Middle deterministic roll should produce Standard at minimum capability')
assert(getSampleQualityBand(resolveSampleQuality(40, 2, () => 1)) === 'good', 'High deterministic roll should produce Good at minimum capability')
assert(getSampleQualityBand(resolveSampleQuality(99, 5, () => 1)) === 'excellent', 'High-level and high-tier deterministic roll should reach Excellent')

const sample = createTissueSample(donor, tierTwo.player.id, 40, 2, startedAt + 1000, () => 0.5, () => 'sample-1')!
const xpBefore = tierTwo.player.skills.genetics.xp
const sampled = gameStateReducer(tierTwo, { type: 'sample/collected', sample })
assert(sampled.geneticsLab.tissueSamples.length === 1, 'Successful sampling should create exactly one sample')
assert(sample.donorSpecimenId === donor.id && sample.donorCloneLineId === donor.cloneLineId && sample.donorSpeciesId === donor.speciesId, 'Sample must preserve donor provenance')
assert(sample.quality === 48 && sample.qualityBand === 'standard' && sample.status === 'stored' && sample.remainingUses === 2, 'Quality and uses should resolve once and remain stored')
assert(JSON.stringify(sampled.ownedPlants[0]) === plantSnapshot, 'Sampling must leave donor plant unchanged')
assert(sampled.player.skills.genetics.xp - xpBefore === 40, 'First sample and first sampled clone line should award 40 Genetics XP')
const duplicate = gameStateReducer(sampled, { type: 'sample/collected', sample: { ...sample, id: 'sample-fast-repeat' } })
assert(duplicate === sampled, 'Immediate double submit must create no second sample or XP')

const futureTime = startedAt + 1000 + TISSUE_SAMPLING_COOLDOWN_MS
const laterSample = createTissueSample(donor, sampled.player.id, 40, 2, futureTime, () => 0.5, () => 'sample-2')!
const sampledAgain = gameStateReducer(sampled, { type: 'sample/collected', sample: laterSample })
assert(sampledAgain.geneticsLab.tissueSamples.length === 2 && sampledAgain.player.skills.genetics.xp === sampled.player.skills.genetics.xp, 'Post-cooldown repeat should store a sample without recurring XP')

const physicalClone = { ...donor, id: 'physical-clone' }
const cloneState = { ...sampled, ownedPlants: [...sampled.ownedPlants, physicalClone] }
const cloneSample = createTissueSample(physicalClone, cloneState.player.id, 40, 2, startedAt + 2000, () => 0.5, () => 'sample-clone')!
const sampledClone = gameStateReducer(cloneState, { type: 'sample/collected', sample: cloneSample })
assert(sampledClone.geneticsLab.tissueSamples.length === 2, 'A second physical specimen should have an independent cooldown')
assert(sampledClone.player.skills.genetics.xp === sampled.player.skills.genetics.xp, 'Same clone line must not repeat clone-line sampling XP')

const researched = gameStateReducer(sampled, { type: 'research/observed', plantId: donor.id, now: futureTime + 1 })
const saleValue = getNpcSaleValue(donor)!
const sold = gameStateReducer(researched, { type: 'plant/sold-to-npc', plantId: donor.id, expectedValue: saleValue, now: futureTime + 2 })
assert(sold.geneticsLab.tissueSamples.length === 1 && sold.geneticsLab.tissueSamples[0].donorSpecimenId === donor.id, 'Selling donor must preserve sample and provenance')
assert(sold.geneticsResearch.records[donor.cloneLineId], 'Selling donor must preserve research record')

console.log('Lab verification passed')
