import { and, asc, desc, eq, sql } from 'drizzle-orm'
import type { CactiGrowDatabase } from '../db/client/database.ts'
import { playerGrowerEvents } from '../db/schema/index.ts'
import { ApiError } from '../api/errors.ts'
import { TOWN_CONTENT, TOWN_INTERACTION_RADIUS, TOWN_NPC_IDS, isTownContentCommandV1, type TownContentCommandV1, type TownContentProjectionV1, type TownContentResultV1 } from '../../shared/api/townContentV1.ts'
import { findArea, isWorldLocation } from '../../shared/world/world.ts'
import { TOWN_COLLIDERS } from '../../shared/world/townGeometry.ts'
import { lockStartingOwner, type StartingTransaction } from '../starting/startingState.ts'
import { loadExplorationState } from '../exploration/explorationState.ts'
import { validateExplorationReach } from '../exploration/explorationReach.ts'

export const TOWN_CONTACT_EVENT = 'town-content-checkpoint-v1'
export const TOWN_CONTACT_RECEIPT = 'town-content-contact-receipt-v1'
const WORLD_EVENT = 'world-foundation-location-v1'
interface TownContactCheckpoint { projectionVersion: 1; revision: number; contacts: TownContentProjectionV1['contacts'] }
interface TownTalkAnchor { revision: number; worldRevision: number; position: { x: number; y: number }; at: string }
function isTownTalkAnchor(value: unknown): value is TownTalkAnchor {
  const anchor = value as TownTalkAnchor | null
  return !!anchor && Number.isSafeInteger(anchor.revision) && anchor.revision > 0
    && Number.isSafeInteger(anchor.worldRevision) && anchor.worldRevision >= 0
    && !!anchor.position && [anchor.position.x, anchor.position.y].every(n => Number.isFinite(n) && n >= 0 && n <= 100000)
    && typeof anchor.at === 'string' && Number.isFinite(Date.parse(anchor.at))
}
async function loadTownContacts(tx: StartingTransaction, playerId: string): Promise<TownContactCheckpoint> {
  const [event] = await tx.select({ payload: playerGrowerEvents.payload }).from(playerGrowerEvents)
    .where(and(eq(playerGrowerEvents.playerId, playerId), eq(playerGrowerEvents.eventType, TOWN_CONTACT_EVENT)))
    .orderBy(desc(sql`(${playerGrowerEvents.payload}->>'revision')::integer`)).limit(1)
  if (!event) return { projectionVersion: 1, revision: 0, contacts: TOWN_NPC_IDS.map(entityId => ({ entityId, firstMetAt: null })) }
  const state = event.payload as TownContactCheckpoint
  if (state.projectionVersion !== 1 || !Number.isSafeInteger(state.revision) || state.revision < 0
    || !Array.isArray(state.contacts) || state.contacts.length !== TOWN_NPC_IDS.length
    || !state.contacts.every((contact, index) => contact?.entityId === TOWN_NPC_IDS[index]
      && (contact.firstMetAt === null || typeof contact.firstMetAt === 'string' && Number.isFinite(Date.parse(contact.firstMetAt))))) {
    throw ApiError.conflict('The Town introduction record needs recovery. No player data was changed.')
  }
  return { projectionVersion: 1, revision: state.revision, contacts: state.contacts.map(contact => ({ ...contact })) }
}
async function projectTownContacts(tx: StartingTransaction, playerId: string, state: TownContactCheckpoint): Promise<TownContentProjectionV1> {
  // Town entry already establishes discovery and Travel. This projection only reads its first persisted arrival.
  const [entry] = await tx.select({ occurredAt: playerGrowerEvents.occurredAt }).from(playerGrowerEvents)
    .where(and(eq(playerGrowerEvents.playerId, playerId), eq(playerGrowerEvents.eventType, WORLD_EVENT),
      sql`${playerGrowerEvents.payload}->>'areaId' = ${TOWN_CONTENT.areaId}`)).orderBy(asc(sql`(${playerGrowerEvents.payload}->>'revision')::integer`)).limit(1)
  return { ...state, townDiscoveredAt: entry?.occurredAt.toISOString() ?? null }
}
/** Small one-time Town notes reuse existing authority; no commerce, quest or social ownership. */
export class TownContentService {
  private readonly database: CactiGrowDatabase
  private readonly environment: string
  private readonly now: () => Date
  constructor(database: CactiGrowDatabase, options: { environment: string; now?: () => Date }) {
    this.database = database; this.environment = options.environment; this.now = options.now ?? (() => new Date())
  }
  private assertEnvironment() {
    if (!['staging', 'test'].includes(this.environment)) throw ApiError.notFound('API route not found.')
  }
  async read(playerId: string): Promise<TownContentResultV1> {
    this.assertEnvironment()
    return this.database.transaction(async tx => {
      await lockStartingOwner(tx, playerId)
      return { projection: await projectTownContacts(tx, playerId, await loadTownContacts(tx, playerId)) }
    })
  }
  async execute(playerId: string, command: TownContentCommandV1): Promise<TownContentResultV1> {
    this.assertEnvironment()
    if (!isTownContentCommandV1(command)) throw ApiError.validation('Invalid Town conversation command.')
    return this.database.transaction(async tx => {
      const owner = await lockStartingOwner(tx, playerId), fingerprint = JSON.stringify(command)
      const [receipt] = await tx.select({ payload: playerGrowerEvents.payload }).from(playerGrowerEvents)
        .where(and(eq(playerGrowerEvents.playerId, playerId), eq(playerGrowerEvents.eventType, TOWN_CONTACT_RECEIPT), eq(playerGrowerEvents.sourceCommandId, command.commandId))).limit(1)
      const state = await loadTownContacts(tx, playerId)
      if (receipt) {
        const saved = receipt.payload as { fingerprint: string; firstContact: boolean }
        if (saved.fingerprint !== fingerprint) throw ApiError.conflict('Town conversation command ID was already used.')
        return { projection: await projectTownContacts(tx, playerId, state), firstContact: saved.firstContact }
      }
      const [event] = await tx.select({ payload: playerGrowerEvents.payload, occurredAt: playerGrowerEvents.occurredAt }).from(playerGrowerEvents)
        .where(and(eq(playerGrowerEvents.playerId, playerId), eq(playerGrowerEvents.eventType, WORLD_EVENT)))
        .orderBy(desc(sql`(${playerGrowerEvents.payload}->>'revision')::integer`)).limit(1)
      if (!isWorldLocation(event?.payload) || event.payload.areaId !== TOWN_CONTENT.areaId) throw ApiError.conflict('Visit Town before speaking with its residents.')
      const location = event.payload
      if (location.revision !== command.expectedWorldRevision) throw ApiError.conflict('Your location changed. Reload the world.')
      const area = findArea(location.areaId)!, npc = area.interactables?.find(entity => entity.entityId === command.entityId && entity.kind === 'npc' && !entity.tutorial)
      if (!npc || Math.hypot(command.position.x - npc.x, command.position.y - npc.y) > TOWN_INTERACTION_RADIUS) throw ApiError.conflict('Approach this Town resident before talking.')
      const [lastTalk] = await tx.select({ payload: playerGrowerEvents.payload }).from(playerGrowerEvents)
        .where(and(eq(playerGrowerEvents.playerId, playerId), eq(playerGrowerEvents.eventType, TOWN_CONTACT_RECEIPT),
          sql`${playerGrowerEvents.payload}->'anchor'->>'worldRevision' = ${String(location.revision)}`))
        .orderBy(desc(sql`(${playerGrowerEvents.payload}->'anchor'->>'revision')::integer`)).limit(1)
      const talkAnchor = (lastTalk?.payload as { anchor?: unknown } | undefined)?.anchor
      if (lastTalk && !isTownTalkAnchor(talkAnchor)) throw ApiError.conflict('The Town conversation record needs recovery. No player data was changed.')
      const previousTalkAnchor = isTownTalkAnchor(talkAnchor) ? talkAnchor : null
      const exploration = await loadExplorationState(tx, playerId), now = this.now(), spawn = area.spawns.find(s => s.entryId === location.entryId)!
      const explorationAnchor = exploration.anchor?.worldRevision === location.revision && exploration.anchor.areaId === area.areaId ? exploration.anchor : null
      const anchor = explorationAnchor && (!previousTalkAnchor || Date.parse(explorationAnchor.at) > Date.parse(previousTalkAnchor.at)) ? explorationAnchor
        : previousTalkAnchor ?? { position: { x: spawn.x, y: spawn.y }, at: (event?.occurredAt ?? owner.initializedAt).toISOString() }
      // Town's preserved legacy rectangles are shared with the real scene, rather than its empty LDtk collision bridge.
      const navigation = validateExplorationReach({ ...area, collision: TOWN_COLLIDERS.map(rectangle => ({ ...rectangle })) }, command.position, anchor, now)
      if (!navigation.visible(command.position, npc)) throw ApiError.conflict('Approach this Town resident on clear ground.')
      const contact = state.contacts.find(contact => contact.entityId === command.entityId)!, firstContact = contact.firstMetAt === null
      if (firstContact) {
        contact.firstMetAt = now.toISOString(); state.revision++
        await tx.insert(playerGrowerEvents).values({ id: crypto.randomUUID(), playerId, eventType: TOWN_CONTACT_EVENT, sourceCommandId: command.commandId, occurredAt: now, payload: state })
      }
      // Conversation receipts retain replay protection, without persisting dialogue choices or changing first-contact state again.
      const nextAnchor: TownTalkAnchor = { revision: (previousTalkAnchor?.revision ?? 0) + 1, worldRevision: location.revision, position: { ...command.position }, at: now.toISOString() }
      await tx.insert(playerGrowerEvents).values({ id: crypto.randomUUID(), playerId, eventType: TOWN_CONTACT_RECEIPT, sourceCommandId: command.commandId, occurredAt: now, payload: { fingerprint, firstContact, anchor: nextAnchor } })
      return { projection: await projectTownContacts(tx, playerId, state), firstContact }
    })
  }
}
