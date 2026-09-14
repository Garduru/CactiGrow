import { createCloneLine } from '../src/features/genetics/cloneLineModel'
import { createBredSeed } from '../src/features/breeding/breedingModel'
import { getLevelFromXp, XP_THRESHOLDS } from '../src/features/progression/progressionModel'
import { getTreatmentExpressionProbability, MEANINGFUL_TREATMENT_GAIN, resolveQuantitativeTreatment } from '../src/features/lab/treatmentModel'
import { MOCK_GROWTH_DURATION_MS } from '../src/features/nursery/nurseryModel'
import { createInitialGameState, gameStateReducer, type CollectedPlant, type GameState } from '../src/game/gameState'
import type { BredSeed } from '../src/types/bredSeed'
import type { GeneticExtract, TissueSample } from '../src/types/lab'

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message) }
const now = Date.UTC(2026, 0, 1)
const seed: BredSeed = { id: 'seed-treated', speciesId: 'echinopsis-pachanoi', cloneLineId: 'clone-seed-treated', createdAt: new Date(now).toISOString(), genetics: { vigor: 20, growthSpeed: 51, size: 52, flowering: 53, mutationChance: 10 }, parentPlantIds: ['parent-a', 'parent-b'], parentSpeciesIds: ['echinopsis-pachanoi', 'echinopsis-pachanoi'], isHybrid: false, geneticFeatures: [], specialVariants: [{ variantId: 'shiny', origin: 'random', establishedAt: new Date(now).toISOString() }] }
const sample: TissueSample = { id: 'sample-1', donorSpecimenId: 'donor-1', donorCloneLineId: 'donor-line', donorSpeciesId: 'echinopsis-pachanoi', collectorId: 'local-player', collectedAt: new Date(now).toISOString(), sampleType: 'stem-tissue', quality: 100, qualityBand: 'excellent', donorQuantitativeGenetics: { vigor: 77, growthSpeed: 50, size: 50, flowering: 50, mutationChance: 1 }, initialUses: 3, remainingUses: 2, status: 'stored' }
const extract: GeneticExtract = { id: 'extract-1', category: 'quantitative', target: 'vigor', sourceTissueSampleId: sample.id, donorSpecimenId: sample.donorSpecimenId, donorCloneLineId: sample.donorCloneLineId, donorSpeciesId: sample.donorSpeciesId, researcherId: 'local-player', createdAt: new Date(now).toISOString(), outcome: 'success', extractionQuality: 100, extractionQualityBand: 'excellent', potency: 100, status: 'stored' }
function readyState(): GameState { const base = createInitialGameState(now); return { ...base, player: { ...base.player, skills: { ...base.player.skills, genetics: { xp: XP_THRESHOLDS[49] } } }, bredSeeds: [seed], geneticsLab: { ...base.geneticsLab, tier: 3, tissueSamples: [sample], geneticExtracts: [extract] }, cloneLines: { ...base.cloneLines, [seed.cloneLineId]: createCloneLine(seed.cloneLineId, seed.speciesId, seed.createdAt, 'bred', undefined, base.player.id, 0) } } }

const ready = readyState()
const belowLevel = { ...ready, player: { ...ready.player, skills: { ...ready.player.skills, genetics: { xp: XP_THRESHOLDS[48] } } } }
assert(getLevelFromXp(belowLevel.player.skills.genetics.xp) === 49 && gameStateReducer(belowLevel, { type: 'treatment/applied', extractId: extract.id, seedId: seed.id, treatmentId: 'treatment-1', now }) === belowLevel, 'Genetics below 50 must reject without consumption')
const belowTier = { ...ready, geneticsLab: { ...ready.geneticsLab, tier: 2 as const } }
assert(gameStateReducer(belowTier, { type: 'treatment/applied', extractId: extract.id, seedId: seed.id, treatmentId: 'treatment-1', now }) === belowTier, 'Lab below Tier 3 must reject')
assert(gameStateReducer(ready, { type: 'treatment/applied', extractId: 'missing', seedId: seed.id, treatmentId: 'bad', now }) === ready, 'Invalid application must consume nothing')
assert(gameStateReducer(ready, { type: 'treatment/applied', extractId: extract.id, seedId: 'generic-stack-id', treatmentId: 'bad', now }) === ready, 'Stackable generic seeds cannot be treated')

const applied = gameStateReducer(ready, { type: 'treatment/applied', extractId: extract.id, seedId: seed.id, treatmentId: 'treatment-1', now })
const treatedSeed = applied.bredSeeds[0]
const treatment = treatedSeed.quantitativeTreatments?.[0]
assert(treatment?.status === 'pending' && treatment.target === extract.target && treatment.extractId === extract.id && treatment.sourceTissueSampleId === sample.id && treatment.donorSpecimenId === sample.donorSpecimenId && treatment.donorCloneLineId === sample.donorCloneLineId && treatment.donorSpeciesId === sample.donorSpeciesId, 'Application must create one pending treatment with full provenance')
assert(JSON.stringify(treatedSeed.genetics) === JSON.stringify(seed.genetics), 'Application must not immediately change seed genetics')
assert(applied.geneticsLab.geneticExtracts[0].status === 'consumed' && applied.geneticsLab.geneticExtracts[0].consumedBySeedId === seed.id, 'Extract must be consumed historically exactly once')
assert(gameStateReducer(applied, { type: 'treatment/applied', extractId: extract.id, seedId: seed.id, treatmentId: 'treatment-2', now: now + 1 }) === applied, 'Consumed extract and treated seed must reject reuse')
assert(applied.player.skills.genetics.xp - ready.player.skills.genetics.xp === 75, 'First application and target milestones must award 75 Genetics XP')

assert(getTreatmentExpressionProbability(treatment) < 1, 'Treatment can never guarantee expression')
const noEffect = resolveQuantitativeTreatment(treatment, 20, now + 1, .99, .5)!
assert(noEffect.resolution?.gain === 0 && noEffect.resolution.finalValue === 20, 'Injected no-effect roll must produce no gain')
const highStart = resolveQuantitativeTreatment({ ...treatment, id: 'high' }, 99, now + 1, 0, .999)!
assert(highStart.resolution!.finalValue <= 100 && highStart.resolution!.gain <= 1, 'Near-100 stat must be headroom limited')

const planted = gameStateReducer(applied, { type: 'bred-seed/planted', slotId: applied.nurserySlots[5].id, seedId: seed.id, now: now + 2, treatmentRolls: [0, .999] })
const plant = planted.nurserySlots[5].plant!
const resolution = plant.quantitativeTreatments?.[0].resolution
assert(!planted.bredSeeds.length && resolution && resolution.gain >= MEANINGFUL_TREATMENT_GAIN && resolution.finalValue === plant.genetics.vigor, 'Planting must consume seed and resolve a deterministic meaningful gain once')
assert(plant.genetics.vigor < 100 && plant.genetics.vigor !== sample.donorQuantitativeGenetics.vigor, 'Donor stat must not be assigned and potency 100 must not guarantee 100')
assert(plant.genetics.growthSpeed === seed.genetics.growthSpeed && plant.genetics.size === seed.genetics.size && plant.genetics.flowering === seed.genetics.flowering && plant.genetics.mutationChance === seed.genetics.mutationChance, 'Non-target quantitative stats must remain unchanged')
assert(plant.speciesId === seed.speciesId && plant.cloneLineId === seed.cloneLineId && plant.isHybrid === seed.isHybrid && JSON.stringify(plant.parentPlantIds) === JSON.stringify(seed.parentPlantIds) && JSON.stringify(plant.geneticFeatures) === JSON.stringify(seed.geneticFeatures) && JSON.stringify(plant.specialVariants) === JSON.stringify(seed.specialVariants), 'Identity, lineage, features, hybrid, and Shiny must remain unchanged')
const anotherSeed = { ...seed, id: 'another-seed', cloneLineId: 'another-line', quantitativeTreatments: undefined }
const anotherExtract = { ...extract, id: 'another-extract' }
const duplicateTreatmentIdState = { ...planted, bredSeeds: [anotherSeed], geneticsLab: { ...planted.geneticsLab, geneticExtracts: [...planted.geneticsLab.geneticExtracts, anotherExtract] } }
assert(gameStateReducer(duplicateTreatmentIdState, { type: 'treatment/applied', extractId: anotherExtract.id, seedId: anotherSeed.id, treatmentId: treatment.id, now: now + 3 }) === duplicateTreatmentIdState, 'Treatment IDs already present in Nursery history must not be reusable')
assert(gameStateReducer(planted, { type: 'bred-seed/planted', slotId: planted.nurserySlots[4].id, seedId: seed.id, now: now + 3, treatmentRolls: [0, 0] }) === planted, 'Reopening or duplicate planting cannot reroll')
assert(planted.player.skills.cultivation.xp - applied.player.skills.cultivation.xp === 15 && planted.player.skills.breeding.xp === applied.player.skills.breeding.xp, 'Only normal planting Cultivation XP may occur')
assert(planted.player.skills.genetics.xp - applied.player.skills.genetics.xp === 70, 'First expression and meaningful gain must award 70 Genetics XP')

const collected = gameStateReducer(planted, { type: 'plant/collected', slotId: planted.nurserySlots[5].id, now: now + MOCK_GROWTH_DURATION_MS + 3 })
const mature = collected.ownedPlants.find((entry) => entry.id === seed.id)!
assert(JSON.stringify(mature.quantitativeTreatments) === JSON.stringify(plant.quantitativeTreatments) && mature.genetics.vigor === plant.genetics.vigor, 'Collection must preserve resolved treatment without reroll')
const other: CollectedPlant = { ...mature, id: 'other-parent', cloneLineId: 'other-line', quantitativeTreatments: undefined, specialVariants: [], genetics: { ...mature.genetics, vigor: 40 } }
const offspring = createBredSeed(mature, other, now + MOCK_GROWTH_DURATION_MS + 4, () => .5, () => 'offspring', () => 'offspring-line')!
assert(!offspring.quantitativeTreatments && offspring.genetics.vigor >= Math.min(mature.genetics.vigor, other.genetics.vigor) && offspring.genetics.vigor <= Math.max(mature.genetics.vigor, other.genetics.vigor), 'Offspring must use normal resolved-stat inheritance without inheriting treatment record')

console.log('Treatment verification passed')
