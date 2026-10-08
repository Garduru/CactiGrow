import { findArea } from './world.ts'

export const TOWN_WORLD_WIDTH = findArea('town-p1')!.width
export const TOWN_WORLD_HEIGHT = findArea('town-p1')!.height
export interface TownColliderLayout { id: string; label: string; x: number; y: number; width: number; height: number }
export interface TownLocationLayout {
  id: 'shop' | 'market' | 'farm'
  x: number; y: number; width: number; height: number
  colliderX?: number; colliderY?: number; colliderWidth?: number; colliderHeight?: number
  colliders?: readonly TownColliderLayout[]
  interactionX: number; interactionY: number; interactionRadius: number
  approachX: number; approachY: number; tapRadius: number
  visualKind: 'shop' | 'market' | 'farm-exit'
}
/** Exact accepted Town layout, shared by renderer and interaction validation. */
export const TOWN_LOCATION_LAYOUT: readonly TownLocationLayout[] = [
  { id: 'shop', x: 650, y: 360, width: 420, height: 250, colliderX: 649, colliderY: 336, colliderWidth: 460, colliderHeight: 261, interactionX: 650, interactionY: 505, interactionRadius: 105, approachX: 650, approachY: 560, tapRadius: 210, visualKind: 'shop' },
  { id: 'market', x: 1510, y: 380, width: 570, height: 270, colliders: [
    { id: 'main-lower-structure', label: 'Main lower structure', x: 1511, y: 365, width: 666, height: 205 },
    { id: 'upper-central-structure', label: 'Upper central structure', x: 1510, y: 243, width: 312, height: 60 },
  ], interactionX: 1510, interactionY: 468, interactionRadius: 213, approachX: 1510, approachY: 590, tapRadius: 270, visualKind: 'market' },
  { id: 'farm', x: 1100, y: 1420, width: 340, height: 90, interactionX: 1100, interactionY: 1370, interactionRadius: 130, approachX: 1100, approachY: 1300, tapRadius: 220, visualKind: 'farm-exit' },
]
export const TOWN_BOUNDARY_COLLIDERS = [
  { x: TOWN_WORLD_WIDTH / 2, y: 58, width: TOWN_WORLD_WIDTH - 120, height: 30 },
  { x: 68, y: TOWN_WORLD_HEIGHT / 2, width: 30, height: TOWN_WORLD_HEIGHT - 100 },
  { x: TOWN_WORLD_WIDTH - 68, y: TOWN_WORLD_HEIGHT / 2, width: 30, height: TOWN_WORLD_HEIGHT - 100 },
  { x: 475, y: TOWN_WORLD_HEIGHT - 58, width: 820, height: 30 },
  { x: 1725, y: TOWN_WORLD_HEIGHT - 58, width: 820, height: 30 },
] as const
const road = TOWN_LOCATION_LAYOUT.find(layout => layout.visualKind === 'farm-exit')!
export const TOWN_ROAD_POST_COLLIDERS = [
  { x: road.x - 135, y: road.y, width: 24, height: 118 },
  { x: road.x + 135, y: road.y, width: 24, height: 118 },
] as const
export const TOWN_POST_COLLIDERS = TOWN_ROAD_POST_COLLIDERS
export const TOWN_BUILDING_COLLIDERS = TOWN_LOCATION_LAYOUT.flatMap(layout => layout.colliders
  ? layout.colliders.map(({ x, y, width, height }) => ({ x, y, width, height }))
  : layout.colliderX !== undefined && layout.colliderY !== undefined && layout.colliderWidth !== undefined && layout.colliderHeight !== undefined
    ? [{ x: layout.colliderX, y: layout.colliderY, width: layout.colliderWidth, height: layout.colliderHeight }] : [])
/** Registration order matches the original five boundary, three building and two post bodies. */
export const TOWN_COLLIDERS = [...TOWN_BOUNDARY_COLLIDERS, ...TOWN_BUILDING_COLLIDERS, ...TOWN_ROAD_POST_COLLIDERS]
