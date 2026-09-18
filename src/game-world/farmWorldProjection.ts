import type { PropertyState } from '../types/property'
import type { GeneticsLabState } from '../types/lab'
import { farmLocations, resolveWorldBuilding } from '../features/farm/locations'
import type { FarmWorldProjection } from './worldTypes'
import type { CollectedPlant } from '../game/gameState'
import type { GardenDisplayAssignments } from '../types/garden'
import { createGardenWorldProjection } from './gardenWorldProjection'

export function createFarmWorldProjection(property: PropertyState, lab: GeneticsLabState, ownedPlants: readonly CollectedPlant[], displayAssignments: GardenDisplayAssignments): FarmWorldProjection {
  const farmBuildingIds = ['home', 'nursery', 'garden', 'lab'] as const
  return {
    gardenDisplays: createGardenWorldProjection(ownedPlants, displayAssignments),
    locations: [
      ...farmBuildingIds.map((id) => {
        const definition = farmLocations.find((location) => location.id === id)!
        const building = resolveWorldBuilding(definition, property, lab)
        return {
          id,
          displayName: building.displayName,
          route: building.route as '/home' | '/nursery' | '/garden' | '/lab',
          progressionKind: id === 'lab' ? 'tier' as const : 'level' as const,
          progressionValue: building.level,
          interactionLabel: 'Enter' as const,
        }
      }),
      { id: 'mail', displayName: 'Mailbox', route: '/mail', interactionLabel: 'Check Mail' },
      { id: 'town', displayName: 'Road to Town', route: '/town', interactionLabel: 'Travel' },
    ],
  }
}
