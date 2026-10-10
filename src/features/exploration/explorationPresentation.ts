import type { ExplorationCommandV1, ExplorationProjectionV1, ExplorationResultV1 } from '../../../shared/api/explorationV1.ts'
import type { WorldArea, WorldLandmark, WorldPoint } from '../../../shared/world/types.ts'
import { WORLD, findArea } from '../../../shared/world/world.ts'
import { getSpeciesById } from '../../data/species.ts'

export function wildNodeAvailable(projection: ExplorationProjectionV1 | null, entityId: string, now: number) {
  if (!projection) return false
  const node = projection.nodes.find(node => node.entityId === entityId)
  return !!node && (!node.readyAt || Date.parse(node.readyAt) <= now)
}
export function insideLandmark(point: WorldPoint, landmark: WorldLandmark) {
  return Math.abs(point.x - landmark.x) <= landmark.width / 2 && Math.abs(point.y - landmark.y) <= landmark.height / 2
}
/** One semantic request per physical entry; durable projection remains the source of discovery. */
export class LandmarkEntryController {
  private readonly entered = new Set<string>()
  update(area: WorldArea, position: WorldPoint, projection: ExplorationProjectionV1 | null, emit: (landmarkId: string) => boolean) {
    if (!projection) return
    for (const landmark of area.landmarks ?? []) {
      if (!insideLandmark(position, landmark)) { this.entered.delete(landmark.landmarkId); continue }
      if (projection.landmarks.some(record => record.landmarkId === landmark.landmarkId && record.discoveredAt)) continue
      if (!this.entered.has(landmark.landmarkId)) { if (emit(landmark.landmarkId)) this.entered.add(landmark.landmarkId); break }
    }
  }
}
export function explorationResultNotice(command: ExplorationCommandV1, result: ExplorationResultV1) {
  if (result.reward?.geneticLot) return { title: 'Genetic material found', detail: `Wild ${getSpeciesById(result.reward.speciesId)?.commonName} / ${result.reward.geneticLot.provenance.region} / ${result.reward.geneticLot.provenance.rarity} lot (${result.reward.geneticLot.quantity} seeds) / +${result.reward.quantity} ordinary seeds / +${result.reward.harvestingXp} Harvesting XP` }
  if (result.reward) return { title: `Harvested ${result.reward.name}`, detail: `+${result.reward.quantity} ${getSpeciesById(result.reward.speciesId)?.commonName ?? 'cactus'} seeds · +${result.reward.harvestingXp} Harvesting XP` }
  if (command.type === 'discover-landmark') {
    const landmark = WORLD.areas.flatMap(area => area.landmarks ?? []).find(landmark => landmark.landmarkId === command.landmarkId)
    return landmark ? { title: `Landmark discovered — ${landmark.displayName}` } : null
  }
  if (command.type === 'inspect') {
    const note = WORLD.areas.flatMap(area => area.interactables ?? []).find(entity => entity.entityId === command.entityId && entity.kind === 'inspectable')
    return note ? { title: note.displayName, detail: note.description } : null
  }
  return null
}
/** Unknown entries expose neither authored names nor descriptions to the rendered Journal. */
export function explorationJournalEntries(projection: ExplorationProjectionV1 | null) {
  return WORLD.areas.flatMap(area => (area.landmarks ?? []).map(landmark => {
    const discoveredAt = projection?.landmarks.find(record => record.landmarkId === landmark.landmarkId)?.discoveredAt
    return discoveredAt ? { id: landmark.landmarkId, name: landmark.displayName, area: area.displayName, description: landmark.description, discoveredAt } : { id: landmark.landmarkId, name: 'Unknown landmark', area: area.displayName, description: 'Explore this Area to add a landmark to your field record.', discoveredAt: null }
  }))
}
export function explorationJournalNotes(projection: ExplorationProjectionV1 | null) {
  return (projection?.notes ?? []).filter(record => record.discoveredAt).flatMap(record => {
    const area = findArea(record.areaId), entity = area?.interactables?.find(entity => entity.kind === 'inspectable' && entity.noteId === record.noteId)
    return entity ? [{ id: record.noteId, name: entity.displayName, area: area!.displayName, description: entity.description, discoveredAt: record.discoveredAt! }] : []
  })
}
