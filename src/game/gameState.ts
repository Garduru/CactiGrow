import { canBreed, createBredSeed, hasValidGenetics, resolveOffspringSpecies } from '../features/breeding/breedingModel'
import { calculateNurseryGrowth, createInitialNurserySlots, createNurseryPlant, createNurseryPlantFromBredSeed, type NurserySlotState } from '../features/nursery/nurseryModel'
import { canCancelListing, canListPlant, getActiveListings, getListingForPlant } from '../features/marketplace/marketplaceModel'
import { canSellPlantToNpc, getNpcSaleValue } from '../features/marketplace/sellModel'
import { createAchievementProgress, evaluateAchievements, type ProgressionEventCounts } from '../features/achievements/achievementsModel'
import { awardSkillXp, getLevelFromXp } from '../features/progression/progressionModel'
import { SKILL_XP_REWARDS, type GameplayEventSource } from '../features/progression/rewardConfig'
import type { AchievementProgress } from '../types/achievement'
import type { BredSeed } from '../types/bredSeed'
import type { InventoryItem } from '../types/inventory'
import type { MarketplaceListing } from '../types/marketplace'
import type { Plant } from '../types/plant'
import type { PlayerState } from '../types/player'
import type { SkillId } from '../types/skill'
import { createSpeciesDiscoveries, discoverSpecies, getDiscoveredSpeciesCount, recordShinyDiscovery, type SpeciesDiscoveryObservation } from '../features/journal/journalModel'
import type { JournalStats, SpeciesDiscoveries } from '../types/journal'
import { createCloneLine, createInitialCloneLineRegistry, registerActiveSpecimen, registerCloneLine } from '../features/genetics/cloneLineModel'
import { hasValidGeneticFeatureStates, hasValidSpecialVariantStates } from '../features/genetics/geneticFeatureModel'
import type { CloneLineRegistry } from '../types/cloneLine'
import { getSpeciesById } from '../data/species'
import type { GeneticsResearchState } from '../types/research'
import { analyzeCloneLine, compareCloneLines, createGeneticsResearchState, observeCloneLine, recordExtractionMilestones, recordTissueSamplingMilestones, type ResearchResult } from '../features/research/researchModel'
import type { ExtractionAttempt, GeneticsLabState, GeneticsLabTierId, QuantitativeExtractTarget, TissueSample } from '../types/lab'
import { addTissueSample, canUpgradeLab, createGeneticsLabState, createTissueSample, getSampleQualityBand, getTissueSamplingStatus, normalizeTissueSample } from '../features/lab/labModel'
import { getLabTierDefinition } from '../features/lab/labConfig'
import { canExtractQuantitative, createExtractionAttempt, quantitativeExtractTargets } from '../features/lab/extractionModel'

export interface CollectedPlant extends Plant {
  collectedAt: string
}

export interface GameState {
  player: PlayerState
  inventory: InventoryItem[]
  nurserySlots: NurserySlotState[]
  ownedPlants: CollectedPlant[]
  bredSeeds: BredSeed[]
  marketplaceListings: MarketplaceListing[]
  achievements: AchievementProgress[]
  progressionEvents: ProgressionEventCounts
  levelUpNotice: { id: string; skillId: SkillId; oldLevel: number; newLevel: number } | null
  speciesDiscoveries: SpeciesDiscoveries
  journalStats: JournalStats
  cloneLines: CloneLineRegistry
  geneticsResearch: GeneticsResearchState
  geneticsLab: GeneticsLabState
}

export type GameAction =
  | { type: 'seed/planted'; slotId: string; speciesId: string; now: number }
  | { type: 'plant/collected'; slotId: string; now: number }
  | { type: 'inventory/added'; item: InventoryItem; now: number }
  | { type: 'inventory/removed'; itemId: string; quantity: number }
  | { type: 'offspring/created'; seed: BredSeed }
  | { type: 'bred-seed/planted'; slotId: string; seedId: string; now: number }
  | { type: 'plant/sold-to-npc'; plantId: string; expectedValue: number; now: number }
  | { type: 'marketplace/listed'; listing: MarketplaceListing }
  | { type: 'marketplace/cancelled'; listingId: string; now: number }
  | { type: 'research/observed'; plantId: string; now: number }
  | { type: 'research/analyzed'; plantId: string; now: number }
  | { type: 'research/compared'; firstPlantId: string; secondPlantId: string; now: number }
  | { type: 'lab/upgraded'; targetTier: GeneticsLabTierId; now: number }
  | { type: 'sample/collected'; sample: TissueSample }
  | { type: 'extraction/attempted'; attempt: ExtractionAttempt }
  | { type: 'progression/notice-dismissed'; noticeId: string }

export function createInitialGameState(now = Date.now()): GameState {
  const player: PlayerState = {
    id: 'local-player',
    username: 'Player',
    tokens: 1216,
    skills: {
      cultivation: { xp: 315 },
      breeding: { xp: 0 },
      genetics: { xp: 0 },
    },
  }
  const inventory: InventoryItem[] = [
    { id: 'seed-echinopsis-pachanoi', itemType: 'seed', itemKey: 'echinopsis-pachanoi', quantity: 4 },
    { id: 'seed-lophophora-williamsii', itemType: 'seed', itemKey: 'lophophora-williamsii', quantity: 2 },
  ]
  const nurserySlots = createInitialNurserySlots(now)
  const progressionEvents: ProgressionEventCounts = {
    plantSeed: 0,
    plantBredSeed: 0,
    collectPlant: 0,
    breedPlant: 0,
    npcSale: 0,
    marketplaceListing: 0,
  }
  const initialObservations: SpeciesDiscoveryObservation[] = [
    ...inventory
      .filter((item) => item.itemType === 'seed' && item.quantity > 0)
      .map((item) => ({ speciesId: item.itemKey, source: 'unknown' as const, sourceRef: item.id })),
    ...nurserySlots.flatMap((slot) => slot.plant
      ? [{ speciesId: slot.plant.speciesId, source: 'unknown' as const, sourceRef: slot.plant.id }]
      : []),
  ]
  const speciesDiscoveries = createSpeciesDiscoveries(initialObservations, now)
  const cloneLines = createInitialCloneLineRegistry(nurserySlots.flatMap((slot) => slot.plant ? [slot.plant] : []))
  const achievements = evaluateAchievements(
    createAchievementProgress(),
    progressionEvents,
    player.skills,
    getDiscoveredSpeciesCount(speciesDiscoveries),
    new Date(now).toISOString(),
  )

  return {
    player,
    inventory,
    nurserySlots,
    ownedPlants: [],
    bredSeeds: [],
    marketplaceListings: [],
    achievements,
    progressionEvents,
    levelUpNotice: null,
    speciesDiscoveries,
    journalStats: { shinyCloneLineIds: [] },
    cloneLines,
    geneticsResearch: createGeneticsResearchState(),
    geneticsLab: createGeneticsLabState(),
  }
}

function applyResearchResult(state: GameState, result: ResearchResult, occurredAt: number): GameState {
  if (!result.changed || result.xpAwarded <= 0) return state
  const oldLevel = getLevelFromXp(state.player.skills.genetics.xp)
  const skills = awardSkillXp(state.player.skills, 'genetics', result.xpAwarded)
  if (!skills) return state
  const newLevel = getLevelFromXp(skills.genetics.xp)
  const completedAt = new Date(occurredAt).toISOString()
  return {
    ...state,
    geneticsResearch: result.research,
    player: { ...state.player, skills },
    achievements: evaluateAchievements(
      state.achievements,
      state.progressionEvents,
      skills,
      getDiscoveredSpeciesCount(state.speciesDiscoveries),
      completedAt,
    ),
    levelUpNotice: newLevel > oldLevel
      ? { id: `genetics-research-${occurredAt}-${newLevel}`, skillId: 'genetics', oldLevel, newLevel }
      : state.levelUpNotice,
  }
}

export function recordGameplayEvent(
  state: GameState,
  source: GameplayEventSource,
  occurredAt: number,
): GameState {
  const progressionEvents = {
    ...state.progressionEvents,
    [source]: state.progressionEvents[source] + 1,
  }
  const completedAt = new Date(occurredAt).toISOString()
  const reward = SKILL_XP_REWARDS[source]
  const oldLevel = reward ? getLevelFromXp(state.player.skills[reward.skillId].xp) : null
  const skills = reward
    ? awardSkillXp(state.player.skills, reward.skillId, reward.amount)
    : state.player.skills
  if (!skills) return state
  const newLevel = reward ? getLevelFromXp(skills[reward.skillId].xp) : null

  return {
    ...state,
    player: { ...state.player, skills },
    progressionEvents,
    achievements: evaluateAchievements(
      state.achievements,
      progressionEvents,
      skills,
      getDiscoveredSpeciesCount(state.speciesDiscoveries),
      completedAt,
    ),
    levelUpNotice: reward && oldLevel !== null && newLevel !== null && newLevel > oldLevel
      ? { id: `${source}-${occurredAt}-${newLevel}`, skillId: reward.skillId, oldLevel, newLevel }
      : state.levelUpNotice,
  }
}

export function recordSpeciesDiscovery(
  state: GameState,
  observation: SpeciesDiscoveryObservation,
  discoveredAt: number,
): GameState {
  const speciesDiscoveries = discoverSpecies(state.speciesDiscoveries, observation, discoveredAt)
  if (speciesDiscoveries === state.speciesDiscoveries) return state
  const completedAt = new Date(discoveredAt).toISOString()
  return {
    ...state,
    speciesDiscoveries,
    achievements: evaluateAchievements(
      state.achievements,
      state.progressionEvents,
      state.player.skills,
      getDiscoveredSpeciesCount(speciesDiscoveries),
      completedAt,
    ),
  }
}

function recordEventWithDiscovery(
  state: GameState,
  source: GameplayEventSource,
  observation: SpeciesDiscoveryObservation,
  occurredAt: number,
): GameState {
  return recordGameplayEvent(recordSpeciesDiscovery(state, observation, occurredAt), source, occurredAt)
}

export function getSeedQuantity(state: GameState, speciesId: string): number {
  return state.inventory.find((item) => item.itemType === 'seed' && item.itemKey === speciesId)?.quantity ?? 0
}

export function getTotalSeedQuantity(state: GameState): number {
  return state.bredSeeds.length + state.inventory.reduce((total, item) => (
    item.itemType === 'seed' ? total + item.quantity : total
  ), 0)
}

export function canPlantSeed(state: GameState, slotId: string, speciesId: string): boolean {
  const slot = state.nurserySlots.find((entry) => entry.id === slotId)
  return Boolean(slot && !slot.plant && getSeedQuantity(state, speciesId) > 0)
}

export function canCollectPlant(state: GameState, slotId: string, now: number): boolean {
  const plant = state.nurserySlots.find((entry) => entry.id === slotId)?.plant
  return Boolean(plant && calculateNurseryGrowth(plant.plantedAt, now).isMature)
}

export function canPlantBredSeed(state: GameState, slotId: string, seedId: string): boolean {
  const slot = state.nurserySlots.find((entry) => entry.id === slotId)
  return Boolean(slot && !slot.plant && state.bredSeeds.some((seed) => seed.id === seedId))
}

export function breedPlants(state: GameState, parent1Id: string, parent2Id: string, now: number): BredSeed | null {
  const parent1 = state.ownedPlants.find((plant) => plant.id === parent1Id)
  const parent2 = state.ownedPlants.find((plant) => plant.id === parent2Id)
  return parent1 && parent2 ? createBredSeed(parent1, parent2, now) : null
}

export function collectTissueSampleForState(state: GameState, plantId: string, now: number): TissueSample | null {
  const plant = state.ownedPlants.find((specimen) => specimen.id === plantId)
  const level = getLevelFromXp(state.player.skills.genetics.xp)
  if (!plant || !getTissueSamplingStatus(state.geneticsLab, level, plant.id, now).available) return null
  return createTissueSample(plant, state.player.id, level, state.geneticsLab.tier, now)
}
export function extractFromSampleForState(state: GameState, sampleId: string, target: QuantitativeExtractTarget, now: number): ExtractionAttempt | null {
  return createExtractionAttempt(state.geneticsLab, sampleId, target, getLevelFromXp(state.player.skills.genetics.xp), state.player.id, now)
}

export { getActiveListings, getListingForPlant }

export function gameStateReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'seed/planted': {
      if (!canPlantSeed(state, action.slotId, action.speciesId)) return state
      const plant = createNurseryPlant(action.speciesId, action.now)
      const cloneLines = registerCloneLine(state.cloneLines, createCloneLine(
        plant.cloneLineId,
        plant.speciesId,
        plant.plantedAt,
        'unknown',
        plant.id,
        plant.ownerId,
      ))
      if (!cloneLines) return state

      return recordEventWithDiscovery({
        ...state,
        cloneLines,
        inventory: state.inventory.map((item) => (
          item.itemType === 'seed' && item.itemKey === action.speciesId
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )),
        nurserySlots: state.nurserySlots.map((slot) => (
          slot.id === action.slotId
            ? { ...slot, plant }
            : slot
        )),
      }, 'plantSeed', { speciesId: action.speciesId, source: 'unknown' }, action.now)
    }

    case 'plant/collected': {
      if (!canCollectPlant(state, action.slotId, action.now)) return state
      const plant = state.nurserySlots.find((slot) => slot.id === action.slotId)?.plant
      if (!plant) return state

      const collectedAt = new Date(action.now).toISOString()
      return recordEventWithDiscovery({
        ...state,
        nurserySlots: state.nurserySlots.map((slot) => (
          slot.id === action.slotId ? { ...slot, plant: null } : slot
        )),
        ownedPlants: [
          ...state.ownedPlants,
          {
            ...plant,
            stage: 'mature',
            lastUpdatedAt: collectedAt,
            isHarvestable: false,
            collectedAt,
          },
        ],
      }, 'collectPlant', { speciesId: plant.speciesId, source: 'unknown', sourceRef: plant.id }, action.now)
    }

    case 'inventory/added': {
      if (!Number.isFinite(action.item.quantity) || action.item.quantity <= 0) return state
      const existing = state.inventory.find((item) => item.id === action.item.id)
      if (existing && (existing.itemType !== action.item.itemType || existing.itemKey !== action.item.itemKey)) return state
      const nextState = {
        ...state,
        inventory: existing
          ? state.inventory.map((item) => item.id === action.item.id
            ? { ...item, quantity: item.quantity + action.item.quantity }
            : item)
          : [...state.inventory, action.item],
      }
      return action.item.itemType === 'seed'
        ? recordSpeciesDiscovery(nextState, {
          speciesId: action.item.itemKey,
          source: 'unknown',
          sourceRef: action.item.id,
        }, action.now)
        : nextState
    }

    case 'inventory/removed': {
      if (!Number.isFinite(action.quantity) || action.quantity <= 0) return state
      const item = state.inventory.find((entry) => entry.id === action.itemId)
      if (!item || item.quantity < action.quantity) return state
      return {
        ...state,
        inventory: state.inventory.map((entry) => entry.id === action.itemId
          ? { ...entry, quantity: entry.quantity - action.quantity }
          : entry),
      }
    }

    case 'offspring/created': {
      const [parent1Id, parent2Id] = action.seed.parentPlantIds
      const parent1 = state.ownedPlants.find((plant) => plant.id === parent1Id)
      const parent2 = state.ownedPlants.find((plant) => plant.id === parent2Id)
      if (!parent1 || !parent2 || !canBreed(parent1, parent2) || !hasValidGenetics(action.seed.genetics)) return state
      if (!hasValidGeneticFeatureStates(action.seed.geneticFeatures)
        || !hasValidSpecialVariantStates(action.seed.specialVariants)) return state
      if (!Number.isFinite(Date.parse(action.seed.createdAt))) return state
      const speciesResolution = resolveOffspringSpecies(parent1, parent2)
      if (!speciesResolution) return state
      if (action.seed.speciesId !== speciesResolution.speciesId) return state
      if (action.seed.isHybrid !== speciesResolution.isHybrid) return state
      if (action.seed.parentSpeciesIds[0] !== speciesResolution.parentSpeciesIds[0]
        || action.seed.parentSpeciesIds[1] !== speciesResolution.parentSpeciesIds[1]) return state
      if (state.bredSeeds.some((seed) => seed.id === action.seed.id)) return state
      if (action.seed.cloneLineId === action.seed.id
        || action.seed.cloneLineId === parent1.cloneLineId
        || action.seed.cloneLineId === parent2.cloneLineId) return state
      const cloneLines = registerCloneLine(state.cloneLines, createCloneLine(
        action.seed.cloneLineId,
        action.seed.speciesId,
        action.seed.createdAt,
        'bred',
        undefined,
        state.player.id,
        0,
      ))
      if (!cloneLines) return state
      return recordEventWithDiscovery(
        {
          ...state,
          cloneLines,
          bredSeeds: [...state.bredSeeds, action.seed],
          journalStats: recordShinyDiscovery(state.journalStats, action.seed.cloneLineId, action.seed.specialVariants),
        },
        'breedPlant',
        { speciesId: action.seed.speciesId, source: 'breeding', sourceRef: action.seed.id },
        Date.parse(action.seed.createdAt),
      )
    }

    case 'bred-seed/planted': {
      if (!canPlantBredSeed(state, action.slotId, action.seedId)) return state
      const seed = state.bredSeeds.find((entry) => entry.id === action.seedId)
      if (!seed) return state
      const cloneLines = registerActiveSpecimen(state.cloneLines, seed.cloneLineId)
      if (!cloneLines) return state
      return recordEventWithDiscovery({
        ...state,
        cloneLines,
        bredSeeds: state.bredSeeds.filter((entry) => entry.id !== action.seedId),
        nurserySlots: state.nurserySlots.map((slot) => slot.id === action.slotId
          ? { ...slot, plant: createNurseryPlantFromBredSeed(seed, action.now) }
          : slot),
      }, 'plantBredSeed', { speciesId: seed.speciesId, source: 'breeding', sourceRef: seed.id }, action.now)
    }

    case 'plant/sold-to-npc': {
      if (!canSellPlantToNpc(state, action.plantId)) return state
      const plant = state.ownedPlants.find((specimen) => specimen.id === action.plantId)
      if (!plant) return state
      const saleValue = getNpcSaleValue(plant)
      if (saleValue === null || saleValue !== action.expectedValue) return state
      const nextTokens = state.player.tokens + saleValue
      if (!Number.isSafeInteger(nextTokens) || nextTokens < 0) return state

      return recordGameplayEvent({
        ...state,
        player: { ...state.player, tokens: nextTokens },
        ownedPlants: state.ownedPlants.filter((specimen) => specimen.id !== action.plantId),
      }, 'npcSale', action.now)
    }

    case 'marketplace/listed': {
      const { listing } = action
      if (listing.sellerId !== state.player.id) return state
      if (!listing.id || listing.status !== 'active' || !Number.isFinite(Date.parse(listing.createdAt))) return state
      if (!canListPlant(state, listing.plantId, listing.askingPrice)) return state
      if (state.marketplaceListings.some((entry) => entry.id === listing.id)) return state
      const plant = state.ownedPlants.find((specimen) => specimen.id === listing.plantId)
      if (!plant) return state

      return recordGameplayEvent({
        ...state,
        ownedPlants: state.ownedPlants.map((specimen) => specimen.id === listing.plantId
          ? { ...specimen, isListedForSale: true }
          : specimen),
        marketplaceListings: [...state.marketplaceListings, listing],
      }, 'marketplaceListing', Date.parse(listing.createdAt))
    }

    case 'marketplace/cancelled': {
      if (!canCancelListing(state, action.listingId)) return state
      const listing = state.marketplaceListings.find((entry) => entry.id === action.listingId)
      if (!listing) return state
      const cancelledAt = new Date(action.now).toISOString()

      return {
        ...state,
        ownedPlants: state.ownedPlants.map((specimen) => specimen.id === listing.plantId
          ? { ...specimen, isListedForSale: false }
          : specimen),
        marketplaceListings: state.marketplaceListings.map((entry) => entry.id === action.listingId
          ? { ...entry, status: 'cancelled', cancelledAt }
          : entry),
      }
    }

    case 'research/observed': {
      const plant = state.ownedPlants.find((specimen) => specimen.id === action.plantId)
      if (!plant) return state
      return applyResearchResult(state, observeCloneLine(state.geneticsResearch, plant, action.now), action.now)
    }

    case 'research/analyzed': {
      const plant = state.ownedPlants.find((specimen) => specimen.id === action.plantId)
      const geneticsLevel = getLevelFromXp(state.player.skills.genetics.xp)
      return applyResearchResult(
        state,
        analyzeCloneLine(state.geneticsResearch, plant, geneticsLevel, action.now),
        action.now,
      )
    }

    case 'research/compared': {
      const first = state.ownedPlants.find((specimen) => specimen.id === action.firstPlantId)
      const second = state.ownedPlants.find((specimen) => specimen.id === action.secondPlantId)
      const geneticsLevel = getLevelFromXp(state.player.skills.genetics.xp)
      return applyResearchResult(
        state,
        compareCloneLines(state.geneticsResearch, first, second, geneticsLevel),
        action.now,
      )
    }

    case 'lab/upgraded': {
      if (!canUpgradeLab(state.geneticsLab, action.targetTier, state.player.tokens)) return state
      const cost = getLabTierDefinition(action.targetTier).cost
      const timestamp = new Date(action.now).toISOString()
      return {
        ...state,
        player: { ...state.player, tokens: state.player.tokens - cost },
        geneticsLab: { ...state.geneticsLab, tier: action.targetTier, installedAt: state.geneticsLab.installedAt ?? timestamp, upgradedAt: timestamp },
      }
    }

    case 'sample/collected': {
      const plant = state.ownedPlants.find((specimen) => specimen.id === action.sample.donorSpecimenId)
      const sampleTime = Date.parse(action.sample.collectedAt)
      const level = getLevelFromXp(state.player.skills.genetics.xp)
      if (!plant
        || !action.sample.id
        || !Number.isFinite(sampleTime)
        || action.sample.collectorId !== state.player.id
        || action.sample.donorCloneLineId !== plant.cloneLineId
        || action.sample.donorSpeciesId !== plant.speciesId
        || !getSpeciesById(action.sample.donorSpeciesId)
        || !state.cloneLines[plant.cloneLineId]
        || action.sample.sampleType !== 'stem-tissue'
        || action.sample.status !== 'stored'
        || action.sample.initialUses < 1
        || action.sample.initialUses > 3
        || action.sample.remainingUses !== action.sample.initialUses
        || !Number.isFinite(action.sample.quality)
        || action.sample.quality < 0
        || action.sample.quality > 100
        || action.sample.qualityBand !== getSampleQualityBand(action.sample.quality)
        || !getTissueSamplingStatus(state.geneticsLab, level, plant.id, sampleTime).available) return state
      const geneticsLab = addTissueSample(state.geneticsLab, action.sample)
      if (!geneticsLab) return state
      const nextState = { ...state, geneticsLab }
      const milestoneResult = recordTissueSamplingMilestones(state.geneticsResearch, plant.cloneLineId, action.sample.qualityBand)
      return milestoneResult.changed ? applyResearchResult(nextState, milestoneResult, sampleTime) : nextState
    }

    case 'extraction/attempted': {
      const storedSample = state.geneticsLab.tissueSamples.find((entry) => entry.id === action.attempt.sampleId)
      const sample = storedSample ? normalizeTissueSample(storedSample) : undefined
      const level = getLevelFromXp(state.player.skills.genetics.xp)
      if (!sample || !canExtractQuantitative(state.geneticsLab, level, sample) || !quantitativeExtractTargets.includes(action.attempt.target) || state.geneticsLab.extractionAttemptIds.includes(action.attempt.id)) return state
      const extract = action.attempt.extract
      if ((action.attempt.outcome === 'failure' && extract) || (action.attempt.outcome !== 'failure' && !extract)) return state
      if (extract && (extract.sourceTissueSampleId !== sample.id || extract.target !== action.attempt.target || extract.donorSpecimenId !== sample.donorSpecimenId || extract.donorCloneLineId !== sample.donorCloneLineId || extract.donorSpeciesId !== sample.donorSpeciesId || extract.researcherId !== state.player.id || state.geneticsLab.geneticExtracts.some((entry) => entry.id === extract.id))) return state
      const remainingUses = sample.remainingUses - 1
      const geneticsLab = { ...state.geneticsLab, tissueSamples: state.geneticsLab.tissueSamples.map((entry) => entry.id === sample.id ? { ...entry, remainingUses, status: remainingUses === 0 ? 'depleted' as const : 'stored' as const, depletedAt: remainingUses === 0 ? action.attempt.attemptedAt : undefined } : entry), geneticExtracts: extract ? [...state.geneticsLab.geneticExtracts, extract] : state.geneticsLab.geneticExtracts, extractionAttemptIds: [...state.geneticsLab.extractionAttemptIds, action.attempt.id] }
      const nextState = { ...state, geneticsLab }
      if (!extract) return nextState
      const milestones = recordExtractionMilestones(state.geneticsResearch, extract.target, extract.outcome, extract.extractionQualityBand)
      return milestones.changed ? applyResearchResult(nextState, milestones, Date.parse(action.attempt.attemptedAt)) : nextState
    }

    case 'progression/notice-dismissed': {
      if (state.levelUpNotice?.id !== action.noticeId) return state
      return { ...state, levelUpNotice: null }
    }
  }
}
