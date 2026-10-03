import { isCanonicalUuid } from '../realtime/identifiers.ts'
import type { SkillId } from '../../src/types/skill.ts'
import { skillDefinitions } from '../../src/features/progression/skillDefinitions.ts'
import { isGrowerAlphaProjectionV1, type GrowerAlphaProjectionV1 } from './growerAlphaV1.ts'
import { isPlantLifecycleProjectionV3, type PlantLifecycleProjectionV3 } from './plantLifecycleV3.ts'

export type DevCommandInput =
  | { type: 'add-xp'; skillId: SkillId; amount: number }
  | { type: 'add-currency'; amount: number }
  | { type: 'adjust-seeds'; speciesId: string; amount: number }
  | { type: 'advance-growth'; specimenId: string; minutes: number | 'complete' }
export type DevCommand = DevCommandInput & { commandId: string }
export interface DevCommandResult { commandId: string; grower: GrowerAlphaProjectionV1; lifecycle: PlantLifecycleProjectionV3 }
export interface DevSpecimenDiagnostics { specimenId: string; npcValue: number | null; npcSaleEligible: boolean; listingEligible: boolean; reason: string; favorite: boolean; activeListingId: string | null }
export function isDevCommand(value: unknown): value is DevCommand {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const v = value as Record<string, unknown>
  if (typeof v.commandId !== 'string' || !isCanonicalUuid(v.commandId)) return false
  const keys = (...expected: string[]) => Object.keys(v).length === expected.length + 2 && expected.every(k => k in v)
  const amount = (max: number) => Number.isSafeInteger(v.amount) && Number(v.amount) > 0 && Number(v.amount) <= max
  switch (v.type) {
    case 'add-xp': return keys('skillId', 'amount') && skillDefinitions.some(s => s.id === v.skillId) && amount(1_000_000)
    case 'add-currency': return keys('amount') && amount(100_000)
    case 'adjust-seeds': return keys('speciesId', 'amount') && typeof v.speciesId === 'string' && v.speciesId.length <= 100 && Number.isSafeInteger(v.amount) && Number(v.amount) !== 0 && Math.abs(Number(v.amount)) <= 100
    case 'advance-growth': return keys('specimenId', 'minutes') && typeof v.specimenId === 'string' && isCanonicalUuid(v.specimenId) && (v.minutes === 'complete' || (Number.isSafeInteger(v.minutes) && Number(v.minutes) >= 1 && Number(v.minutes) <= 60))
    default: return false
  }
}
export function isDevCommandResult(value: unknown): value is DevCommandResult {
  if (!value || typeof value !== 'object') return false
  const v = value as DevCommandResult
  return typeof v.commandId === 'string' && isCanonicalUuid(v.commandId) && isGrowerAlphaProjectionV1(v.grower) && isPlantLifecycleProjectionV3(v.lifecycle)
}
export function isDevSpecimenDiagnostics(value: unknown): value is DevSpecimenDiagnostics {
  if (!value || typeof value !== 'object') return false
  const v = value as DevSpecimenDiagnostics
  return typeof v.specimenId === 'string' && isCanonicalUuid(v.specimenId) && (v.npcValue === null || Number.isSafeInteger(v.npcValue)) && typeof v.npcSaleEligible === 'boolean' && typeof v.listingEligible === 'boolean' && typeof v.reason === 'string' && typeof v.favorite === 'boolean' && (v.activeListingId === null || typeof v.activeListingId === 'string')
}
