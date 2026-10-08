import { isCanonicalUuid } from '../realtime/identifiers.ts'
import { isCharacterAppearance, type CharacterAppearance } from '../characters/appearance.ts'
export { DEFAULT_APPEARANCE, SHIRT_COLORS, SKIN_COLORS, isCharacterAppearance } from '../characters/appearance.ts'
export type { CharacterAppearance } from '../characters/appearance.ts'
export type EquipmentSlot = 'tool' | 'head' | 'body' | 'accessory'
export type SpawnQuestStage = 'appearance' | 'meet-guide' | 'equip-tool' | 'harvest-cactus' | 'plant-pot' | 'collect-pot' | 'collect-ready' | 'leave-zone' | 'complete'
export type FarmQuestStage = 'undiscovered' | 'nursery' | 'garden' | 'lab' | 'research' | 'breeding' | 'complete'
export interface StartingExperienceV1 {
  serverNow?: string; projectionVersion: 1; revision: number; compatibilityComplete: boolean; nameComplete: boolean
  appearance: CharacterAppearance; appearanceComplete: boolean; spawnTutorialComplete: boolean; farmTutorialComplete: boolean
  spawnStage: SpawnQuestStage; farmStage: FarmQuestStage
  equipment: Record<EquipmentSlot, 'field-knife' | null>; ownedEquipment: ('field-knife')[]
  harvestingXp: number; tutorialSeedAvailable: boolean; farmSeedAvailable?: boolean
  pot: { specimenId: string; plantedAt: string; readyAt: string; collectedAt: string | null; growthRule: 'starting-pot-45s-v1' | 'starting-pot-15s-v1' } | null
  tutorialParentIds: string[]; offspringSeedId: string | null
}
export type StartingCommand = { commandId: string } & (
  | { type: 'save-appearance'; appearance: CharacterAppearance }
  | { type: 'talk-guide' | 'harvest-plant' | 'plant-pot' | 'collect-pot'; entityId: string }
  | { type: 'visit-lab' }
  | { type: 'equip-tool'; itemId: 'field-knife' | null })
export type StartingCommandInput = StartingCommand extends infer C ? C extends StartingCommand ? Omit<C, 'commandId'> : never : never
export function isStartingCommand(v: unknown): v is StartingCommand {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false
  const c = v as Record<string, unknown>
  if (!isCanonicalUuid(c.commandId)) return false
  if (c.type === 'visit-lab') return Object.keys(c).length === 2
  if (c.type === 'save-appearance') return Object.keys(c).length === 3 && isCharacterAppearance(c.appearance)
  if (c.type === 'equip-tool') return Object.keys(c).length === 3 && (c.itemId === null || c.itemId === 'field-knife')
  if (['talk-guide', 'harvest-plant', 'plant-pot', 'collect-pot'].includes(String(c.type))) return Object.keys(c).length === 3 && typeof c.entityId === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(c.entityId)
  return false
}
export function isStartingExperience(v: unknown): v is StartingExperienceV1 {
  if (!v || typeof v !== 'object') return false
  const s = v as StartingExperienceV1
  return (s.serverNow === undefined || (typeof s.serverNow === 'string' && Number.isFinite(Date.parse(s.serverNow)))) && s.projectionVersion === 1 && Number.isSafeInteger(s.revision) && s.revision >= 0 && isCharacterAppearance(s.appearance)
    && (s.farmSeedAvailable === undefined || typeof s.farmSeedAvailable === 'boolean')
    && ['compatibilityComplete', 'nameComplete', 'appearanceComplete', 'spawnTutorialComplete', 'farmTutorialComplete', 'tutorialSeedAvailable'].every(k => typeof (s as unknown as Record<string, unknown>)[k] === 'boolean')
    && ['appearance','meet-guide','equip-tool','harvest-cactus','plant-pot','collect-pot','collect-ready','leave-zone','complete'].includes(s.spawnStage)
    && ['undiscovered','nursery','garden','lab','research','breeding','complete'].includes(s.farmStage)
    && s.equipment != null && ['tool','head','body','accessory'].every(k => (s.equipment as Record<string,unknown>)[k] === null || (k === 'tool' && s.equipment.tool === 'field-knife'))
    && Array.isArray(s.ownedEquipment) && s.ownedEquipment.every(i => i === 'field-knife') && Number.isSafeInteger(s.harvestingXp) && s.harvestingXp >= 0
    && Array.isArray(s.tutorialParentIds) && s.tutorialParentIds.every(isCanonicalUuid) && (s.offspringSeedId === null || isCanonicalUuid(s.offspringSeedId))
    && (s.pot === null || (isCanonicalUuid(s.pot.specimenId) && ['starting-pot-45s-v1','starting-pot-15s-v1'].includes(s.pot.growthRule) && Number.isFinite(Date.parse(s.pot.plantedAt)) && Number.isFinite(Date.parse(s.pot.readyAt)) && (s.pot.collectedAt === null || Number.isFinite(Date.parse(s.pot.collectedAt)))))
}
