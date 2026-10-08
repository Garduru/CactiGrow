import { PLAYER_MOVEMENT_SPEED } from '../../shared/world/movement.ts'
import { NavigationMap, distance } from '../../src/game-world/navigation/NavigationMap.ts'
import type { WorldArea, WorldPoint } from '../../shared/world/types.ts'
import { ApiError } from '../api/errors.ts'

const maps = new Map<string, NavigationMap>()
export const EXPLORATION_SPEED = PLAYER_MOVEMENT_SPEED
export const EXPLORATION_TIME_TOLERANCE_MS = 350
export function explorationNavigation(area: WorldArea) {
  let map = maps.get(area.areaId)
  if (!map) { map = new NavigationMap(area.width, area.height, area.collision, 27, 5); maps.set(area.areaId, map) }
  return map
}
/** Legacy endpoint plausibility for consumers without a movement authority port.
 * Staging services use accepted movement positions and independently guard exits. */
export function validateExplorationReach(area: WorldArea, position: WorldPoint, anchor: { position: WorldPoint; at: string }, now: Date) {
  const navigation = explorationNavigation(area)
  if (!navigation.walkable(position)) throw ApiError.conflict('Stand on clear ground before interacting.')
  const route = navigation.route(anchor.position, position)
  if (!route || !route.length || distance(route.at(-1)!, position) > 0.01) throw ApiError.conflict('This discovery cannot be reached from your current entry.')
  let length = 0, previous = anchor.position
  for (const point of route) { length += distance(previous, point); previous = point }
  const elapsed = Math.max(0, now.getTime() - Date.parse(anchor.at))
  if (length > EXPLORATION_SPEED * (elapsed + EXPLORATION_TIME_TOLERANCE_MS) / 1000) throw ApiError.conflict('Reach this place before interacting. Your movement was too fast.')
  return navigation
}
