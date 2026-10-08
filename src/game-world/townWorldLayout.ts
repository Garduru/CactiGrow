import type { TownWorldSpawnId } from './worldTypes'
import { TOWN_ENTRY_POINTS } from '../../shared/realtime/areas.ts'
export { TOWN_PLAYER_SPAWN } from '../../shared/realtime/areas.ts'
export { TOWN_LOCATION_LAYOUT as townWorldLayout, TOWN_WORLD_WIDTH, TOWN_WORLD_HEIGHT } from '../../shared/world/townGeometry.ts'
export type { TownLocationLayout, TownColliderLayout } from '../../shared/world/townGeometry.ts'

export const townWorldSpawns: Readonly<Record<TownWorldSpawnId, Readonly<{ x: number; y: number }>>> = TOWN_ENTRY_POINTS
