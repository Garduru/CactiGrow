import { and, desc, eq, sql } from 'drizzle-orm'
import type { CactiGrowDatabase } from '../db/client/database.ts'
import { playerGrowerEvents, playerPlantLifecycleVersions, playerProfiles, playerSeedStacks } from '../db/schema/index.ts'
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
  private readonly database: CactiGrowDatabase
  private readonly environment: string
  private readonly now: () => Date
  private readonly yield: (min: number, max: number) => number
  constructor(database: CactiGrowDatabase, options: { environment: string; now?: () => Date; rollYield?: (min: number, max: number) => number }) {
    this.database = database; this.environment = options.environment; this.now = options.now ?? (() => new Date()); this.yield = options.rollYield ?? rollYield
  }
  private assertEnvironment(dev = false) {
    if (!(dev ? ['staging', 'development'] : ['staging', 'test']).includes(this.environment)) throw ApiError.notFound('API route not found.')
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
      notes: areas().flatMap(a => (a.interactables ?? []).filter(n => n.kind === 'inspectable' && n.noteId).map(n => ({ noteId: n.noteId!, areaId: a.areaId, discoveredAt: state.notes[n.noteId!] ?? null }))) }
  }
  async read(playerId: string): Promise<ExplorationResultV1> {
    this.assertEnvironment()
    return this.database.transaction(async tx => { const { state, starting } = await this.load(tx, playerId); return { projection: this.project(state, starting), starting } })
  }
  async inspect(playerId: string): Promise<ExplorationResultV1> {
    this.assertEnvironment(true)
    return this.database.transaction(async tx => { const { state, starting } = await this.load(tx, playerId); return { projection: this.project(state, starting), starting } })
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
        return { projection: this.project(state, starting), starting }
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
      return { projection: this.project(state, starting), starting }
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
        return { projection: this.project(state, starting), starting, ...(saved.reward ? { reward: saved.reward } : {}) }
      }
      if (!starting.nameComplete || !starting.appearanceComplete || !starting.spawnTutorialComplete || !starting.farmTutorialComplete) throw ApiError.conflict('Complete your Farm introduction before exploring farther.')
      const [event] = await tx.select({ payload: playerGrowerEvents.payload, occurredAt: playerGrowerEvents.occurredAt }).from(playerGrowerEvents)
        .where(and(eq(playerGrowerEvents.playerId, playerId), eq(playerGrowerEvents.eventType, WORLD_EVENT))).orderBy(desc(sql`(${playerGrowerEvents.payload}->>'revision')::integer`)).limit(1)
      const location = isWorldLocation(event?.payload) ? event.payload : initialLocation(publicId)
      if (location.revision !== command.expectedWorldRevision) throw ApiError.conflict('Your location changed. Reload the world.')
      const area = findArea(location.areaId)!
      if (!areas().some(a => a.areaId === area.areaId)) throw ApiError.forbidden()
      const landmark = command.type === 'discover-landmark' ? area.landmarks?.find(l => l.landmarkId === command.landmarkId) : undefined
      const entity = 'entityId' in command ? area.interactables?.find(n => n.entityId === command.entityId) : undefined
      if (command.type === 'discover-landmark') {
        if (!landmark || Math.abs(command.position.x - landmark.x) > landmark.width / 2 || Math.abs(command.position.y - landmark.y) > landmark.height / 2) throw ApiError.conflict('Reach the landmark before recording it.')
      } else if (!entity || entity.tutorial || (command.type === 'harvest' ? !supportedNode(entity) : entity.kind !== 'inspectable' || !entity.noteId || !entity.description)
        || Math.hypot(command.position.x - entity.x, command.position.y - entity.y) > EXPLORATION_INTERACTION_RADIUS) throw ApiError.conflict('Approach this place before interacting.')
      const spawn = area.spawns.find(s => s.entryId === location.entryId)!
      const anchor = state.anchor?.worldRevision === location.revision && state.anchor.areaId === area.areaId ? state.anchor
        : { position: { x: spawn.x, y: spawn.y }, at: (event?.occurredAt ?? owner.initializedAt).toISOString() }
      const navigation = validateExplorationReach(area, command.position, anchor, now)
      if (entity && !navigation.visible(command.position, entity)) throw ApiError.conflict('Approach this place on clear ground.')
      let reward: ExplorationRewardV1 | undefined
      if (command.type === 'harvest' && entity) {
        if (entity.requiredToolId && (starting.equipment.tool !== entity.requiredToolId || !starting.ownedEquipment.includes(entity.requiredToolId))) throw ApiError.conflict('Equip your Field Knife from Inventory before harvesting.')
        if (state.cooldowns[entity.entityId] && now.getTime() < Date.parse(state.cooldowns[entity.entityId])) throw ApiError.conflict('This plant is recovering. Return after it respawns.')
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
        reward = { name: entity.displayName, speciesId: entity.speciesId!, quantity, harvestingXp: awardedXp }
      } else if (landmark) state.landmarks[landmark.landmarkId] ??= now.toISOString()
      else if (entity?.noteId) state.notes[entity.noteId] ??= now.toISOString()
      state.anchor = { areaId: area.areaId, worldRevision: location.revision, position: { ...command.position }, at: now.toISOString() }
      await saveExplorationState(tx, playerId, state, command.commandId, now, fingerprint, reward)
      return { projection: this.project(state, starting), starting, ...(reward ? { reward } : {}) }
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
        else state.cooldowns = {}
        await saveExplorationState(tx, playerId, state, command.commandId, this.now(), fingerprint)
      }
      return { projection: this.project(state, starting), starting }
    })
  }
}
