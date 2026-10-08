import { NavigationMap, distance } from '../../src/game-world/navigation/NavigationMap.ts'
import { areaFromRuntime } from '../../shared/world/world.ts'
import { TOWN_COLLIDERS } from '../../shared/world/townGeometry.ts'
import { FARM_COLLIDERS } from '../../shared/world/farmGeometry.ts'
import { MOVEMENT_LATENCY_MS, MOVEMENT_MAX_CREDIT_MS, PLAYER_MOVEMENT_SPEED, PLAYER_BODY_RADIUS } from '../../shared/world/movement.ts'
import type { MovementAuthorityV1 } from '../../shared/api/movementV1.ts'
import type { WorldLocation, WorldPoint } from '../../shared/world/types.ts'

export interface MovementState { playerId: string; worldVersion: string; authority: MovementAuthorityV1; creditAt: number }
const maps = new Map<string, NavigationMap>()
/** Physics clearance admits keyboard contact; the client route planner keeps its extra five units. */
export function movementNavigation(runtimeId: string) {
  let map = maps.get(runtimeId.startsWith('farm-') ? 'farm' : runtimeId)
  if (!map) {
    const area = areaFromRuntime(runtimeId)
    if (!area) throw new Error('Unknown movement Area.')
    const collision = area.areaType === 'farm' ? FARM_COLLIDERS : area.areaType === 'town' ? TOWN_COLLIDERS : area.collision
    map = new NavigationMap(area.width, area.height, collision, PLAYER_BODY_RADIUS - .1, 0, true)
    maps.set(runtimeId.startsWith('farm-') ? 'farm' : runtimeId, map)
  }
  return map
}
export function seedMovement(playerId: string, location: WorldLocation, worldVersion: string, now: number): MovementState {
  return { playerId, worldVersion, creditAt: now - MOVEMENT_LATENCY_MS,
    authority: { v: 1, areaId: location.areaId, runtimeAreaId: location.runtimeAreaId, worldRevision: location.revision,
      revision: 0, position: { ...location.position }, previousPosition: { ...location.position }, acceptedAt: now,
      serverNow: now, accepted: true, lastRejection: null, rejections: 0, delta: 0 } }
}
export function checkpointMovement(state: MovementState, runtimeId: string, position: WorldPoint, now: number, expectedRevision = state.authority.worldRevision): MovementState {
  const old = state.authority, map = movementNavigation(old.runtimeAreaId), area = areaFromRuntime(old.runtimeAreaId)!
  let reason: string | null = null, length = 0
  if (runtimeId !== old.runtimeAreaId || expectedRevision !== old.worldRevision) reason = 'AREA_CHANGED'
  else if (![position.x, position.y].every(Number.isFinite) || position.x < 0 || position.y < 0 || position.x >= area.width || position.y >= area.height) reason = 'OUT_OF_BOUNDS'
  else if (!map.walkable(position)) reason = 'BLOCKED_POSITION'
  else {
    const route = map.route(old.position, position)
    if (!route || distance(route.at(-1)!, position) > .01) reason = 'BLOCKED_PATH'
    else {
      let previous = old.position
      for (const point of route) { length += distance(previous, point); previous = point }
      // A consumable server-time budget: latency credit is never granted again per packet.
      const elapsed = Math.min(MOVEMENT_MAX_CREDIT_MS + MOVEMENT_LATENCY_MS, Math.max(0, now - state.creditAt))
      if (length > PLAYER_MOVEMENT_SPEED * elapsed / 1000 + .01) reason = 'TOO_FAST'
    }
  }
  const delta = [position.x, position.y].every(Number.isFinite) ? distance(position, old.position) : 0
  if (reason) return { ...state, authority: { ...old, accepted: false, serverNow: now, lastRejection: reason, rejections: old.rejections + 1, delta } }
  return { ...state, creditAt: Math.max(state.creditAt, now - MOVEMENT_MAX_CREDIT_MS - MOVEMENT_LATENCY_MS) + length / PLAYER_MOVEMENT_SPEED * 1000,
    authority: { ...old, revision: old.revision + 1, previousPosition: { ...old.position }, position: { ...position }, acceptedAt: now, serverNow: now, accepted: true, delta: 0 } }
}
