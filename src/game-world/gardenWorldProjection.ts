import type { CollectedPlant } from '../game/gameState'
import type { GardenDisplayAssignments } from '../types/garden'
import { createPlantVisualDescriptor } from '../features/plants/plantVisualModel'
import { GARDEN_DISPLAY_ANCHORS } from './gardenDisplayAnchors'
import type { GardenDisplayProjection } from './worldTypes'

export function createGardenWorldProjection(ownedPlants: readonly CollectedPlant[], assignments: GardenDisplayAssignments): GardenDisplayProjection[] {
  const ownedById = new Map(ownedPlants.map((plant) => [plant.id, plant]))
  const used = new Set<string>()
  return GARDEN_DISPLAY_ANCHORS.flatMap(({ id, x, y }) => {
    const specimenId = assignments[id]
    const plant = specimenId && ownedById.get(specimenId)
    if (!plant || used.has(plant.id)) return []
    used.add(plant.id)
    return [{ slotId: id, specimenId: plant.id, x, y, visual: createPlantVisualDescriptor(plant) }]
  })
}
