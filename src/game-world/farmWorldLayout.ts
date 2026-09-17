import type { FarmWorldLocationId, FarmWorldSpawnId } from './worldTypes'

export const FARM_WORLD_WIDTH = 3000
export const FARM_WORLD_HEIGHT = 1900
export const FARM_PLAYER_SPAWN = { x: 1500, y: 1500 } as const
export const FARM_TOWN_ROAD_RETURN_SPAWN = { x: 1500, y: 1660 } as const
export const NURSERY_PATH_ENDPOINT = { x: 680, y: 555 } as const

export const MAILBOX_V1_COLLIDERS = [
  { name: 'LOWER', x: 1117, y: 1586, width: 247, height: 104 },
  { name: 'UPPER', x: 1124, y: 1491, width: 174, height: 90 },
] as const

export const MAILBOX_APPROACH_POINTS = [
  { name: 'FRONT', x: 1120, y: 1665 },
  { name: 'BACK', x: 1120, y: 1435 },
  { name: 'LEFT', x: 965, y: 1575 },
  { name: 'RIGHT', x: 1275, y: 1575 },
] as const

export type GrayboxVisualKind = 'home' | 'greenhouse' | 'garden' | 'lab' | 'mailbox' | 'town-exit'

export interface FarmLocationLayout {
  id: FarmWorldLocationId
  x: number
  y: number
  width: number
  height: number
  approachX: number
  approachY: number
  interactionX?: number
  interactionY?: number
  interactionRadius?: number
  tapRadius: number
  visualKind: GrayboxVisualKind
}

export const farmWorldLayout: readonly FarmLocationLayout[] = [
  { id: 'home', x: 1500, y: 650, width: 430, height: 300, approachX: 1500, approachY: 870, tapRadius: 280, visualKind: 'home' },
  { id: 'nursery', x: 650, y: 390, width: 560, height: 260, approachX: 680, approachY: 550, interactionX: 680, interactionY: 525, interactionRadius: 90, tapRadius: 140, visualKind: 'greenhouse' },
  { id: 'garden', x: 2390, y: 410, width: 590, height: 300, approachX: 2390, approachY: 630, tapRadius: 330, visualKind: 'garden' },
  { id: 'lab', x: 2420, y: 1210, width: 430, height: 290, approachX: 2420, approachY: 1425, tapRadius: 285, visualKind: 'lab' },
  { id: 'mail', x: 1120, y: 1640, width: 78, height: 116, approachX: 1220, approachY: 1665, interactionX: 1120, interactionY: 1575, interactionRadius: 160, tapRadius: 150, visualKind: 'mailbox' },
  { id: 'town', x: 1500, y: 1790, width: 360, height: 90, approachX: 1500, approachY: 1700, tapRadius: 230, visualKind: 'town-exit' },
]

export const farmWorldSpawns: Readonly<Record<FarmWorldSpawnId, Readonly<{ x: number; y: number }>>> = {
  default: FARM_PLAYER_SPAWN,
  'road-from-town': FARM_TOWN_ROAD_RETURN_SPAWN,
  'home-exterior': { x: 1500, y: 870 },
  'nursery-exterior': { x: 680, y: 550 },
  'garden-exterior': { x: 2390, y: 630 },
  'lab-exterior': { x: 2420, y: 1425 },
  'mailbox-exterior': { x: 1220, y: 1665 },
}
