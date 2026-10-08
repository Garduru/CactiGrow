import { movementNavigation } from './movementRules.ts'
import { ApiError } from '../api/errors.ts'
import type { MovementAuthorityV1 } from '../../shared/api/movementV1.ts'
import type { WorldArea, WorldPoint } from '../../shared/world/types.ts'
import { farmWorldLayout } from '../../src/game-world/farmWorldLayout.ts'
import { TOWN_LOCATION_LAYOUT } from '../../shared/world/townGeometry.ts'
import { and, desc, eq, sql } from 'drizzle-orm'
import { playerGrowerEvents, playerProfiles } from '../db/schema/index.ts'
import { findArea, initialLocation, isWorldLocation, runtimeAreaId } from '../../shared/world/world.ts'
import type { StartingTransaction } from '../starting/startingState.ts'
import type { MovementPort } from './movementPort.ts'

/** Called under the existing onboarding owner lock, through the reward transaction. */
export async function readInteractionAuthority(tx: StartingTransaction, playerId: string, movement: MovementPort) {
  const [profile] = await tx.select({ publicId: playerProfiles.publicId }).from(playerProfiles).where(eq(playerProfiles.playerId, playerId)).limit(1)
  if (!profile) throw ApiError.forbidden()
  const [event] = await tx.select({ payload: playerGrowerEvents.payload }).from(playerGrowerEvents)
    .where(and(eq(playerGrowerEvents.playerId, playerId), eq(playerGrowerEvents.eventType, 'world-foundation-location-v1'))).orderBy(desc(sql`(${playerGrowerEvents.payload}->>'revision')::integer`)).limit(1)
  const location = isWorldLocation(event?.payload) ? event.payload : initialLocation(profile.publicId)
  const area = findArea(location.areaId)!
  return movement.read(playerId, { ...location, runtimeAreaId: runtimeAreaId(area, profile.publicId) })
}

export function requireProximity(authority: MovementAuthorityV1, area: WorldArea, target: WorldPoint, radius: number, sight = true) {
  if (authority.areaId !== area.areaId || Math.hypot(authority.position.x - target.x, authority.position.y - target.y) > radius
    || sight && !movementNavigation(authority.runtimeAreaId).visible(authority.position, target)) throw ApiError.conflict('Approach this place before interacting.')
}
export function requireRegion(authority: MovementAuthorityV1, area: WorldArea, region: WorldPoint & { width: number; height: number }) {
  if (authority.areaId !== area.areaId || Math.abs(authority.position.x - region.x) > region.width / 2 || Math.abs(authority.position.y - region.y) > region.height / 2) throw ApiError.conflict('Reach this place before interacting.')
}
export function requireBuilding(authority: MovementAuthorityV1, area: WorldArea, id: string) {
  if (area.areaType === 'farm') {
    const building = farmWorldLayout.find(l => l.id === id && l.id !== 'town')
    if (building) { requireProximity(authority, area, { x: building.interactionX ?? building.approachX, y: building.interactionY ?? building.approachY }, building.interactionRadius ?? 165, id !== 'mail'); return }
  } else if (area.areaType === 'town') {
    const building = TOWN_LOCATION_LAYOUT.find(l => l.id === id && l.id !== 'farm')
    if (building) { requireProximity(authority, area, { x: building.interactionX, y: building.interactionY }, building.interactionRadius); return }
  }
  throw ApiError.forbidden()
}
