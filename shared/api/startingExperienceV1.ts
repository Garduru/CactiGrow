import { isCanonicalUuid } from '../realtime/identifiers.ts'

// Palette choices use the existing silhouette; no unimplemented sprite choices.
export const SKIN_COLORS = [0xd39a6b, 0xf0c8a0, 0x915e40] as const
export const SHIRT_COLORS = [0xb85e3d, 0x637957, 0x566d84] as const
export interface CharacterAppearance { skin: number; shirt: number }
export const DEFAULT_APPEARANCE: CharacterAppearance = { skin: 0, shirt: 0 }
export function isCharacterAppearance(v: unknown): v is CharacterAppearance {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false
  const a = v as CharacterAppearance
  return Object.keys(a).sort().join(',') === 'shirt,skin' && Number.isInteger(a.skin) && a.skin >= 0 && a.skin < SKIN_COLORS.length && Number.isInteger(a.shirt) && a.shirt >= 0 && a.shirt < SHIRT_COLORS.length
}
export type EquipmentSlot = 'tool' | 'head' | 'body' | 'accessory'
export type SpawnQuestStage = 'appearance' | 'meet-guide' | 'equip-tool' | 'harvest-cactus' | 'plant-pot' | 'collect-pot' | 'leave-zone' | 'complete'
export type FarmQuestStage = 'undiscovered' | 'nursery' | 'garden' | 'research' | 'breeding' | 'complete'
export interface StartingExperienceV1 {
  projectionVersion: 1; revision: number; compatibilityComplete: boolean; nameComplete: boolean
  appearance: CharacterAppearance; appearanceComplete: boolean; spawnTutorialComplete: boolean; farmTutorialComplete: boolean
  spawnStage: SpawnQuestStage; farmStage: FarmQuestStage
  equipment: Record<EquipmentSlot, 'field-knife' | null>; ownedEquipment: ('field-knife')[]
  harvestingXp: number; tutorialSeedAvailable: boolean
  pot: { specimenId: string; plantedAt: string; readyAt: string; collectedAt: string | null; growthRule: 'starting-pot-45s-v1' } | null
  tutorialParentIds: string[]; offspringSeedId: string | null
}
export type StartingCommand = { commandId: string } & (
  | { type: 'save-appearance'; appearance: CharacterAppearance }
  | { type: 'talk-guide' | 'harvest-plant' | 'plant-pot' | 'collect-pot'; entityId: string }
  | { type: 'equip-tool'; itemId: 'field-knife' | null }
  | { type: 'confirm-nursery' | 'confirm-garden' })
export type StartingCommandInput = StartingCommand extends infer C ? C extends StartingCommand ? Omit<C, 'commandId'> : never : never
export function isStartingCommand(v: unknown): v is StartingCommand {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false
  const c = v as Record<string, unknown>
  if (!isCanonicalUuid(c.commandId)) return false
  if (c.type === 'save-appearance') return Object.keys(c).length === 3 && isCharacterAppearance(c.appearance)
  if (c.type === 'equip-tool') return Object.keys(c).length === 3 && (c.itemId === null || c.itemId === 'field-knife')
  if (['talk-guide', 'harvest-plant', 'plant-pot', 'collect-pot'].includes(String(c.type))) return Object.keys(c).length === 3 && typeof c.entityId === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(c.entityId)
  return Object.keys(c).length === 2 && ['confirm-nursery', 'confirm-garden'].includes(String(c.type))
}
export function isStartingExperience(v: unknown): v is StartingExperienceV1 {
  if (!v || typeof v !== 'object') return false
  const s = v as StartingExperienceV1
  return s.projectionVersion === 1 && Number.isSafeInteger(s.revision) && s.revision >= 0 && isCharacterAppearance(s.appearance)
    && ['compatibilityComplete', 'nameComplete', 'appearanceComplete', 'spawnTutorialComplete', 'farmTutorialComplete', 'tutorialSeedAvailable'].every(k => typeof (s as unknown as Record<string, unknown>)[k] === 'boolean')
    && ['appearance','meet-guide','equip-tool','harvest-cactus','plant-pot','collect-pot','leave-zone','complete'].includes(s.spawnStage)
    && ['undiscovered','nursery','garden','research','breeding','complete'].includes(s.farmStage)
    && s.equipment != null && ['tool','head','body','accessory'].every(k => (s.equipment as Record<string,unknown>)[k] === null || (k === 'tool' && s.equipment.tool === 'field-knife'))
    && Array.isArray(s.ownedEquipment) && s.ownedEquipment.every(i => i === 'field-knife') && Number.isSafeInteger(s.harvestingXp) && s.harvestingXp >= 0
    && Array.isArray(s.tutorialParentIds) && s.tutorialParentIds.every(isCanonicalUuid) && (s.offspringSeedId === null || isCanonicalUuid(s.offspringSeedId))
    && (s.pot === null || (isCanonicalUuid(s.pot.specimenId) && s.pot.growthRule === 'starting-pot-45s-v1' && Number.isFinite(Date.parse(s.pot.plantedAt)) && Number.isFinite(Date.parse(s.pot.readyAt)) && (s.pot.collectedAt === null || Number.isFinite(Date.parse(s.pot.collectedAt)))))
}
