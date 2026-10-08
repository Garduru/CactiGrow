import { WORLD, isWorldLocation } from '../../shared/world/world.ts'
import { isCanonicalUuid } from '../../shared/realtime/identifiers.ts'
import { isPosition } from '../../shared/realtime/areas.ts'
import { isMovementAuthorityV1 } from '../../shared/api/movementV1.ts'
import { checkpointMovement, movementNavigation, seedMovement, type MovementState } from './movementRules.ts'

export const MOVEMENT_KEY = 'movement-authority-v1'
export const movementOwnerName = (playerId: string) => `movement-v1:${playerId}`
export interface MovementStorage { get(): unknown; put(state: MovementState): void }
/** One durable player owner survives socket/Area changes and serializes all input sources. */
export class MovementOwner {
  private readonly storage: MovementStorage
  private readonly now: () => number
  constructor(storage: MovementStorage, now = Date.now) { this.storage = storage; this.now = now }
  execute(playerId: string, input: unknown) {
    if (!isCanonicalUuid(playerId) || !input || typeof input !== 'object') throw new Error('Invalid movement scope.')
    const c = input as Record<string, unknown>, now = this.now()
    const saved = this.storage.get() as MovementState | undefined
    let state = saved && saved.playerId === playerId && saved.worldVersion === WORLD.version && isMovementAuthorityV1(saved.authority)
      && Number.isFinite(saved.creditAt) && (() => {
        const map = movementNavigation(saved.authority.runtimeAreaId), point = saved.authority.position
        if (map.walkable(point)) return true
        // Authored arrivals can sit up to three units outside the body-center bounds.
        // Arcade clamps them on the first physics step; this is not client endpoint tolerance.
        const route = map.route(point, point)
        return !!route && Math.hypot(route.at(-1)!.x - point.x, route.at(-1)!.y - point.y) <= 6
      })() ? saved : undefined
    if (c.type === 'seed') {
      if (!isWorldLocation(c.location)) throw new Error('Invalid movement seed.')
      const location = c.location
      if (state && location.revision < state.authority.worldRevision) throw new Error('Stale movement scope.')
      if (!state || location.revision > state.authority.worldRevision || location.runtimeAreaId !== state.authority.runtimeAreaId) state = seedMovement(playerId, location, WORLD.version, now)
      if (location.runtimeAreaId !== state.authority.runtimeAreaId) throw new Error('Movement owner Area mismatch.')
    } else if (!state) throw new Error('Movement authority is not initialized.')
    if (!state) throw new Error('Movement authority unavailable.')
    if (c.type === 'move') {
      if (typeof c.runtimeAreaId !== 'string' || !isPosition(c.position)
        || c.expectedWorldRevision !== undefined && (!Number.isSafeInteger(c.expectedWorldRevision) || (c.expectedWorldRevision as number) < 0)) throw new Error('Invalid movement checkpoint.')
      state = checkpointMovement(state, c.runtimeAreaId, c.position, now, c.expectedWorldRevision as number | undefined)
    } else if (c.type !== 'seed' && c.type !== 'read') throw new Error('Unknown movement operation.')
    this.storage.put(state)
    return { ...state.authority, serverNow: now }
  }
}
