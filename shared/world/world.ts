import { WORLD } from './generatedWorld.ts'
import type { WorldArea, WorldLocation } from './types.ts'
import { isCanonicalUuid } from '../realtime/identifiers.ts'
export { WORLD }
export const zoneName = (id: string) => WORLD.zones.find(z => z.zoneId === id)?.displayName ?? 'Unknown Zone'
export const findArea = (id: string) => WORLD.areas.find(a => a.areaId === id)
export function discoveredTravelAreas(location: WorldLocation) {
  return WORLD.areas.filter(a => a.travelDestinationId && a.areaId !== location.areaId
    && location.discoveredAreaIds.includes(a.areaId) && location.discoveredTravelDestinationIds.includes(a.travelDestinationId))
}
/** Locked Farm/Town each expose one road interaction. Its destination belongs to LDtk. */
export function authoredRoadExit(area: WorldArea) {
  if (area.areaType !== 'farm' && area.areaType !== 'town') return undefined
  if (area.exits.length !== 1) throw new Error(`Expected one authored road exit in ${area.areaId}.`)
  return area.exits[0]
}
export function runtimeAreaId(area: WorldArea, publicId: string) {
  if (!isCanonicalUuid(publicId)) throw new Error('Invalid owner identity.')
  return area.areaType === 'farm' ? `farm-${publicId}` : area.areaType === 'town' ? 'town' : area.areaId
}
export function areaFromRuntime(id: string): WorldArea | undefined {
  if (id === 'town') return WORLD.areas.find(a => a.areaType === 'town')
  if (id.startsWith('farm-') && isCanonicalUuid(id.slice(5))) return WORLD.areas.find(a => a.areaType === 'farm')
  const area = findArea(id)
  return area && area.areaType !== 'farm' && area.areaType !== 'town' ? area : undefined
}
export function initialLocation(publicId: string): WorldLocation {
  const a = WORLD.areas.find(a => a.areaType === 'tutorial')!
  const s = a.spawns.find(s => s.entryId === 'default')!
  return { projectionVersion: 1, revision: 0, areaId: a.areaId, runtimeAreaId: runtimeAreaId(a, publicId), zoneId: a.zoneId, entryId: s.entryId,
    position: { x: s.x, y: s.y }, discoveredAreaIds: [a.areaId], discoveredTravelDestinationIds: [] }
}
export function isWorldLocation(v: unknown): v is WorldLocation {
  if (!v || typeof v !== 'object') return false
  const s = v as WorldLocation, a = typeof s.areaId === 'string' ? findArea(s.areaId) : undefined
  return s.projectionVersion === 1 && Number.isSafeInteger(s.revision) && s.revision >= 0 && !!a && a.zoneId === s.zoneId
    && typeof s.runtimeAreaId === 'string' && areaFromRuntime(s.runtimeAreaId)?.areaId === a.areaId && a.spawns.some(e => e.entryId === s.entryId)
    && !!s.position && Number.isFinite(s.position.x) && Number.isFinite(s.position.y) && s.position.x >= 0 && s.position.y >= 0 && s.position.x < a.width && s.position.y < a.height
    && Array.isArray(s.discoveredAreaIds) && s.discoveredAreaIds.every(id => !!findArea(id))
    && Array.isArray(s.discoveredTravelDestinationIds) && s.discoveredTravelDestinationIds.every(id => WORLD.areas.some(a => a.travelDestinationId === id))
}
