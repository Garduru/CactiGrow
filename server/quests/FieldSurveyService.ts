import { and, desc, eq, sql } from 'drizzle-orm'
import type { CactiGrowDatabase } from '../db/client/database.ts'
import { playerGrowerEvents, playerProfiles } from '../db/schema/index.ts'
import { ApiError } from '../api/errors.ts'
import { FIELD_SURVEY, isFieldSurveyCommandV1, isFieldSurveyDevCommandV1, type FieldSurveyCommandV1, type FieldSurveyDevCommandV1, type FieldSurveyObjectivesV1, type FieldSurveyProjectionV1, type FieldSurveyResultV1, type FieldSurveyRewardV1 } from '../../shared/api/fieldSurveyV1.ts'
import { WORLD, findArea, initialLocation, isWorldLocation } from '../../shared/world/world.ts'
import type { StartingExperienceV1 } from '../../shared/api/startingExperienceV1.ts'
import { isExplorationCommandV1, EXPLORATION_INTERACTION_RADIUS } from '../../shared/api/explorationV1.ts'
import { loadStartingState, lockStartingOwner, saveStartingState, type StartingTransaction } from '../starting/startingState.ts'
import { EXPLORATION_EVENT, loadExplorationState, saveExplorationState, type ExplorationCheckpoint } from '../exploration/explorationState.ts'
import { validateExplorationReach } from '../exploration/explorationReach.ts'
import { addXp } from '../../src/features/progression/progressionModel.ts'
import { adjustPlayerBalance } from '../gameplay/supportAdjustments.ts'
import { FIELD_SURVEY_EVENT, FIELD_SURVEY_REWARD_EVENT, loadFieldSurveyReward, loadFieldSurveyState, saveFieldSurveyState } from './fieldSurveyState.ts'

const WORLD_EVENT = 'world-foundation-location-v1'
async function latestWorld(tx: StartingTransaction, playerId: string) {
  const [event] = await tx.select({ payload: playerGrowerEvents.payload, occurredAt: playerGrowerEvents.occurredAt }).from(playerGrowerEvents)
    .where(and(eq(playerGrowerEvents.playerId, playerId), eq(playerGrowerEvents.eventType, WORLD_EVENT)))
    .orderBy(desc(sql`(${playerGrowerEvents.payload}->>'revision')::integer`)).limit(1)
  return event
}
async function harvestedSpecies(tx: StartingTransaction, playerId: string, speciesId: string) {
  // Existing immutable receipts prove harvests, including those before acceptance and cooldown resets.
  const receipts = await tx.select({ payload: playerGrowerEvents.payload }).from(playerGrowerEvents)
    .where(and(eq(playerGrowerEvents.playerId, playerId), eq(playerGrowerEvents.eventType, EXPLORATION_EVENT),
      sql`${playerGrowerEvents.payload}->'reward'->>'speciesId' = ${speciesId}`)).limit(1)
  return receipts.some(({ payload }) => {
    const receipt = payload as { fingerprint?: string }
    try {
      const command: unknown = JSON.parse(receipt.fingerprint ?? '')
      return isExplorationCommandV1(command) && command.type === 'harvest'
        && WORLD.areas.some(a => a.zoneId === 'first-basin' && a.interactables?.some(n => n.entityId === command.entityId && n.kind === 'harvestable' && !n.tutorial && n.speciesId === speciesId))
    } catch { return false }
  })
}
export function fieldSurveyObjectivesComplete(o: FieldSurveyObjectivesV1) {
  return o.landmarks.every(l => l.discoveredAt !== null) && o.sanPedroHarvested && o.peyoteHarvested && o.caveEntered && o.caveLandmarkDiscovered && o.caveNoteInspected
}
/** Response projection over existing authoritative discoveries/receipts; callers hold the onboarding owner. */
export async function projectFieldSurvey(tx: StartingTransaction, playerId: string, starting: StartingExperienceV1, exploration?: ExplorationCheckpoint): Promise<FieldSurveyProjectionV1> {
  const state = await loadFieldSurveyState(tx, playerId), reward = await loadFieldSurveyReward(tx, playerId)
  const records = exploration ?? await loadExplorationState(tx, playerId), world = await latestWorld(tx, playerId)
  const location = isWorldLocation(world?.payload) ? world.payload : null
  const objectives: FieldSurveyObjectivesV1 = {
    landmarks: FIELD_SURVEY.landmarkIds.map(landmarkId => ({ landmarkId, discoveredAt: records.landmarks[landmarkId] ?? null })),
    sanPedroHarvested: await harvestedSpecies(tx, playerId, 'echinopsis-pachanoi'),
    peyoteHarvested: await harvestedSpecies(tx, playerId, 'lophophora-williamsii'),
    caveEntered: !!location?.discoveredAreaIds.includes(FIELD_SURVEY.caveAreaId),
    caveLandmarkDiscovered: !!records.landmarks[FIELD_SURVEY.caveLandmarkId],
    caveNoteInspected: !!records.notes[FIELD_SURVEY.caveNoteId],
  }
  const status = !starting.farmTutorialComplete ? 'locked' : state.completedAt ? 'complete' : !state.acceptedAt ? 'available'
    : fieldSurveyObjectivesComplete(objectives) ? 'ready-to-report' : 'active'
  return { projectionVersion: 1, revision: state.revision, progressRevision: state.revision + records.revision + (location?.revision ?? 0) + starting.revision,
    status, acceptedAt: state.acceptedAt, completedAt: state.completedAt, rewardClaimed: reward !== null, objectives }
}
export class FieldSurveyService {
  private readonly database: CactiGrowDatabase
  private readonly environment: string
  private readonly now: () => Date
  constructor(database: CactiGrowDatabase, options: { environment: string; now?: () => Date }) {
    this.database = database; this.environment = options.environment; this.now = options.now ?? (() => new Date())
  }
  private assertEnvironment(dev = false) {
    if (!(dev ? ['staging', 'development'] : ['staging', 'test']).includes(this.environment)) throw ApiError.notFound('API route not found.')
  }
  private async load(tx: StartingTransaction, playerId: string) {
    const owner = await lockStartingOwner(tx, playerId)
    const [profile] = await tx.select({ publicId: playerProfiles.publicId }).from(playerProfiles).where(eq(playerProfiles.playerId, playerId)).limit(1)
    if (!profile) throw ApiError.conflict('Choose your character name before surveying.')
    const starting = await loadStartingState(tx, playerId, owner.profileId)
    if (starting.revision === 0) starting.nameComplete = true
    return { owner, publicId: profile.publicId, starting }
  }
  async read(playerId: string): Promise<FieldSurveyResultV1> {
    this.assertEnvironment()
    return this.database.transaction(async tx => { const { starting } = await this.load(tx, playerId); return { projection: await projectFieldSurvey(tx, playerId, starting), starting } })
  }
  async inspect(playerId: string): Promise<FieldSurveyResultV1> {
    this.assertEnvironment(true)
    return this.database.transaction(async tx => { const { starting } = await this.load(tx, playerId); return { projection: await projectFieldSurvey(tx, playerId, starting), starting } })
  }
  async execute(playerId: string, command: FieldSurveyCommandV1): Promise<FieldSurveyResultV1> {
    this.assertEnvironment()
    if (!isFieldSurveyCommandV1(command)) throw ApiError.validation('Invalid Field Survey command.')
    return this.database.transaction(async tx => {
      const { owner, starting, publicId } = await this.load(tx, playerId), fingerprint = JSON.stringify(command)
      const [receipt] = await tx.select({ payload: playerGrowerEvents.payload }).from(playerGrowerEvents)
        .where(and(eq(playerGrowerEvents.playerId, playerId), eq(playerGrowerEvents.eventType, FIELD_SURVEY_EVENT), eq(playerGrowerEvents.sourceCommandId, command.commandId))).limit(1)
      if (receipt) {
        const saved = receipt.payload as { fingerprint: string; reward?: FieldSurveyRewardV1 }
        if (saved.fingerprint !== fingerprint) throw ApiError.conflict('Field Survey command ID was already used.')
        return { projection: await projectFieldSurvey(tx, playerId, starting), starting, ...(saved.reward ? { reward: saved.reward } : {}) }
      }
      if (!starting.farmTutorialComplete) throw ApiError.conflict('Complete your Farm introduction before accepting the Field Survey.')
      const event = await latestWorld(tx, playerId), location = isWorldLocation(event?.payload) ? event.payload : initialLocation(publicId)
      if (location.revision !== command.expectedWorldRevision) throw ApiError.conflict('Your location changed. Reload the world.')
      const area = findArea(location.areaId), npc = area?.interactables?.find(n => n.entityId === FIELD_SURVEY.npcEntityId && n.kind === 'npc' && !n.tutorial)
      if (!area || area.areaId !== FIELD_SURVEY.npcAreaId || !npc || Math.hypot(command.position.x - npc.x, command.position.y - npc.y) > EXPLORATION_INTERACTION_RADIUS) {
        throw ApiError.conflict('Return to Mara at Cross Path to discuss the survey.')
      }
      const exploration = await loadExplorationState(tx, playerId), now = this.now(), spawn = area.spawns.find(s => s.entryId === location.entryId)!
      const anchor = exploration.anchor?.worldRevision === location.revision && exploration.anchor.areaId === area.areaId ? exploration.anchor
        : { position: { x: spawn.x, y: spawn.y }, at: (event?.occurredAt ?? owner.initializedAt).toISOString() }
      const navigation = validateExplorationReach(area, command.position, anchor, now)
      if (!navigation.visible(command.position, npc)) throw ApiError.conflict('Approach Mara on clear ground.')
      const state = await loadFieldSurveyState(tx, playerId)
      let reward: FieldSurveyRewardV1 | undefined
      if (command.type === 'accept') {
        if (state.acceptedAt) throw ApiError.conflict('The Field Survey is already accepted.')
        state.acceptedAt = now.toISOString()
      } else {
        if (!state.acceptedAt) throw ApiError.conflict('Accept Mara\'s Field Survey before reporting.')
        if (state.completedAt) throw ApiError.conflict('You have already reported this survey.')
        const projection = await projectFieldSurvey(tx, playerId, starting, exploration)
        if (!fieldSurveyObjectivesComplete(projection.objectives)) throw ApiError.conflict('Finish the field observations before reporting to Mara.')
        if (!projection.rewardClaimed) {
          const nextXp = addXp(starting.harvestingXp, FIELD_SURVEY.reward.harvestingXp)!
          reward = { harvestingXp: nextXp - starting.harvestingXp, currency: FIELD_SURVEY.reward.currency }
          await adjustPlayerBalance(tx, playerId, reward.currency)
          starting.harvestingXp = nextXp
          await saveStartingState(tx, playerId, starting, command.commandId, now)
          await tx.insert(playerGrowerEvents).values({ id: crypto.randomUUID(), playerId, eventType: FIELD_SURVEY_REWARD_EVENT, sourceCommandId: command.commandId, occurredAt: now, payload: { questId: FIELD_SURVEY.questId, reward } })
        }
        state.completedAt = now.toISOString()
      }
      exploration.anchor = { areaId: area.areaId, worldRevision: location.revision, position: { ...command.position }, at: now.toISOString() }
      await saveExplorationState(tx, playerId, exploration, command.commandId, now, fingerprint)
      await saveFieldSurveyState(tx, playerId, state, command.commandId, now, fingerprint, reward)
      return { projection: await projectFieldSurvey(tx, playerId, starting, exploration), starting, ...(reward ? { reward } : {}) }
    })
  }
  async reset(playerId: string, command: FieldSurveyDevCommandV1): Promise<FieldSurveyResultV1> {
    this.assertEnvironment(true)
    if (!isFieldSurveyDevCommandV1(command)) throw ApiError.validation('Invalid Field Survey development command.')
    return this.database.transaction(async tx => {
      const { starting } = await this.load(tx, playerId), fingerprint = JSON.stringify(command)
      const [receipt] = await tx.select({ payload: playerGrowerEvents.payload }).from(playerGrowerEvents)
        .where(and(eq(playerGrowerEvents.playerId, playerId), eq(playerGrowerEvents.eventType, FIELD_SURVEY_EVENT), eq(playerGrowerEvents.sourceCommandId, command.commandId))).limit(1)
      if (receipt) {
        if ((receipt.payload as { fingerprint: string }).fingerprint !== fingerprint) throw ApiError.conflict('Field Survey command ID was already used.')
      } else {
        const state = await loadFieldSurveyState(tx, playerId)
        if (state.revision !== command.expectedRevision) throw ApiError.conflict('Field Survey state changed. Refresh before resetting.')
        state.acceptedAt = null; state.completedAt = null
        await saveFieldSurveyState(tx, playerId, state, command.commandId, this.now(), fingerprint)
      }
      return { projection: await projectFieldSurvey(tx, playerId, starting), starting }
    })
  }
}
