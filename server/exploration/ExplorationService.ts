import type { MovementPort } from '../movement/movementPort.ts'
import { readInteractionAuthority } from '../movement/interactionProximity.ts'
import { movementNavigation } from '../movement/movementRules.ts'
import { and, desc, eq, sql } from 'drizzle-orm'
import type { CactiGrowDatabase } from '../db/client/database.ts'
import { cloneLines, geneticProfiles, cloneLineVariants, wildGeneticSeeds, playerGrowerEvents, playerPlantLifecycleVersions, playerProfiles, playerSeedStacks } from '../db/schema/index.ts'
import { ApiError } from '../api/errors.ts'
import { WORLD, findArea, initialLocation, isWorldLocation } from '../../shared/world/world.ts'
import type { WorldInteractable } from '../../shared/world/types.ts'
import { EXPLORATION_INTERACTION_RADIUS, isExplorationCommandV1, isExplorationDevCommandV1, isExplorationRestoreCommandV1, type ExplorationCommandV1, type ExplorationDevCommandV1, type ExplorationRestoreCommandV1, type ExplorationProjectionV1, type ExplorationResultV1, type ExplorationRewardV1 } from '../../shared/api/explorationV1.ts'
import type { StartingExperienceV1 } from '../../shared/api/startingExperienceV1.ts'
import { loadStartingState, lockStartingOwner, saveStartingState, type StartingTransaction } from '../starting/startingState.ts'
import { EXPLORATION_EVENT, loadExplorationState, saveExplorationState, type ExplorationCheckpoint } from './explorationState.ts'
import { validateExplorationReach } from './explorationReach.ts'
import { addXp } from '../../src/features/progression/progressionModel.ts'
import { establishCommoditySeedGenetics } from '../gameplay/plantLifecycleRules.ts'
import { projectFieldSurvey } from '../quests/FieldSurveyService.ts'
import { WILD_SOURCES, WILD_FIND_TUNING, resolveWildFind, resolveWildSeed, wildSourceParents } from './wildSources.ts'
import type { WildSeedLotV1 } from '../../shared/api/wildGeneticsV1.ts'

const WORLD_EVENT = 'world-foundation-location-v1'
const areas = () => WORLD.areas.filter(a => a.zoneId === 'first-basin' && !['farm', 'town'].includes(a.areaType))
function rollYield(min: number, max: number) {
  const range = max - min + 1, ceiling = Math.floor(0x100000000 / range) * range, values = new Uint32Array(1)
  do { crypto.getRandomValues(values) } while (values[0] >= ceiling)
  return min + values[0] % range
}
function supportedNode(node: WorldInteractable) {
  return node.kind === 'harvestable' && !node.tutorial && node.resourceType === 'seed-pod' && node.rewardTable === 'commodity-seeds'
    && !!node.speciesId && !!establishCommoditySeedGenetics(node.speciesId) && node.respawn === 'player-cooldown'
    && Number.isSafeInteger(node.minYield) && node.minYield! >= 3 && Number.isSafeInteger(node.maxYield) && node.maxYield! <= 10 && node.maxYield! >= node.minYield!
    && Number.isSafeInteger(node.harvestingXp) && node.harvestingXp! > 0 && node.harvestingXp! <= 100
    && Number.isSafeInteger(node.respawnSeconds) && node.respawnSeconds! >= 60 && node.respawnSeconds! <= 86400
    && (node.requiredToolId === null || node.requiredToolId === 'field-knife') && node.rareRollEligible === false
}
export class ExplorationService {
  private readonly movement?: MovementPort
  private readonly database: CactiGrowDatabase
  private readonly environment: string
  private readonly now: () => Date
  private readonly yield: (min: number, max: number) => number
  private readonly random: () => number
  constructor(database: CactiGrowDatabase, options: { movement?: MovementPort; environment: string; now?: () => Date; rollYield?: (min: number, max: number) => number; random?: () => number }) {
    this.random = options.random ?? (() => crypto.getRandomValues(new Uint32Array(1))[0] / 0x100000000)
    this.movement = options.movement; this.database = database; this.environment = options.environment; this.now = options.now ?? (() => new Date()); this.yield = options.rollYield ?? rollYield
  }
  private assertEnvironment(dev = false) {
    if (!(dev ? ['staging', 'development'] : ['staging', 'production', 'test']).includes(this.environment)) throw ApiError.notFound('API route not found.')
  }
  private async load(tx: StartingTransaction, playerId: string) {
    const owner = await lockStartingOwner(tx, playerId)
    const [profile] = await tx.select({ publicId: playerProfiles.publicId }).from(playerProfiles).where(eq(playerProfiles.playerId, playerId)).limit(1)
    if (!profile) throw ApiError.conflict('Choose your character name before exploring.')
    const starting = await loadStartingState(tx, playerId, owner.profileId)
    if (starting.revision === 0) starting.nameComplete = true
    // The established-account bridge grants ownership only. Equipping remains the existing explicit Inventory action.
    if (starting.compatibilityComplete && !starting.ownedEquipment.includes('field-knife')) {
      starting.ownedEquipment.push('field-knife')
      await saveStartingState(tx, playerId, starting, crypto.randomUUID(), this.now())
    }
    return { owner, publicId: profile.publicId, starting, state: await loadExplorationState(tx, playerId) }
  }
  private project(state: ExplorationCheckpoint, starting: StartingExperienceV1): ExplorationProjectionV1 {
    return { projectionVersion: 1, revision: state.revision, serverNow: this.now().toISOString(), harvestingXp: starting.harvestingXp,
      nodes: areas().flatMap(a => (a.interactables ?? []).filter(supportedNode).map(n => ({ entityId: n.entityId, areaId: a.areaId, readyAt: state.cooldowns[n.entityId] ?? null }))),
      landmarks: areas().flatMap(a => (a.landmarks ?? []).map(l => ({ landmarkId: l.landmarkId, areaId: a.areaId, discoveredAt: state.landmarks[l.landmarkId] ?? null }))),
      notes: areas().flatMap(a => (a.interactables ?? []).filter(n => n.kind === 'inspectable' && n.noteId).map(n => ({ noteId: n.noteId!, areaId: a.areaId, discoveredAt: state.notes[n.noteId!] ?? null }))),
      populations: WILD_SOURCES.filter(s => state.collectedPopulations?.[s.populationId] || s.landmarkId && state.landmarks[s.landmarkId]).map(s => ({ populationId: s.populationId, label: `${s.region} ${s.speciesId === 'echinopsis-pachanoi' ? 'San Pedro' : 'Peyote'}`, observedAt: s.landmarkId ? state.landmarks[s.landmarkId] ?? null : null, collectedAt: state.collectedPopulations?.[s.populationId] ?? null })) }
  }
  private async result(tx: StartingTransaction, playerId: string, state: ExplorationCheckpoint, starting: StartingExperienceV1, reward?: ExplorationRewardV1): Promise<ExplorationResultV1> {
    return { projection: this.project(state, starting), starting, fieldSurvey: await projectFieldSurvey(tx, playerId, starting, state), ...(reward ? { reward } : {}) }
  }
  async read(playerId: string): Promise<ExplorationResultV1> {
    this.assertEnvironment()
    return this.database.transaction(async tx => { const { state, starting } = await this.load(tx, playerId); return this.result(tx, playerId, state, starting) })
  }
  async inspect(playerId: string): Promise<ExplorationResultV1> {
    this.assertEnvironment(true)
    return this.database.transaction(async tx => { const { state, starting } = await this.load(tx, playerId); return this.result(tx, playerId, state, starting) })
  }
  async inspectGenetics(playerId: string) {
    this.assertEnvironment(true)
    const result = await this.inspect(playerId)
    const seeds = await this.database.select().from(wildGeneticSeeds).where(eq(wildGeneticSeeds.ownerPlayerId, playerId)).orderBy(desc(wildGeneticSeeds.createdAt)).limit(100)
    const receipts = await this.database.select().from(playerGrowerEvents).where(and(eq(playerGrowerEvents.playerId, playerId), eq(playerGrowerEvents.eventType, 'wild-genetic-harvest-receipt-v1'))).orderBy(desc(playerGrowerEvents.occurredAt)).limit(30)
    return { ...result, sources: WILD_SOURCES.map(source => ({ ...source, sourceData: { uncommon: wildSourceParents(source, 'uncommon').map(p => ({ genetics: p.genetics, geneticFeatures: p.geneticFeatures })), rare: wildSourceParents(source, 'rare').map(p => ({ genetics: p.genetics, geneticFeatures: p.geneticFeatures })) } })), tuning: WILD_FIND_TUNING, seeds, receipts }
  }
  async restoreEntry(playerId: string, command: ExplorationRestoreCommandV1): Promise<ExplorationResultV1> {
    this.assertEnvironment()
    if (!isExplorationRestoreCommandV1(command)) throw ApiError.validation('Invalid exploration entry command.')
    return this.database.transaction(async tx => {
      const { state, starting, publicId } = await this.load(tx, playerId), fingerprint = JSON.stringify({ type: 'restore-entry', ...command })
      const [receipt] = await tx.select({ payload: playerGrowerEvents.payload }).from(playerGrowerEvents)
        .where(and(eq(playerGrowerEvents.playerId, playerId), eq(playerGrowerEvents.eventType, EXPLORATION_EVENT), eq(playerGrowerEvents.sourceCommandId, command.commandId))).limit(1)
      if (receipt) {
        if ((receipt.payload as { fingerprint: string }).fingerprint !== fingerprint) throw ApiError.conflict('Exploration command ID was already used.')
        return this.result(tx, playerId, state, starting)
      }
      const [event] = await tx.select({ payload: playerGrowerEvents.payload }).from(playerGrowerEvents)
        .where(and(eq(playerGrowerEvents.playerId, playerId), eq(playerGrowerEvents.eventType, WORLD_EVENT))).orderBy(desc(sql`(${playerGrowerEvents.payload}->>'revision')::integer`)).limit(1)
      const location = isWorldLocation(event?.payload) ? event.payload : initialLocation(publicId)
      if (location.revision !== command.expectedWorldRevision) throw ApiError.conflict('Your location changed. Reload the world.')
      const area = findArea(location.areaId)!, spawn = area.spawns.find(s => s.entryId === location.entryId)!, now = this.now()
      // Reload/relogin already restores this exact authored entry in WorldService/Phaser.
      // Start its movement plausibility window anew, without clearing resources or discoveries.
      state.anchor = { areaId: area.areaId, worldRevision: location.revision, position: { x: spawn.x, y: spawn.y }, at: now.toISOString() }
      await saveExplorationState(tx, playerId, state, command.commandId, now, fingerprint)
      return this.result(tx, playerId, state, starting)
    })
  }
  async execute(playerId: string, command: ExplorationCommandV1): Promise<ExplorationResultV1> {
    this.assertEnvironment()
    if (!isExplorationCommandV1(command)) throw ApiError.validation('Invalid exploration command.')
    return this.database.transaction(async tx => {
      const { state, starting, owner, publicId } = await this.load(tx, playerId), now = this.now(), fingerprint = JSON.stringify(command)
      const [receipt] = await tx.select({ payload: playerGrowerEvents.payload }).from(playerGrowerEvents)
        .where(and(eq(playerGrowerEvents.playerId, playerId), eq(playerGrowerEvents.eventType, EXPLORATION_EVENT), eq(playerGrowerEvents.sourceCommandId, command.commandId))).limit(1)
      if (receipt) {
        const saved = receipt.payload as { fingerprint: string; reward?: ExplorationRewardV1 }
        if (saved.fingerprint !== fingerprint) throw ApiError.conflict('Exploration command ID was already used.')
        return this.result(tx, playerId, state, starting, saved.reward)
      }
      if (!starting.nameComplete || !starting.appearanceComplete || !starting.spawnTutorialComplete || !starting.farmTutorialComplete) throw ApiError.conflict('Complete your Farm introduction before exploring farther.')
      const [event] = await tx.select({ payload: playerGrowerEvents.payload, occurredAt: playerGrowerEvents.occurredAt }).from(playerGrowerEvents)
        .where(and(eq(playerGrowerEvents.playerId, playerId), eq(playerGrowerEvents.eventType, WORLD_EVENT))).orderBy(desc(sql`(${playerGrowerEvents.payload}->>'revision')::integer`)).limit(1)
      const location = isWorldLocation(event?.payload) ? event.payload : initialLocation(publicId)
      if (location.revision !== command.expectedWorldRevision) throw ApiError.conflict('Your location changed. Reload the world.')
      const authority = this.movement ? await readInteractionAuthority(tx, playerId, this.movement) : null
      const position = authority?.position ?? command.position
      const area = findArea(location.areaId)!
      if (!areas().some(a => a.areaId === area.areaId)) throw ApiError.forbidden()
      const landmark = command.type === 'discover-landmark' ? area.landmarks?.find(l => l.landmarkId === command.landmarkId) : undefined
      const entity = 'entityId' in command ? area.interactables?.find(n => n.entityId === command.entityId) : undefined
      if (command.type === 'discover-landmark') {
        if (!landmark || Math.abs(position.x - landmark.x) > landmark.width / 2 || Math.abs(position.y - landmark.y) > landmark.height / 2) throw ApiError.conflict('Reach the landmark before recording it.')
      } else if (!entity || entity.tutorial || (command.type === 'harvest' ? !supportedNode(entity) : entity.kind !== 'inspectable' || !entity.noteId || !entity.description)
        || Math.hypot(position.x - entity.x, position.y - entity.y) > EXPLORATION_INTERACTION_RADIUS) throw ApiError.conflict('Approach this place before interacting.')
      const spawn = area.spawns.find(s => s.entryId === location.entryId)!
      const anchor = state.anchor?.worldRevision === location.revision && state.anchor.areaId === area.areaId ? state.anchor
        : { position: { x: spawn.x, y: spawn.y }, at: (event?.occurredAt ?? owner.initializedAt).toISOString() }
      const navigation = authority ? movementNavigation(authority.runtimeAreaId) : validateExplorationReach(area, position, anchor, now)
      if (entity && !navigation.visible(position, entity)) throw ApiError.conflict('Approach this place on clear ground.')
      let reward: ExplorationRewardV1 | undefined
      if (command.type === 'harvest' && entity) {
        if (entity.requiredToolId && (starting.equipment.tool !== entity.requiredToolId || !starting.ownedEquipment.includes(entity.requiredToolId))) throw ApiError.conflict('Equip your Field Knife from Inventory before harvesting.')
        if (state.cooldowns[entity.entityId] && now.getTime() < Date.parse(state.cooldowns[entity.entityId])) throw ApiError.conflict('This plant is recovering. Return after it respawns.')
        // Genetic rolls require Movement Authority V1 even if an ordinary legacy fixture omits the port.
        let geneticLot: WildSeedLotV1 | undefined
        const source = WILD_SOURCES.find(s => s.nodeId === entity.entityId && s.areaId === area.areaId && s.speciesId === entity.speciesId)
        if (source && authority) {
          if (authority.areaId !== area.areaId || authority.worldRevision !== location.revision) throw ApiError.conflict('Your authoritative location changed.')
          const [previous] = source.special ? await tx.select({ id: wildGeneticSeeds.id }).from(wildGeneticSeeds).where(and(eq(wildGeneticSeeds.ownerPlayerId, playerId), sql`${wildGeneticSeeds.provenance}->>'sourceNodeId' = ${source.nodeId}`)).limit(1) : []
          const outcome = previous ? 'normal' : state.forcedWildOutcome ?? resolveWildFind(this.random)
          delete state.forcedWildOutcome
          if (outcome !== 'normal') {
            const lotId = crypto.randomUUID(), seedIds: string[] = []
            const provenance = { v: 1 as const, lotId, sourceNodeId: source.nodeId, populationId: source.populationId, areaId: source.areaId, region: source.region, label: `First Basin — ${source.region} population`, rarity: outcome, harvestedAt: now.toISOString(), harvestCommandId: command.commandId, sourceVersion: WILD_FIND_TUNING.version }
            for (let ordinal = 0; ordinal < WILD_FIND_TUNING.seedsPerLot; ordinal++) {
              const id = crypto.randomUUID(), cloneLineId = crypto.randomUUID(), resolved = resolveWildSeed(source, outcome, now, this.random)
              seedIds.push(id)
              await tx.insert(cloneLines).values({ id: cloneLineId, speciesId: source.speciesId, originType: 'wild-genetic-seed', originPlayerId: playerId, establishedAt: now, geneticRepresentationVersion: 1, visualDerivationVersion: 1, createdAt: now })
              await tx.insert(geneticProfiles).values({ cloneLineId, ...resolved.genetics, establishmentRuleVersion: 1, createdAt: now })
              for (const variant of resolved.specialVariants) await tx.insert(cloneLineVariants).values({ cloneLineId, variantId: variant.variantId, origin: variant.origin, establishedAt: now })
              await tx.insert(wildGeneticSeeds).values({ id, ownerPlayerId: playerId, lotId, ordinal, cloneLineId, provenance, sourceGenetics: resolved.sourceGenetics, geneticFeatures: resolved.geneticFeatures, status: 'available', createdAt: now })
            }
            geneticLot = { lotId, speciesId: source.speciesId, provenance, seedIds, quantity: seedIds.length }
            state.collectedPopulations ??= {}; state.collectedPopulations[source.populationId] ??= now.toISOString()
          }
          await tx.insert(playerGrowerEvents).values({ id: crypto.randomUUID(), playerId, eventType: 'wild-genetic-harvest-receipt-v1', sourceCommandId: command.commandId, occurredAt: now, payload: { sourceNodeId: source.nodeId, populationId: source.populationId, sourceVersion: WILD_FIND_TUNING.version, outcome, rewardType: geneticLot ? 'commodity-and-genetic-lot' : 'commodity', lotId: geneticLot?.lotId ?? null, seedIds: geneticLot?.seedIds ?? [], special: source.special } })
        }
        const quantity = this.yield(entity.minYield!, entity.maxYield!)
        if (!Number.isSafeInteger(quantity) || quantity < entity.minYield! || quantity > entity.maxYield!) throw new Error('Invalid harvest resolution.')
        const [stack] = await tx.select({ quantity: playerSeedStacks.quantity }).from(playerSeedStacks).where(and(eq(playerSeedStacks.playerId, playerId), eq(playerSeedStacks.speciesId, entity.speciesId!))).for('update').limit(1)
        if ((stack?.quantity ?? 0) > 2147483647 - quantity) throw ApiError.conflict('Your seed stack is full.')
        await tx.insert(playerSeedStacks).values({ playerId, speciesId: entity.speciesId!, quantity, updatedAt: now }).onConflictDoUpdate({ target: [playerSeedStacks.playerId, playerSeedStacks.speciesId],
          set: { quantity: sql`${playerSeedStacks.quantity} + ${quantity}`, version: sql`${playerSeedStacks.version} + 1`, updatedAt: now } })
        const nextXp = addXp(starting.harvestingXp, entity.harvestingXp!)!, awardedXp = nextXp - starting.harvestingXp
        starting.harvestingXp = nextXp; state.wildHarvestingXp += awardedXp
        state.cooldowns[entity.entityId] = new Date(now.getTime() + entity.respawnSeconds! * 1000).toISOString()
        await saveStartingState(tx, playerId, starting, command.commandId, now)
        await tx.insert(playerPlantLifecycleVersions).values({ playerId, version: 1, updatedAt: now }).onConflictDoUpdate({ target: playerPlantLifecycleVersions.playerId, set: { version: sql`${playerPlantLifecycleVersions.version} + 1`, updatedAt: now } })
        reward = { name: entity.displayName, speciesId: entity.speciesId!, quantity, harvestingXp: awardedXp, ...(geneticLot ? { geneticLot } : {}) }
      } else if (landmark) state.landmarks[landmark.landmarkId] ??= now.toISOString()
      else if (entity?.noteId) state.notes[entity.noteId] ??= now.toISOString()
      state.anchor = { areaId: area.areaId, worldRevision: location.revision, position: { ...position }, at: now.toISOString() }
      await saveExplorationState(tx, playerId, state, command.commandId, now, fingerprint, reward)
      return this.result(tx, playerId, state, starting, reward)
    })
  }
  async reset(playerId: string, command: ExplorationDevCommandV1): Promise<ExplorationResultV1> {
    this.assertEnvironment(true)
    if (!isExplorationDevCommandV1(command)) throw ApiError.validation('Invalid exploration development command.')
    return this.database.transaction(async tx => {
      const { state, starting } = await this.load(tx, playerId), fingerprint = JSON.stringify(command)
      const [receipt] = await tx.select({ payload: playerGrowerEvents.payload }).from(playerGrowerEvents)
        .where(and(eq(playerGrowerEvents.playerId, playerId), eq(playerGrowerEvents.eventType, EXPLORATION_EVENT), eq(playerGrowerEvents.sourceCommandId, command.commandId))).limit(1)
      if (receipt) {
        if ((receipt.payload as { fingerprint: string }).fingerprint !== fingerprint) throw ApiError.conflict('Exploration command ID was already used.')
      } else {
        if (state.revision !== command.expectedRevision) throw ApiError.conflict('Exploration state changed. Refresh before resetting.')
        if (command.type === 'reset-landmarks') state.landmarks = {}
        else if (command.type === 'reset-cooldowns') state.cooldowns = {}
        else if ('outcome' in command) state.forcedWildOutcome = command.outcome
        await saveExplorationState(tx, playerId, state, command.commandId, this.now(), fingerprint)
      }
      return this.result(tx, playerId, state, starting)
    })
  }
}
