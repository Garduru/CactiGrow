import { and, desc, eq, sql } from 'drizzle-orm'
import type { CactiGrowDatabase } from '../db/client/database.ts'
import { bredSeeds, cloneLines, geneticProfiles, plantSpecimens, playerGardenSpecimens, playerGrowerEvents, playerOnboarding, playerPlantLifecycleVersions, playerProfiles, playerSeedStacks } from '../db/schema/index.ts'
import { ApiError } from '../api/errors.ts'
import type { StartingCommand, StartingExperienceV1 } from '../../shared/api/startingExperienceV1.ts'
import { findArea } from '../../shared/world/world.ts'
import { establishCommoditySeedGenetics, GENETIC_ESTABLISHMENT_RULE_VERSION, GENETIC_REPRESENTATION_VERSION, VISUAL_DERIVATION_VERSION } from '../gameplay/plantLifecycleRules.ts'
import { loadStartingState, lockStartingOwner, saveStartingState, STARTING_EVENT, TUTORIAL_ORIGIN, type StartingTransaction } from './startingState.ts'
import { retiredTutorialMaterial } from './StartingResetService.ts'

export const TUTORIAL_SPECIES = 'echinopsis-pachanoi'
export const TUTORIAL_GROWTH_MS = 15_000
export class StartingExperienceService {
  private readonly database: CactiGrowDatabase
  private readonly now: () => Date
  constructor(database: CactiGrowDatabase, now = () => new Date()) { this.database = database; this.now = now }
  private async load(tx: StartingTransaction, playerId: string) {
    const owner = await lockStartingOwner(tx, playerId)
    const state = await loadStartingState(tx, playerId, owner.profileId)
    const [profile] = await tx.select({ playerId: playerProfiles.playerId }).from(playerProfiles).where(eq(playerProfiles.playerId, playerId)).limit(1)
    if (state.revision === 0) state.nameComplete = !!profile
    return state
  }
  private async reconcile(tx: StartingTransaction, playerId: string, state: StartingExperienceV1) {
    let changed = false
    if (state.compatibilityComplete || !state.nameComplete || !state.appearanceComplete) return state
    if (state.spawnStage === 'collect-pot' && state.pot && this.now().getTime() >= Date.parse(state.pot.readyAt)) {
      state.spawnStage = 'collect-ready'; changed = true
    }
    if (state.farmStage === 'nursery') {
      // A real planting after the current Farm arrival; old occupied beds do not satisfy a reset lesson.
      const [arrival] = await tx.select({ occurredAt: playerGrowerEvents.occurredAt }).from(playerGrowerEvents)
        .where(and(eq(playerGrowerEvents.playerId, playerId), eq(playerGrowerEvents.eventType, STARTING_EVENT), sql`${playerGrowerEvents.payload}->>'farmStage' = 'nursery'`))
        .orderBy(desc(sql`(${playerGrowerEvents.payload}->>'revision')::integer`)).limit(1)
      const retired = await retiredTutorialMaterial(tx, playerId)
      const candidates = arrival ? await tx.select({ id: plantSpecimens.id }).from(playerGrowerEvents)
        .innerJoin(plantSpecimens, and(eq(plantSpecimens.ownerPlayerId, playerId), sql`${plantSpecimens.cloneLineId}::text = ${playerGrowerEvents.payload}->>'cloneLineId'`))
        .where(and(eq(playerGrowerEvents.playerId, playerId), eq(playerGrowerEvents.eventType, 'plantSeed'), sql`${playerGrowerEvents.occurredAt} >= ${arrival.occurredAt}`)) : []
      const planted = candidates.find(p => !retired.retiredSpecimenIds.includes(p.id))
      if (planted) { state.farmStage = 'garden'; state.farmSeedAvailable = false; changed = true }
    }
    if (state.farmStage === 'garden' && state.tutorialParentIds[0]) {
      const [metadata] = await tx.select().from(playerGardenSpecimens).where(and(eq(playerGardenSpecimens.playerId, playerId), eq(playerGardenSpecimens.specimenId, state.tutorialParentIds[0]))).limit(1)
      if (metadata?.favorite) {
        if (state.tutorialParentIds.length === 1) state.tutorialParentIds.push(await this.createSample(tx, playerId, this.now(), true))
        state.farmStage = 'lab'; changed = true; await this.incrementLifecycle(tx, playerId)
      }
    }
    if (state.farmStage === 'research') {
      const [observed] = await tx.select({ payload: playerGrowerEvents.payload }).from(playerGrowerEvents).where(and(eq(playerGrowerEvents.playerId, playerId), eq(playerGrowerEvents.eventType, 'specimen-observed'), sql`${playerGrowerEvents.payload}->>'specimenId' = ${state.tutorialParentIds[0]}`)).limit(1)
      if (observed) { state.farmStage = 'breeding'; changed = true }
    }
    if (state.farmStage === 'breeding' && state.tutorialParentIds.length === 2) {
      const [seed] = await tx.select({ id: bredSeeds.id }).from(bredSeeds).where(and(eq(bredSeeds.ownerPlayerId, playerId), eq(bredSeeds.parent1SpecimenId, state.tutorialParentIds[0]), eq(bredSeeds.parent2SpecimenId, state.tutorialParentIds[1]))).limit(1)
      if (seed) {
        state.offspringSeedId = seed.id; state.farmStage = 'complete'; state.farmTutorialComplete = true; changed = true
        await tx.update(playerOnboarding).set({ tutorialCompletedAt: this.now(), version: sql`${playerOnboarding.version} + 1` }).where(eq(playerOnboarding.playerId, playerId))
      }
    }
    if (changed) await saveStartingState(tx, playerId, state, crypto.randomUUID(), this.now())
    return state
  }
  read(playerId: string) { return this.database.transaction(async tx => this.reconcile(tx, playerId, await this.load(tx, playerId))) }
  execute(playerId: string, command: StartingCommand) {
    return this.database.transaction(async tx => {
      const state = await this.reconcile(tx, playerId, await this.load(tx, playerId))
      const fingerprint = JSON.stringify(command)
      const [receipt] = await tx.select({ payload: playerGrowerEvents.payload }).from(playerGrowerEvents).where(and(eq(playerGrowerEvents.playerId, playerId), eq(playerGrowerEvents.eventType, STARTING_EVENT), eq(playerGrowerEvents.sourceCommandId, command.commandId))).limit(1)
      if (receipt) {
        if ((receipt.payload as { fingerprint?: string }).fingerprint !== fingerprint) throw ApiError.conflict('Tutorial command ID was already used.')
        return state
      }
      if (!state.nameComplete) throw ApiError.conflict('Choose your character name first.')
      if (command.type === 'save-appearance') {
        if (state.appearanceComplete) throw ApiError.conflict('Appearance setup is already complete.')
        state.appearance = command.appearance; state.appearanceComplete = true; state.spawnStage = 'meet-guide'
        await tx.update(playerOnboarding).set({ tutorialStartedAt: this.now(), version: sql`${playerOnboarding.version} + 1` }).where(eq(playerOnboarding.playerId, playerId))
      } else if (command.type === 'visit-lab') {
        const [location] = await tx.select({ payload: playerGrowerEvents.payload }).from(playerGrowerEvents).where(and(eq(playerGrowerEvents.playerId, playerId), eq(playerGrowerEvents.eventType, 'world-foundation-location-v1'))).orderBy(desc(sql`(${playerGrowerEvents.payload}->>'revision')::integer`)).limit(1)
        if ((location?.payload as { areaId?: string } | undefined)?.areaId !== 'player-farm' || state.farmStage !== 'lab') throw ApiError.conflict('Visit the Genetics Lab during your Farm introduction.')
        // Facility admission is recorded separately; it never fabricates GeneticKnowledge.
        state.farmStage = 'research'
      } else if (command.type === 'equip-tool') {
        if (command.itemId && !state.ownedEquipment.includes(command.itemId)) throw ApiError.forbidden()
        state.equipment.tool = command.itemId
        if (command.itemId && state.spawnStage === 'equip-tool') state.spawnStage = 'harvest-cactus'
      } else {
        if (state.compatibilityComplete || !state.appearanceComplete) throw ApiError.conflict('This tutorial action is unavailable.')
        const [location] = await tx.select({ payload: playerGrowerEvents.payload }).from(playerGrowerEvents).where(and(eq(playerGrowerEvents.playerId, playerId), eq(playerGrowerEvents.eventType, 'world-foundation-location-v1'))).orderBy(desc(sql`(${playerGrowerEvents.payload}->>'revision')::integer`)).limit(1)
        const areaId = (location?.payload as { areaId?: string } | undefined)?.areaId ?? 'starting-spawn-tutorial'
        if ('entityId' in command) {
          const entity = findArea(areaId)?.interactables?.find(e => e.entityId === command.entityId)
          const kind = command.type === 'talk-guide' ? 'npc' : command.type === 'harvest-plant' ? 'harvestable' : 'tutorial-pot'
          if (!entity || entity.kind !== kind || !entity.tutorial) throw ApiError.forbidden()
          if (command.type === 'talk-guide') {
            if (state.spawnStage !== 'meet-guide') throw ApiError.conflict('Mara has already given you the Field Knife. Follow your current objective.')
            state.ownedEquipment = ['field-knife']; state.spawnStage = 'equip-tool'
          } else if (command.type === 'harvest-plant') {
            if (state.spawnStage !== 'harvest-cactus' || state.equipment.tool !== 'field-knife') throw ApiError.conflict('Equip your Field Knife before harvesting this cactus.')
            if (entity.speciesId !== TUTORIAL_SPECIES || entity.seedYield !== 3 || entity.respawn !== 'once-per-player') throw ApiError.conflict('This harvest target is unavailable.')
            // Reserve one quest seed so normal planting/trading cannot strand onboarding.
            state.tutorialSeedAvailable = true; state.harvestingXp += 10; state.spawnStage = 'plant-pot'
            // A confirmed tutorial reset must not mint the ordinary economic reward again.
            // Retain historical checkpoints as its provenance instead of guessing which stacked seeds were spent.
            const [reward] = await tx.select({ id: playerGrowerEvents.id }).from(playerGrowerEvents).where(and(eq(playerGrowerEvents.playerId, playerId), eq(playerGrowerEvents.eventType, STARTING_EVENT),
              // Legacy controlled-harvest checkpoints retain stage/reservation/pot provenance.
              // Wild XP saved in the same skill must never suppress this once-account tutorial credit.
              sql`${playerGrowerEvents.payload}->>'compatibilityComplete' = 'false'`,
              sql`(${playerGrowerEvents.payload}->>'tutorialSeedAvailable' = 'true' OR ${playerGrowerEvents.payload}->>'spawnStage' IN ('plant-pot','collect-pot','collect-ready','leave-zone') OR jsonb_typeof(${playerGrowerEvents.payload}->'pot') = 'object')`)).limit(1)
            if (!reward) await tx.insert(playerSeedStacks).values({ playerId, speciesId: TUTORIAL_SPECIES, quantity: 2 }).onConflictDoUpdate({ target: [playerSeedStacks.playerId, playerSeedStacks.speciesId], set: { quantity: sql`${playerSeedStacks.quantity} + 2`, version: sql`${playerSeedStacks.version} + 1`, updatedAt: this.now() } })
            await this.incrementLifecycle(tx, playerId)
          } else if (command.type === 'plant-pot') {
            if (state.spawnStage !== 'plant-pot' || !state.tutorialSeedAvailable || state.pot) throw ApiError.conflict('The tutorial pot has already been planted or needs a tutorial seed.')
            const plantedAt = this.now(), specimenId = await this.createSample(tx, playerId, plantedAt, false)
            state.pot = { specimenId, plantedAt: plantedAt.toISOString(), readyAt: new Date(plantedAt.getTime() + TUTORIAL_GROWTH_MS).toISOString(), collectedAt: null, growthRule: 'starting-pot-15s-v1' }
            state.tutorialSeedAvailable = false; state.spawnStage = 'collect-pot'
          } else {
            if (!['collect-pot', 'collect-ready'].includes(state.spawnStage) || !state.pot || state.pot.collectedAt) throw ApiError.conflict('There is no tutorial plant to collect.')
            if (this.now().getTime() < Date.parse(state.pot.readyAt)) throw ApiError.conflict('Your tutorial plant is still growing.')
            const collectedAt = this.now()
            const [specimen] = await tx.update(plantSpecimens).set({ lifecycleStatus: 'owned', collectedAt, updatedAt: collectedAt, version: sql`${plantSpecimens.version} + 1` }).where(and(eq(plantSpecimens.id, state.pot.specimenId), eq(plantSpecimens.ownerPlayerId, playerId), eq(plantSpecimens.lifecycleStatus, 'growing'))).returning({ id: plantSpecimens.id })
            if (!specimen) throw ApiError.conflict('The tutorial plant cannot be collected.')
            state.pot.collectedAt = collectedAt.toISOString(); state.tutorialParentIds = [specimen.id]; state.spawnStage = 'leave-zone'
            await this.incrementLifecycle(tx, playerId)
          }
        }
      }
      await saveStartingState(tx, playerId, state, command.commandId, this.now(), fingerprint)
      return this.reconcile(tx, playerId, state)
    })
  }
  private async createSample(tx: StartingTransaction, playerId: string, now: Date, collected: boolean) {
    const cloneLineId = crypto.randomUUID(), specimenId = crypto.randomUUID(), genetics = establishCommoditySeedGenetics(TUTORIAL_SPECIES)!
    // Actual commodity baseline and durable specimen identity; no rare variants or invented genetics.
    await tx.insert(cloneLines).values({ id: cloneLineId, speciesId: TUTORIAL_SPECIES, originType: TUTORIAL_ORIGIN, originPlayerId: playerId, establishedAt: now, geneticRepresentationVersion: GENETIC_REPRESENTATION_VERSION, visualDerivationVersion: VISUAL_DERIVATION_VERSION, createdAt: now })
    await tx.insert(geneticProfiles).values({ cloneLineId, ...genetics, establishmentRuleVersion: GENETIC_ESTABLISHMENT_RULE_VERSION, createdAt: now })
    await tx.insert(plantSpecimens).values({ id: specimenId, ownerPlayerId: playerId, cloneLineId, sourceType: TUTORIAL_ORIGIN, lifecycleStatus: collected ? 'owned' : 'growing', plantedAt: now, collectedAt: collected ? now : null, visualDerivationVersion: VISUAL_DERIVATION_VERSION, createdAt: now, updatedAt: now })
    return specimenId
  }
  private async incrementLifecycle(tx: StartingTransaction, playerId: string) {
    await tx.insert(playerPlantLifecycleVersions).values({ playerId, version: 1 }).onConflictDoUpdate({ target: playerPlantLifecycleVersions.playerId, set: { version: sql`${playerPlantLifecycleVersions.version} + 1`, updatedAt: this.now() } })
  }
}
