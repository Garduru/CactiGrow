import type { FarmInteriorLocationId, FarmWorldSpawnId, TownInteriorLocationId, TownWorldSpawnId } from '../game-world/worldTypes'

export const CANONICAL_FARM_PATH = '/play' as const
export const TOWN_WORLD_RETURN_PATH = '/town' as const
export type InteriorReturnPath = typeof CANONICAL_FARM_PATH | typeof TOWN_WORLD_RETURN_PATH

export type WorldReturnNavigationState =
  | { worldReturnTo: typeof CANONICAL_FARM_PATH; worldSpawn: FarmWorldSpawnId }
  | { worldReturnTo: typeof TOWN_WORLD_RETURN_PATH; worldSpawn: TownWorldSpawnId }

export type WorldEntryNavigationState =
  | { worldSpawn: FarmWorldSpawnId }
  | { worldSpawn: TownWorldSpawnId }

const farmExteriorSpawnByLocation: Readonly<Record<FarmInteriorLocationId, FarmWorldSpawnId>> = {
  home: 'home-exterior',
  nursery: 'nursery-exterior',
  garden: 'garden-exterior',
  lab: 'lab-exterior',
  mail: 'mailbox-exterior',
}

const townExteriorSpawnByLocation: Readonly<Record<TownInteriorLocationId, TownWorldSpawnId>> = {
  shop: 'shop-exterior',
  market: 'marketplace-exterior',
}

const farmSpawnIds: readonly FarmWorldSpawnId[] = ['default', 'road-from-town', 'home-exterior', 'nursery-exterior', 'garden-exterior', 'lab-exterior', 'mailbox-exterior']
const townSpawnIds: readonly TownWorldSpawnId[] = ['farm-arrival', 'shop-exterior', 'marketplace-exterior']

export function createFarmReturnState(locationId?: FarmInteriorLocationId): WorldReturnNavigationState {
  return { worldReturnTo: CANONICAL_FARM_PATH, worldSpawn: locationId ? farmExteriorSpawnByLocation[locationId] : 'default' }
}

export function createTownReturnState(locationId: TownInteriorLocationId): WorldReturnNavigationState {
  return { worldReturnTo: TOWN_WORLD_RETURN_PATH, worldSpawn: townExteriorSpawnByLocation[locationId] }
}

export function createBuildingDestinationState(id: Exclude<FarmInteriorLocationId, 'mail'> | TownInteriorLocationId): WorldReturnNavigationState {
  return id === 'shop' || id === 'market' ? createTownReturnState(id) : createFarmReturnState(id)
}

export function createFarmTownRoadEntryState(): WorldEntryNavigationState {
  return { worldSpawn: 'road-from-town' }
}

export function createTownFarmArrivalState(): WorldEntryNavigationState {
  return { worldSpawn: 'farm-arrival' }
}

export function resolveFarmSpawnId(state: unknown): FarmWorldSpawnId {
  const spawn = getSpawnId(state)
  return farmSpawnIds.some((candidate) => candidate === spawn) ? spawn as FarmWorldSpawnId : 'default'
}

export function resolveTownSpawnId(state: unknown): TownWorldSpawnId {
  const spawn = getSpawnId(state)
  return townSpawnIds.some((candidate) => candidate === spawn) ? spawn as TownWorldSpawnId : 'farm-arrival'
}

export function resolveFarmReturnPath(state: unknown): InteriorReturnPath {
  if (typeof state === 'object' && state !== null && 'worldReturnTo' in state && state.worldReturnTo === TOWN_WORLD_RETURN_PATH) return TOWN_WORLD_RETURN_PATH
  return CANONICAL_FARM_PATH
}

function getSpawnId(state: unknown): unknown {
  return typeof state === 'object' && state !== null && 'worldSpawn' in state ? state.worldSpawn : undefined
}
