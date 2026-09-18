import type { GardenDisplaySlotId } from '../types/garden'

// Visual display positions only; they are not planting, growth, or ownership slots.
export const GARDEN_DISPLAY_ANCHORS = [
  { id: 'garden-display-back-left', x: 2250, y: 390 },
  { id: 'garden-display-back-center', x: 2390, y: 390 },
  { id: 'garden-display-back-right', x: 2530, y: 390 },
  { id: 'garden-display-front-left', x: 2250, y: 455 },
  { id: 'garden-display-front-center', x: 2390, y: 455 },
  { id: 'garden-display-front-right', x: 2530, y: 455 },
] as const satisfies readonly { id: GardenDisplaySlotId; x: number; y: number }[]
