import type { TownWorldLocationId, TownWorldSpawnId } from './worldTypes'

export const TOWN_WORLD_WIDTH = 2200
export const TOWN_WORLD_HEIGHT = 1500
export const TOWN_PLAYER_SPAWN = { x: 1100, y: 1280 } as const

export interface TownColliderLayout {
  id: string
  label: string
  x: number
  y: number
  width: number
  height: number
}

export interface TownLocationLayout {
  id: TownWorldLocationId
  x: number
  y: number
  width: number
  height: number
  colliderX?: number
  colliderY?: number
  colliderWidth?: number
  colliderHeight?: number
  colliders?: readonly TownColliderLayout[]
  interactionX: number
  interactionY: number
  interactionRadius: number
  approachX: number
  approachY: number
  tapRadius: number
  visualKind: 'shop' | 'market' | 'farm-exit'
}

export const townWorldLayout: readonly TownLocationLayout[] = [
  { id: 'shop', x: 650, y: 360, width: 420, height: 250, colliderX: 649, colliderY: 336, colliderWidth: 460, colliderHeight: 261, interactionX: 650, interactionY: 505, interactionRadius: 105, approachX: 650, approachY: 560, tapRadius: 210, visualKind: 'shop' },
  { id: 'market', x: 1510, y: 380, width: 570, height: 270, colliders: [
    { id: 'main-lower-structure', label: 'Main lower structure', x: 1511, y: 365, width: 666, height: 205 },
    { id: 'upper-central-structure', label: 'Upper central structure', x: 1510, y: 243, width: 312, height: 60 },
  ], interactionX: 1510, interactionY: 468, interactionRadius: 213, approachX: 1510, approachY: 590, tapRadius: 270, visualKind: 'market' },
  { id: 'farm', x: 1100, y: 1420, width: 340, height: 90, interactionX: 1100, interactionY: 1370, interactionRadius: 130, approachX: 1100, approachY: 1300, tapRadius: 220, visualKind: 'farm-exit' },
]

export const townWorldSpawns: Readonly<Record<TownWorldSpawnId, Readonly<{ x: number; y: number }>>> = {
  'farm-arrival': TOWN_PLAYER_SPAWN,
  'shop-exterior': { x: 650, y: 560 },
  'marketplace-exterior': { x: 1510, y: 590 },
}
