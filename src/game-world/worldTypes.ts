export type FarmWorldLocationId = 'home' | 'nursery' | 'garden' | 'lab' | 'mail' | 'town'
export type FarmWorldRoute = '/home' | '/nursery' | '/garden' | '/lab' | '/mail' | '/town'

export interface FarmWorldLocationProjection {
  id: FarmWorldLocationId
  displayName: string
  route: FarmWorldRoute
  progressionKind?: 'level' | 'tier'
  progressionValue?: number
  interactionLabel: 'Enter' | 'Check Mail'
}

export interface FarmWorldProjection {
  locations: readonly FarmWorldLocationProjection[]
}

export type WorldIntent = {
  type: 'ENTER_LOCATION'
  locationId: FarmWorldLocationId
}
