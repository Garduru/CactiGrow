import { areaId, isCanonicalUuid, isSequence, type AreaId } from './identifiers.ts'

export interface Position { readonly x: number; readonly y: number }
export interface AreaDefinition {
  readonly areaId: AreaId
  readonly coordinateVersion: number
  readonly bounds: { readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number }
  readonly entryPoints: Readonly<Record<string, Position>>
  readonly layerCapacity: number
  readonly populationLimit: number
  readonly emptyLayerRetentionMs: number
  readonly movement: { readonly speed: number; readonly maxUpdatesPerSecond: number; readonly positionTolerance: number }
}

// Authored Town coordinates, shared with the existing renderer without retuning.
export const TOWN_WORLD_WIDTH = 2200
export const TOWN_WORLD_HEIGHT = 1500
export const TOWN_PLAYER_SPAWN = { x: 1100, y: 1280 } as const
export const TOWN_ENTRY_POINTS = {
  'farm-arrival': TOWN_PLAYER_SPAWN,
  'shop-exterior': { x: 650, y: 560 },
  'marketplace-exterior': { x: 1510, y: 590 },
} as const

export const TOWN_AREA: AreaDefinition = {
  areaId: areaId('town'), coordinateVersion: 1,
  bounds: { minX: 0, minY: 0, maxX: TOWN_WORLD_WIDTH, maxY: TOWN_WORLD_HEIGHT },
  entryPoints: TOWN_ENTRY_POINTS,
  // Provisional operational limits, not demonstrated realtime performance.
  layerCapacity: 32, populationLimit: 128, emptyLayerRetentionMs: 30_000,
  movement: { speed: 245, maxUpdatesPerSecond: 10, positionTolerance: 2 },
}

const areas: readonly AreaDefinition[] = [TOWN_AREA]
export function getAreaDefinition(id: unknown): AreaDefinition | undefined {
  // A private Farm is a distinct chat Area, not a shared Farm channel or visit admission.
  // No Farm remote rendering or movement simulation is enabled by this definition.
  if (typeof id === 'string' && id.startsWith('farm-') && isCanonicalUuid(id.slice(5))) return {
    ...TOWN_AREA, areaId: areaId(id), entryPoints: { 'chat-session': { x: 0, y: 0 } }, layerCapacity: 1, populationLimit: 1,
  }
  return typeof id === 'string' ? areas.find((area) => area.areaId === id) : undefined
}
export function isPosition(value: unknown): value is Position {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const point = value as Record<string, unknown>
  return Object.keys(point).length === 2 && Object.hasOwn(point, 'x') && Object.hasOwn(point, 'y')
    && typeof point.x === 'number' && Number.isFinite(point.x)
    && typeof point.y === 'number' && Number.isFinite(point.y)
}
export function isWithinArea(area: AreaDefinition, point: Position): boolean {
  return isPosition(point) && point.x >= area.bounds.minX && point.x <= area.bounds.maxX
    && point.y >= area.bounds.minY && point.y <= area.bounds.maxY
}
export function isEntryPoint(area: AreaDefinition, id: unknown): id is string {
  return typeof id === 'string' && Object.hasOwn(area.entryPoints, id)
}
export function assertValidArea(area: AreaDefinition): void {
  areaId(area.areaId)
  const { bounds, movement } = area
  if (!isSequence(area.coordinateVersion) || area.coordinateVersion === 0
    || !isSequence(area.layerCapacity) || area.layerCapacity === 0
    || !isSequence(area.populationLimit) || area.populationLimit === 0
    || !isSequence(area.emptyLayerRetentionMs)
    || ![bounds.minX, bounds.minY, bounds.maxX, bounds.maxY].every(Number.isFinite)
    || bounds.minX >= bounds.maxX || bounds.minY >= bounds.maxY
    || !Number.isFinite(movement.speed) || movement.speed <= 0
    || !isSequence(movement.maxUpdatesPerSecond) || movement.maxUpdatesPerSecond === 0
    || !Number.isFinite(movement.positionTolerance) || movement.positionTolerance < 0
    || Object.keys(area.entryPoints).length === 0
    || !Object.entries(area.entryPoints).every(([id, point]) => /^[a-z][a-z0-9-]{0,63}$/.test(id) && isWithinArea(area, point))) {
    throw new Error('Invalid Area definition.')
  }
}
