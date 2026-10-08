import type { WorldArea } from './types.ts'

// Preserve the original frozen baselines while explicitly allowing only this
// milestone's named additive LDtk content. New content has its own contract tests.
export const EXPLORATION_TAG = 'first-basin-exploration-v1'
export const WILD_FIELD_NAMES = ['resourceType','rewardTable','minYield','maxYield','harvestingXp','respawnSeconds','requiredToolId','rareRollEligible']

export function originalWorldArea(area: WorldArea): WorldArea {
  const { landmarks, ...original } = area
  void landmarks
  if (!original.interactables?.length) return original
  const interactables = original.interactables.filter(e => e.tutorial)
  if (interactables.length) return { ...original, interactables }
  const { interactables: added, ...rest } = original
  void added
  return rest
}

export function originalDefinition<T extends { identifier: string; fieldDefs?: { identifier: string }[] }>(definition: T): T {
  return definition.identifier === 'HarvestablePlant' ? { ...definition, fieldDefs: definition.fieldDefs?.filter(f => !WILD_FIELD_NAMES.includes(f.identifier)) } : definition
}
