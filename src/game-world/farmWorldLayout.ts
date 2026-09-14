import type { FarmWorldLocationId } from './worldTypes'

export const FARM_WORLD_WIDTH = 3000
export const FARM_WORLD_HEIGHT = 1900
export const FARM_PLAYER_SPAWN = { x: 1500, y: 1500 } as const

export type GrayboxVisualKind = 'home' | 'greenhouse' | 'garden' | 'lab' | 'mailbox' | 'town-exit'

export interface FarmLocationLayout {
  id: FarmWorldLocationId
  x: number
  y: number
  width: number
  height: number
  approachX: number
  approachY: number
  tapRadius: number
  visualKind: GrayboxVisualKind
}

export const farmWorldLayout: readonly FarmLocationLayout[] = [
  { id: 'home', x: 1500, y: 650, width: 430, height: 300, approachX: 1500, approachY: 870, tapRadius: 280, visualKind: 'home' },
  { id: 'nursery', x: 650, y: 390, width: 560, height: 250, approachX: 650, approachY: 580, tapRadius: 320, visualKind: 'greenhouse' },
  { id: 'garden', x: 2390, y: 410, width: 590, height: 300, approachX: 2390, approachY: 630, tapRadius: 330, visualKind: 'garden' },
  { id: 'lab', x: 2420, y: 1210, width: 430, height: 290, approachX: 2180, approachY: 1210, tapRadius: 285, visualKind: 'lab' },
  { id: 'mail', x: 1120, y: 1640, width: 78, height: 116, approachX: 1220, approachY: 1640, tapRadius: 150, visualKind: 'mailbox' },
  { id: 'town', x: 1500, y: 1790, width: 360, height: 90, approachX: 1500, approachY: 1700, tapRadius: 230, visualKind: 'town-exit' },
]
