import { and, desc, eq, sql } from 'drizzle-orm'
import type { CactiGrowDatabase } from '../db/client/database.ts'
import { playerGrowerEvents, playerOnboarding, playerProfiles } from '../db/schema/index.ts'
import { ApiError } from '../api/errors.ts'
import { WORLD, findArea, initialLocation, isWorldLocation, runtimeAreaId } from '../../shared/world/world.ts'
import type { WorldLocation } from '../../shared/world/types.ts'

export interface ExitCommand { v: 1; exitId: string; expectedRevision: number; commandId: string }
export interface TravelCommand { v: 1; travelDestinationId: string; expectedRevision: number; commandId: string }
type WorldCommand = ExitCommand | TravelCommand
const EVENT = 'world-foundation-location-v1'
export function resolveExit(current: WorldLocation, command: ExitCommand, publicId: string): WorldLocation {
  if (command.expectedRevision !== current.revision) throw ApiError.conflict('Your location changed. Reload the world.')
  const exit = findArea(current.areaId)?.exits.find(e => e.exitId === command.exitId)
  if (!exit) throw ApiError.forbidden()
  if (exit.blocked) throw ApiError.conflict(exit.futureDestinationLabel ?? 'Route under construction.')
  const area = exit.targetAreaId ? findArea(exit.targetAreaId) : undefined
  const spawn = area?.spawns.find(s => s.entryId === exit.targetEntryId)
  if (!area || !spawn) throw ApiError.conflict('This route is unavailable.')
  return { ...current, revision: current.revision + 1, areaId: area.areaId, runtimeAreaId: runtimeAreaId(area, publicId), zoneId: area.zoneId,
    entryId: spawn.entryId, position: { x: spawn.x, y: spawn.y }, discoveredAreaIds: [...new Set([...current.discoveredAreaIds, area.areaId])],
    discoveredTravelDestinationIds: [...new Set([...current.discoveredTravelDestinationIds, ...(area.travelDestinationId ? [area.travelDestinationId] : [])])] }
}

export function resolveTravel(current: WorldLocation, command: TravelCommand, publicId: string): WorldLocation {
  if (command.expectedRevision !== current.revision) throw ApiError.conflict('Your location changed. Reload the world.')
  const area = WORLD.areas.find(a => a.travelDestinationId === command.travelDestinationId)
  if (!area || !current.discoveredAreaIds.includes(area.areaId) || !current.discoveredTravelDestinationIds.includes(command.travelDestinationId)) throw ApiError.forbidden()
  if (area.areaId === current.areaId) throw ApiError.conflict('You are already here.')
  const spawn = area.spawns.find(s => s.entryId === area.travelSpawnId)
  if (!spawn) throw ApiError.conflict('This destination is unavailable.')
  return { ...current, revision: current.revision + 1, areaId: area.areaId, runtimeAreaId: runtimeAreaId(area, publicId), zoneId: area.zoneId,
    entryId: spawn.entryId, position: { x: spawn.x, y: spawn.y } }
}
type Transaction = Parameters<Parameters<CactiGrowDatabase['transaction']>[0]>[0]
export class WorldService {
  private readonly database: CactiGrowDatabase
  constructor(database: CactiGrowDatabase) { this.database = database }
  private async owner(tx: Transaction, playerId: string) {
    // The existing onboarding owner row serializes location changes; no gameplay values are changed.
    const [owner] = await tx.select({ id: playerOnboarding.playerId }).from(playerOnboarding).where(eq(playerOnboarding.playerId, playerId)).for('update')
    const [profile] = await tx.select({ publicId: playerProfiles.publicId }).from(playerProfiles).where(eq(playerProfiles.playerId, playerId)).limit(1)
    if (!owner || !profile) throw ApiError.conflict('Complete character setup before entering the world.')
    return profile.publicId
  }
  private async load(tx: Transaction, playerId: string, publicId: string): Promise<WorldLocation> {
    const [event] = await tx.select({ payload: playerGrowerEvents.payload }).from(playerGrowerEvents)
      .where(and(eq(playerGrowerEvents.playerId, playerId), eq(playerGrowerEvents.eventType, EVENT))).orderBy(desc(sql`(${playerGrowerEvents.payload}->>'revision')::integer`)).limit(1)
    if (!isWorldLocation(event?.payload)) {
      const fallback = initialLocation(publicId), old = event?.payload as { revision?: unknown } | undefined
      if (typeof old?.revision === 'number' && Number.isSafeInteger(old.revision) && old.revision >= 0) fallback.revision = old.revision
      return fallback
    }
    const s = event.payload
    const area = findArea(s.areaId)!, spawn = area.spawns.find(entry => entry.entryId === s.entryId)!
    // Checkpoints restore authored entries, including later LDtk spawn polish.
    return { projectionVersion: 1, revision: s.revision, areaId: s.areaId, runtimeAreaId: runtimeAreaId(area, publicId), zoneId: s.zoneId,
      entryId: s.entryId, position: { x: spawn.x, y: spawn.y }, discoveredAreaIds: s.discoveredAreaIds, discoveredTravelDestinationIds: s.discoveredTravelDestinationIds }
  }
  read(playerId: string) { return this.database.transaction(async tx => this.load(tx, playerId, await this.owner(tx, playerId))) }
  transition(playerId: string, command: WorldCommand) {
    return this.database.transaction(async tx => {
      const publicId = await this.owner(tx, playerId)
      const [receipt] = await tx.select({ payload: playerGrowerEvents.payload }).from(playerGrowerEvents).where(and(eq(playerGrowerEvents.playerId, playerId), eq(playerGrowerEvents.eventType, EVENT), eq(playerGrowerEvents.sourceCommandId, command.commandId))).limit(1)
      if (receipt) {
        const saved = receipt.payload as { exitId?: string; travelDestinationId?: string; expectedRevision?: number }
        if (saved.exitId !== ('exitId' in command ? command.exitId : undefined) || saved.travelDestinationId !== ('travelDestinationId' in command ? command.travelDestinationId : undefined) || saved.expectedRevision !== command.expectedRevision) throw ApiError.conflict('Transition command ID was already used.')
        // Return current state on retry, never regress a client to a historical destination.
        return this.load(tx, playerId, publicId)
      }
      const current = await this.load(tx, playerId, publicId)
      const location = 'exitId' in command ? resolveExit(current, command, publicId) : resolveTravel(current, command, publicId)
      await tx.insert(playerGrowerEvents).values({ id: crypto.randomUUID(), playerId, eventType: EVENT, sourceCommandId: command.commandId, occurredAt: new Date(), payload: { ...location, ...('exitId' in command ? { exitId: command.exitId } : { travelDestinationId: command.travelDestinationId }), expectedRevision: command.expectedRevision } })
      return location
    })
  }
}
