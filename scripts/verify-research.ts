import { getNpcSaleValue } from '../src/features/marketplace/sellModel'
import { XP_THRESHOLDS, getLevelFromXp } from '../src/features/progression/progressionModel'
import { analyzeCloneLine, compareCloneLines, createGeneticsResearchState, observeCloneLine, projectGeneticKnowledge } from '../src/features/research/researchModel'
import { GENETICS_RESEARCH_REWARDS, researchDiscoveryMilestoneIds } from '../src/features/research/researchConfig'
import { createInitialGameState, gameStateReducer, type CollectedPlant } from '../src/game/gameState'
import type { GeneticFeatureState } from '../src/types/geneticFeature'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const carrier: GeneticFeatureState = {
  featureId: 'variegation',
  genotype: { kind: 'allelic', alleles: ['feature', 'standard'] },
  expressed: false,
  expressionStrength: 0,
  stability: 'variable',
  origin: 'inherited',
}
const visibleMutation: GeneticFeatureState = {
  featureId: 'crested',
  genotype: { kind: 'presence', state: 'present' },
  expressed: true,
  expressionStrength: 72,
  stability: 'variable',
  origin: 'spontaneous',
}

function specimen(id: string, cloneLineId = `clone-${id}`, features: GeneticFeatureState[] = []): CollectedPlant {
  return {
    id,
    cloneLineId,
    ownerId: 'local-player',
    speciesId: 'echinopsis-pachanoi',
    stage: 'mature',
    plantedAt: '2026-01-01T00:00:00.000Z',
    lastUpdatedAt: '2026-01-02T00:00:00.000Z',
    collectedAt: '2026-01-02T00:00:00.000Z',
    genetics: { vigor: 50, growthSpeed: 55, size: 60, flowering: 45, mutationChance: 30 },
    geneticFeatures: features,
    specialVariants: [],
    isHarvestable: false,
    isListedForSale: false,
  }
}

const first = specimen('first', 'clone-shared', [carrier, visibleMutation])
const research = createGeneticsResearchState()
const observed = observeCloneLine(research, first, 1000)
assert(observed.changed && observed.research.records[first.cloneLineId].analysisDepth === 'observed', 'First observation should create an observed record')
assert(observed.xpAwarded === GENETICS_RESEARCH_REWARDS.firstObservation
  + GENETICS_RESEARCH_REWARDS.firstSpeciesResearch
  + GENETICS_RESEARCH_REWARDS.firstGenusResearch
  + GENETICS_RESEARCH_REWARDS.firstVisibleFeatureResearch, 'First observation should award each new milestone once')
const firstTimestamp = observed.research.records[first.cloneLineId].firstAnalyzedAt
const levelOneKnowledge = projectGeneticKnowledge(first, observed.research.records[first.cloneLineId], 1)
assert(levelOneKnowledge.visibleFeatures.some((feature) => feature.name === 'Crested / Cristate'), 'Level 1 should see an expressed mutation')
assert(levelOneKnowledge.carrierFeatures.length === 0, 'Level 1 must not see carrier state')

const repeated = observeCloneLine(observed.research, first, 2000)
assert(!repeated.changed && repeated.xpAwarded === 0, 'Repeated observation should not award XP')
assert(repeated.research.records[first.cloneLineId].firstAnalyzedAt === firstTimestamp, 'First analyzed timestamp must remain unchanged')
const physicalClone = specimen('cutting', 'clone-shared', [carrier, visibleMutation])
assert(!observeCloneLine(observed.research, physicalClone, 3000).changed, 'Another specimen from the same clone line must share research')

const different = specimen('different')
const observedDifferent = observeCloneLine(observed.research, different, 3000)
assert(observedDifferent.changed && observedDifferent.xpAwarded === GENETICS_RESEARCH_REWARDS.firstObservation, 'A different clone line should earn independent observation XP')
const newSpecies = { ...specimen('new-species'), speciesId: 'lophophora-williamsii' }
const observedSpecies = observeCloneLine(observedDifferent.research, newSpecies, 3500)
assert(observedSpecies.xpAwarded === GENETICS_RESEARCH_REWARDS.firstObservation
  + GENETICS_RESEARCH_REWARDS.firstSpeciesResearch
  + GENETICS_RESEARCH_REWARDS.firstGenusResearch, 'First species and centralized genus should each reward once')
const repeatedSpecies = observeCloneLine(observedSpecies.research, { ...specimen('same-species'), speciesId: 'lophophora-williamsii' }, 3600)
assert(repeatedSpecies.xpAwarded === GENETICS_RESEARCH_REWARDS.firstObservation, 'Species and genus rewards must be idempotent')

const basic = analyzeCloneLine(observed.research, first, 10, 4000)
const inheritance = analyzeCloneLine(basic.research, first, 20, 5000)
const belowCarrier = projectGeneticKnowledge(first, inheritance.research.records[first.cloneLineId], 29)
assert(belowCarrier.carrierFeatures.length === 0, 'Carrier must remain hidden below Level 30')
const carrierAnalysis = analyzeCloneLine(inheritance.research, first, 30, 6000)
const carrierKnowledge = projectGeneticKnowledge(first, carrierAnalysis.research.records[first.cloneLineId], 30)
assert(carrierKnowledge.carrierFeatures.some((feature) => feature.name === 'Variegation'), 'Level 30 carrier analysis should reveal a stored carrier')

const secondFeatureClone = specimen('second-feature', undefined, [visibleMutation])
const featureRepeat = observeCloneLine(observed.research, secondFeatureClone, 7000)
assert(featureRepeat.xpAwarded === GENETICS_RESEARCH_REWARDS.firstObservation, 'Known visible mutation discovery must not reward twice')

const visibleMonstrose = { ...visibleMutation, featureId: 'monstrose' }
const visibleMelted = { ...visibleMutation, featureId: 'melted' }
const multiFeature = specimen('multi', undefined, [carrier, visibleMutation, visibleMonstrose, visibleMelted])
const multiObserved = observeCloneLine(createGeneticsResearchState(), multiFeature, 7500)
assert(multiObserved.xpAwarded === GENETICS_RESEARCH_REWARDS.firstObservation
  + GENETICS_RESEARCH_REWARDS.firstSpeciesResearch
  + GENETICS_RESEARCH_REWARDS.firstGenusResearch
  + (3 * GENETICS_RESEARCH_REWARDS.firstVisibleFeatureResearch)
  + GENETICS_RESEARCH_REWARDS.firstVisibleTwoFeatureSpecimen
  + GENETICS_RESEARCH_REWARDS.firstVisibleThreeFeatureSpecimen, 'Three visible features should unlock both multi-feature milestones')
assert(!multiObserved.research.completedDiscoveryMilestoneIds.includes(researchDiscoveryMilestoneIds.visibleFeature('variegation')), 'Hidden carrier must not create a visible feature milestone')

const shinyHybrid = { ...specimen('shiny-hybrid'), isHybrid: true, specialVariants: [{ variantId: 'shiny' as const, origin: 'random' as const, establishedAt: '2026-01-01T00:00:00.000Z' }] }
const specialObserved = observeCloneLine(observed.research, shinyHybrid, 8000)
const specialRepeated = observeCloneLine(specialObserved.research, shinyHybrid, 9000)
assert(specialObserved.xpAwarded === GENETICS_RESEARCH_REWARDS.firstObservation + GENETICS_RESEARCH_REWARDS.firstShinyResearch + GENETICS_RESEARCH_REWARDS.firstHybridResearch, 'First Shiny and hybrid research should award configured firsts')
assert(!specialRepeated.changed && specialRepeated.xpAwarded === 0, 'Shiny and hybrid research firsts must be idempotent')

const comparisonLocked = compareCloneLines(observedSpecies.research, first, different, 4)
const comparison = compareCloneLines(observedSpecies.research, first, different, 5)
const arbitraryPair = compareCloneLines(comparison.research, different, specimen('third'), 5)
const crossSpecies = compareCloneLines(arbitraryPair.research, first, newSpecies, 5)
const repeatedCrossSpecies = compareCloneLines(crossSpecies.research, different, newSpecies, 5)
assert(!comparisonLocked.changed && comparison.xpAwarded === GENETICS_RESEARCH_REWARDS.firstCloneComparison, 'First comparison should unlock at Level 5 and reward once')
assert(!arbitraryPair.changed && arbitraryPair.xpAwarded === 0, 'New arbitrary clone pairs must not award ongoing XP')
assert(crossSpecies.xpAwarded === GENETICS_RESEARCH_REWARDS.firstCrossSpeciesComparison && !repeatedCrossSpecies.changed, 'Cross-species comparison should reward globally once')

let state = createInitialGameState(1000)
state = {
  ...state,
  ownedPlants: [first],
  player: { ...state.player, skills: { ...state.player.skills, genetics: { xp: 80 } } },
}
const cultivationBefore = state.player.skills.cultivation.xp
const breedingBefore = state.player.skills.breeding.xp
const journalBefore = state.speciesDiscoveries
const stateObserved = gameStateReducer(state, { type: 'research/observed', plantId: first.id, now: 10_000 })
assert(stateObserved.player.skills.genetics.xp > state.player.skills.genetics.xp, 'Research should update Genetics XP')
assert(stateObserved.player.skills.cultivation.xp === cultivationBefore && stateObserved.player.skills.breeding.xp === breedingBefore, 'Research must not alter other skills')
assert(stateObserved.levelUpNotice?.skillId === 'genetics' && getLevelFromXp(stateObserved.player.skills.genetics.xp) > 1, 'Research level-up notice should identify Genetics')
assert(stateObserved.speciesDiscoveries === journalBefore, 'Research must not alter Field Journal species records')

const saleValue = getNpcSaleValue(first)
assert(saleValue !== null, 'Verification specimen should be sellable')
const sold = gameStateReducer(stateObserved, { type: 'plant/sold-to-npc', plantId: first.id, expectedValue: saleValue, now: 11_000 })
assert(sold.geneticsResearch.records[first.cloneLineId], 'Selling must preserve research history')
assert(projectGeneticKnowledge(undefined, sold.geneticsResearch.records[first.cloneLineId], 1).visibleFeatures.some((feature) => feature.name === 'Crested / Cristate'), 'Historical knowledge should remain readable without ownership')
assert(!analyzeCloneLine(sold.geneticsResearch, undefined, 99, 12_000).changed, 'Deeper analysis must require an owned specimen')

const levelTenXp = XP_THRESHOLDS[9]
const guaranteedPrototypeXp = (9 * GENETICS_RESEARCH_REWARDS.firstObservation)
  + (2 * GENETICS_RESEARCH_REWARDS.firstSpeciesResearch)
  + (2 * GENETICS_RESEARCH_REWARDS.firstGenusResearch)
  + GENETICS_RESEARCH_REWARDS.firstCloneComparison
  + GENETICS_RESEARCH_REWARDS.firstCrossSpeciesComparison
const rarePrototypeXp = (6 * GENETICS_RESEARCH_REWARDS.firstVisibleFeatureResearch)
  + GENETICS_RESEARCH_REWARDS.firstShinyResearch
  + GENETICS_RESEARCH_REWARDS.firstVisibleTwoFeatureSpecimen
  + GENETICS_RESEARCH_REWARDS.firstVisibleThreeFeatureSpecimen
assert(guaranteedPrototypeXp === 285 && guaranteedPrototypeXp + rarePrototypeXp === 745, 'Prototype Level-1 XP pools should stay explicit')
assert(Math.ceil((levelTenXp - guaranteedPrototypeXp) / GENETICS_RESEARCH_REWARDS.firstObservation) === 58, 'Baseline prototype should need 58 additional clone observations for Level 10')
assert(Math.ceil((levelTenXp - guaranteedPrototypeXp - rarePrototypeXp) / GENETICS_RESEARCH_REWARDS.firstObservation) === 28, 'All current rare firsts should reduce the gap to 28 additional clones')

console.log('Research verification passed')
