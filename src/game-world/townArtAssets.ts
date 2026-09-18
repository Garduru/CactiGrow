import { WORLD_DEPTH } from './worldDepth'

// The full source canvas is retained. Its transparent lower margin places the
// visible foundation near Y 485 when the canvas baseline is anchored at Y 516.
export const SHOP_V1_MAIN_ART = {
  key: 'town-shop-main-v01',
  path: '/assets/world/town/shop/town-shop-main-v01.webp',
  width: 477.8638941398865,
  height: 340,
  originX: 0.5,
  originY: 1,
  anchorX: 650,
  anchorY: 516,
  depth: WORLD_DEPTH.buildings,
} as const

// Human-approved Marketplace V1 registration.
export const MARKETPLACE_V1_MAIN_ART = {
  key: 'town-marketplace-main-v01',
  path: '/assets/world/town/marketplace/town-marketplace-main-v01.webp',
  width: 700,
  height: 350,
  originX: 0.5,
  originY: 1,
  anchorX: 1510,
  anchorY: 515,
  depth: WORLD_DEPTH.buildings,
} as const
