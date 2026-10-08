import { MAILBOX_V1_COLLIDERS, farmWorldLayout } from '../../src/game-world/farmWorldLayout.ts'
export const NURSERY_COLLIDER_BOUNDS = { left: 395, right: 935, top: 310, bottom: 455 } as const
export const NURSERY_ACTIVE_COLLIDER = {
  x: (NURSERY_COLLIDER_BOUNDS.left + NURSERY_COLLIDER_BOUNDS.right) / 2,
  y: (NURSERY_COLLIDER_BOUNDS.top + NURSERY_COLLIDER_BOUNDS.bottom) / 2,
  width: NURSERY_COLLIDER_BOUNDS.right - NURSERY_COLLIDER_BOUNDS.left,
  height: NURSERY_COLLIDER_BOUNDS.bottom - NURSERY_COLLIDER_BOUNDS.top,
} as const
export const HOME_COLLIDERS = [
  { name: 'main body', x: 1500, y: 702.5, width: 508, height: 115 },
  { name: 'left wing', x: 1328, y: 632.5, width: 164, height: 35 },
  { name: 'right wing', x: 1672, y: 632.5, width: 164, height: 35 },
  { name: 'upper gable', x: 1500, y: 612.5, width: 240, height: 75 },
  { name: 'chimney', x: 1588, y: 565, width: 56, height: 50 },
] as const
export const LAB_PROVISIONAL_COLLIDERS = [
  { name: 'lower body', x: 2382, y: 1257.5, width: 460, height: 135 },
  { name: 'central dome', x: 2412.5, y: 1145, width: 205, height: 110 },
  { name: 'right technical', x: 2558.5, y: 1148, width: 107, height: 104 },
  { name: 'left AC', x: 2224, y: 1174, width: 72, height: 52 },
] as const
export const GARDEN_V1_EXTERIOR_COLLIDER = { x: 2390, y: 420, width: 600, height: 220 } as const

export const FARM_BOUNDARY_COLLIDERS = [
  { x: 1500, y: 90, width: 2820, height: 34 },
  { x: 90, y: 950, width: 34, height: 1720 },
  { x: 2910, y: 950, width: 34, height: 1720 },
  { x: 705, y: 1810, width: 1230, height: 34 },
  { x: 2295, y: 1810, width: 1230, height: 34 },
] as const
const road = farmWorldLayout.find(l => l.id === 'town')!
export const FARM_ROAD_COLLIDERS = [
  { x: road.x - 135, y: road.y, width: 24, height: 118 },
  { x: road.x + 135, y: road.y, width: 24, height: 118 },
]
export const FARM_COLLIDERS = [...FARM_BOUNDARY_COLLIDERS, GARDEN_V1_EXTERIOR_COLLIDER, ...MAILBOX_V1_COLLIDERS, ...FARM_ROAD_COLLIDERS, NURSERY_ACTIVE_COLLIDER, ...HOME_COLLIDERS, ...LAB_PROVISIONAL_COLLIDERS]
