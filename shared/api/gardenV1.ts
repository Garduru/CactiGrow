import { GARDEN_DISPLAY_SLOT_IDS, type GardenDisplayAssignments, type GardenOrganizationState } from '../../src/types/garden.ts'

export interface GardenProjectionV1 { projectionVersion: 1; organization: GardenOrganizationState; displayAssignments: GardenDisplayAssignments }
export type GardenCommandV1 =
  | { type: 'favorite'; commandId: string; specimenId: string; favorite: boolean }
  | { type: 'add-tag'; commandId: string; specimenId: string; tag: string }
  | { type: 'remove-tag'; commandId: string; specimenId: string; tag: string }
  | { type: 'assign-display'; commandId: string; specimenId: string; slotId: typeof GARDEN_DISPLAY_SLOT_IDS[number] }
  | { type: 'clear-display'; commandId: string; slotId: typeof GARDEN_DISPLAY_SLOT_IDS[number] }
export type GardenCommandInputV1 = GardenCommandV1 extends infer Command ? Command extends { commandId: string } ? Omit<Command, 'commandId'> : never : never

export function isGardenCommandV1(value: unknown): value is GardenCommandV1 {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  if (typeof v.commandId !== 'string' || !/^[0-9a-f-]{36}$/i.test(v.commandId)) return false
  if (v.type === 'favorite') return Object.keys(v).length === 4 && typeof v.specimenId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.specimenId) && typeof v.favorite === 'boolean'
  if (v.type === 'add-tag' || v.type === 'remove-tag') return typeof v.specimenId === 'string' && typeof v.tag === 'string'
  if (v.type === 'assign-display') return typeof v.specimenId === 'string' && GARDEN_DISPLAY_SLOT_IDS.includes(v.slotId as never)
  return v.type === 'clear-display' && GARDEN_DISPLAY_SLOT_IDS.includes(v.slotId as never)
}
export function isGardenProjectionV1(value: unknown): value is GardenProjectionV1 {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  if (v.projectionVersion !== 1 || !v.organization || typeof v.organization !== 'object' || !v.displayAssignments || typeof v.displayAssignments !== 'object') return false
  const assignments = v.displayAssignments as Record<string, unknown>
  return GARDEN_DISPLAY_SLOT_IDS.every((slot) => assignments[slot] === null || typeof assignments[slot] === 'string')
}
