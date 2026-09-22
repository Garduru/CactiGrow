import type { CollectedPlant } from '../game/gameState'
import type { GardenDisplayAssignments } from '../types/garden'
import { createPlantVisualDescriptor } from '../features/plants/plantVisualModel'
import { GARDEN_DISPLAY_ANCHORS } from './gardenDisplayAnchors'
import type { GardenDisplayProjection } from './worldTypes'
import type { PlantSpecimenV2 } from '../../shared/api/plantLifecycleV2.ts'

export function createGardenWorldProjection(ownedPlants: readonly (CollectedPlant | PlantSpecimenV2)[], assignments: GardenDisplayAssignments): GardenDisplayProjection[] {
  const ownedById = new Map(ownedPlants.map((plant) => ['specimenId' in plant ? plant.specimenId : plant.id, plant]))
  const used = new Set<string>()
  return GARDEN_DISPLAY_ANCHORS.flatMap(({ id, x, y }) => {
    const specimenId = assignments[id]
    const plant = specimenId && ownedById.get(specimenId)
    const idValue = plant && ('specimenId' in plant ? plant.specimenId : plant.id)
    if (!plant || !idValue || used.has(idValue)) return []
    used.add(idValue)
    return [{ slotId: id, specimenId: idValue, x, y, visual: createPlantVisualDescriptor(plant) }]
  })
}
