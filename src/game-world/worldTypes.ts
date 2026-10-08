export type FarmWorldLocationId = 'home' | 'nursery' | 'garden' | 'lab' | 'mail' | 'town'
export type FarmInteriorLocationId = Exclude<FarmWorldLocationId, 'town'>
export type FarmWorldSpawnId = 'default' | 'road-from-town' | 'home-exterior' | 'nursery-exterior' | 'garden-exterior' | 'lab-exterior' | 'mailbox-exterior'
export type FarmWorldRoute = '/home' | '/nursery' | '/garden' | '/lab' | '/mail' | '/town'
export type TownWorldLocationId = 'shop' | 'market' | 'farm'
export type TownInteriorLocationId = Exclude<TownWorldLocationId, 'farm'>
export type TownWorldSpawnId = 'farm-arrival' | 'shop-exterior' | 'marketplace-exterior'
export type TownWorldRoute = '/shop' | '/market' | '/play'
export type WorldLocationId = FarmWorldLocationId | TownWorldLocationId
export type WorldRoute = FarmWorldRoute | TownWorldRoute

export interface WorldLocationProjection {
  id: WorldLocationId
  displayName: string
  travelLabel?: string
  route: WorldRoute
  progressionKind?: 'level' | 'tier'
  progressionValue?: number
  interactionLabel: 'Enter' | 'Check Mail' | 'Travel'
}

import type { GardenDisplaySlotId } from '../types/garden'
import type { PlantVisualDescriptor } from '../types/plantVisual'

export interface GardenDisplayProjection {
  slotId: GardenDisplaySlotId
  specimenId: string
  x: number
  y: number
  visual: PlantVisualDescriptor
}

export interface WorldProjection {
  locations: readonly WorldLocationProjection[]
  gardenDisplays?: readonly GardenDisplayProjection[]
}

export type FarmWorldLocationProjection = WorldLocationProjection & { id: FarmWorldLocationId; route: FarmWorldRoute }
export type TownWorldLocationProjection = WorldLocationProjection & { id: TownWorldLocationId; route: TownWorldRoute }
export interface FarmWorldProjection extends WorldProjection { locations: readonly FarmWorldLocationProjection[]; gardenDisplays: readonly GardenDisplayProjection[] }
export interface TownWorldProjection extends WorldProjection { locations: readonly TownWorldLocationProjection[] }

export type WorldIntent =
  | { type: 'ENTER_LOCATION'; locationId: WorldLocationId; position?: { x: number; y: number } }
  | { type: 'OPEN_PLAYER_PROFILE'; publicId: string }
