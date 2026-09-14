import { createBredSeed } from '../src/features/breeding/breedingModel'
import { createExtractionAttempt } from '../src/features/lab/extractionModel'
import { createTissueSample } from '../src/features/lab/labModel'
import { getNpcSaleValue } from '../src/features/marketplace/sellModel'
import { createMarketplaceListing } from '../src/features/marketplace/marketplaceModel'
import { MOCK_GROWTH_DURATION_MS } from '../src/features/nursery/nurseryModel'
import { GARDEN_ORGANIZED_BEDS_UPGRADE_ID, NURSERY_EXPANDED_BENCHES_UPGRADE_ID } from '../src/features/property/propertyConfig'
import { XP_THRESHOLDS } from '../src/features/progression/progressionModel'
import { createInitialGameState, gameStateReducer } from '../src/game/gameState'

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message) }
function sequence(values: number[]) { let index = 0; return () => values[index++] ?? .5 }

const startedAt = Date.UTC(2026, 0, 1)
let state = createInitialGameState(startedAt)
const initialTokens = state.player.tokens
const initialSeedQuantity = state.inventory[0].quantity

state = gameStateReducer(state, { type: 'seed/planted', slotId: 'slot-4', speciesId: 'echinopsis-pachanoi', now: startedAt })
const normalPlant = state.nurserySlots[3].plant!
assert(state.inventory[0].quantity === initialSeedQuantity - 1 && normalPlant.speciesId === 'echinopsis-pachanoi', 'Normal seed must become exactly one Nursery specimen')
assert(state.player.skills.cultivation.xp === 325, 'Normal planting must award 10 Cultivation XP')
assert(gameStateReducer(state, { type: 'seed/planted', slotId: 'slot-4', speciesId: 'echinopsis-pachanoi', now: startedAt }) === state, 'Occupied-slot replay must consume nothing')

state = gameStateReducer(state, { type: 'plant/collected', slotId: 'slot-4', now: startedAt + MOCK_GROWTH_DURATION_MS + 1 })
state = gameStateReducer(state, { type: 'plant/collected', slotId: 'slot-3', now: startedAt + MOCK_GROWTH_DURATION_MS + 1 })
const firstParent = state.ownedPlants.find((plant) => plant.id === normalPlant.id)!
const secondParent = state.ownedPlants.find((plant) => plant.id === 'demo-mature')!
assert(firstParent.cloneLineId === normalPlant.cloneLineId && state.nurserySlots[3].plant === null, 'Collection must preserve identity and clear Nursery once')

const bredSeed = createBredSeed(firstParent, secondParent, startedAt + MOCK_GROWTH_DURATION_MS + 2, () => .5, () => 'loop-seed', () => 'loop-seed-line')!
const parentsBefore = JSON.stringify(state.ownedPlants)
state = gameStateReducer(state, { type: 'offspring/created', seed: bredSeed })
assert(state.bredSeeds.length === 1 && JSON.stringify(state.ownedPlants) === parentsBefore && state.cloneLines[bredSeed.cloneLineId], 'Breeding must add one unique seed and preserve parents')
assert(state.player.skills.breeding.xp === 40, 'Breeding must award 40 XP once')
assert(gameStateReducer(state, { type: 'offspring/created', seed: bredSeed }) === state, 'Duplicate offspring submission must be rejected')

state = { ...state, player: { ...state.player, skills: { ...state.player.skills, genetics: { xp: XP_THRESHOLDS[49] } } }, geneticsLab: { ...state.geneticsLab, tier: 3 } }
state = gameStateReducer(state, { type: 'research/observed', plantId: firstParent.id, now: startedAt + 200_000 })
const sample = createTissueSample(firstParent, state.player.id, 50, 3, startedAt + 201_000, () => .8, () => 'loop-sample')!
state = gameStateReducer(state, { type: 'sample/collected', sample })
const donorBeforeLab = state.ownedPlants.find((plant) => plant.id === firstParent.id)!
const attempt = createExtractionAttempt(state.geneticsLab, sample.id, 'vigor', 50, state.player.id, startedAt + 202_000, sequence([0, .9, .8, .8]), () => 'loop-attempt', () => 'loop-extract')!
state = gameStateReducer(state, { type: 'extraction/attempted', attempt })
assert(state.geneticsLab.tissueSamples[0].remainingUses === sample.remainingUses - 1 && state.geneticsLab.geneticExtracts[0].sourceTissueSampleId === sample.id, 'Extraction must consume one use and preserve provenance')
assert(JSON.stringify(state.ownedPlants.find((plant) => plant.id === firstParent.id)) === JSON.stringify(donorBeforeLab), 'Sampling and extraction must not mutate donor')

const seedGeneticsBeforeTreatment = JSON.stringify(state.bredSeeds[0].genetics)
state = gameStateReducer(state, { type: 'treatment/applied', extractId: 'loop-extract', seedId: bredSeed.id, treatmentId: 'loop-treatment', now: startedAt + 203_000 })
assert(state.geneticsLab.geneticExtracts[0].status === 'consumed' && JSON.stringify(state.bredSeeds[0].genetics) === seedGeneticsBeforeTreatment, 'Treatment application must consume extract without resolving genetics')
state = gameStateReducer(state, { type: 'bred-seed/planted', slotId: 'slot-4', seedId: bredSeed.id, now: startedAt + 204_000, treatmentRolls: [0, .8] })
const treatedNurseryPlant = state.nurserySlots[3].plant!
assert(treatedNurseryPlant.cloneLineId === bredSeed.cloneLineId && treatedNurseryPlant.quantitativeTreatments?.[0].status === 'resolved', 'Treated planting must preserve seed clone line and resolve once')
const treatmentSnapshot = JSON.stringify(treatedNurseryPlant.quantitativeTreatments)
state = gameStateReducer(state, { type: 'plant/collected', slotId: 'slot-4', now: startedAt + 204_000 + MOCK_GROWTH_DURATION_MS + 1 })
const treatedParent = state.ownedPlants.find((plant) => plant.id === bredSeed.id)!
assert(JSON.stringify(treatedParent.quantitativeTreatments) === treatmentSnapshot, 'Treatment provenance must survive collection without reroll')

const descendant = createBredSeed(treatedParent, firstParent, startedAt + 400_000, () => .5, () => 'loop-descendant', () => 'loop-descendant-line')!
assert(!descendant.quantitativeTreatments && descendant.parentPlantIds[0] === treatedParent.id && descendant.cloneLineId !== treatedParent.cloneLineId, 'Treated parent must breed normally without transferring treatment record')

const listing = createMarketplaceListing(treatedParent, state.player.id, 123, startedAt + 401_000, () => 'loop-listing')!
state = gameStateReducer(state, { type: 'marketplace/listed', listing })
assert(state.ownedPlants.find((plant) => plant.id === treatedParent.id)?.isListedForSale, 'Marketplace listing must synchronize specimen state')
state = gameStateReducer(state, { type: 'marketplace/cancelled', listingId: listing.id, now: startedAt + 402_000 })
assert(!state.ownedPlants.find((plant) => plant.id === treatedParent.id)?.isListedForSale, 'Cancellation must restore specimen state')
const activeBeforeSale = state.cloneLines[treatedParent.cloneLineId].localStats.activeKnownSpecimens
const saleValue = getNpcSaleValue(treatedParent)!
state = gameStateReducer(state, { type: 'plant/sold-to-npc', plantId: treatedParent.id, expectedValue: saleValue, now: startedAt + 403_000 })
assert(!state.ownedPlants.some((plant) => plant.id === treatedParent.id) && state.player.tokens === initialTokens + saleValue, 'NPC sale must remove once and credit exact Tokens')
assert(state.cloneLines[treatedParent.cloneLineId].localStats.activeKnownSpecimens === activeBeforeSale - 1 && state.geneticsLab.geneticExtracts[0].consumedBySeedId === treatedParent.id, 'Sale must update active count while preserving treatment provenance chain')
assert(gameStateReducer(state, { type: 'plant/sold-to-npc', plantId: treatedParent.id, expectedValue: saleValue, now: startedAt + 404_000 }) === state, 'Double sale must be rejected')

state = { ...state, player: { ...state.player, tokens: 2_000, skills: { ...state.player.skills, cultivation: { xp: XP_THRESHOLDS[9] } } } }
state = gameStateReducer(state, { type: 'property/upgraded', upgradeId: NURSERY_EXPANDED_BENCHES_UPGRADE_ID, now: startedAt + 500_000 })
state = gameStateReducer(state, { type: 'property/upgraded', upgradeId: GARDEN_ORGANIZED_BEDS_UPGRADE_ID, now: startedAt + 500_001 })
assert(state.property.buildings.nursery.level === 2 && state.nurserySlots.length === 8 && state.property.buildings.garden.level === 2 && state.player.tokens === 950, 'Property upgrades must atomically charge 500 and 550 Tokens and unlock effects')

console.log('Gameplay loop verification passed')
