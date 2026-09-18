import { GARDEN_DISPLAY_SLOT_IDS, type GardenDisplayAssignments, type GardenDisplaySlotId } from '../../types/garden'

export function createGardenDisplayAssignments(): GardenDisplayAssignments {
  return Object.fromEntries(GARDEN_DISPLAY_SLOT_IDS.map((id) => [id, null])) as GardenDisplayAssignments
}

export const gardenDisplayLabels: Record<GardenDisplaySlotId, string> = {
  'garden-display-back-left': 'Back left',
  'garden-display-back-center': 'Back center',
  'garden-display-back-right': 'Back right',
  'garden-display-front-left': 'Front left',
  'garden-display-front-center': 'Front center',
  'garden-display-front-right': 'Front right',
}

export function isGardenDisplaySlotId(value: string): value is GardenDisplaySlotId {
  return GARDEN_DISPLAY_SLOT_IDS.some((id) => id === value)
}

export function assignGardenDisplay(assignments: GardenDisplayAssignments, slotId: GardenDisplaySlotId, specimenId: string): GardenDisplayAssignments {
  if (assignments[slotId] === specimenId || Object.values(assignments).includes(specimenId)) return assignments
  return { ...assignments, [slotId]: specimenId }
}

export function clearGardenDisplay(assignments: GardenDisplayAssignments, slotId: GardenDisplaySlotId): GardenDisplayAssignments {
  return assignments[slotId] === null ? assignments : { ...assignments, [slotId]: null }
}

export function clearSpecimenDisplay(assignments: GardenDisplayAssignments, specimenId: string): GardenDisplayAssignments {
  const slotId = GARDEN_DISPLAY_SLOT_IDS.find((id) => assignments[id] === specimenId)
  return slotId ? clearGardenDisplay(assignments, slotId) : assignments
}
