import { isCanonicalUuid } from '../realtime/identifiers.ts'
import { isStartingExperience, type StartingExperienceV1 } from './startingExperienceV1.ts'
import { isWorldLocation } from '../world/world.ts'
import type { WorldLocation } from '../world/types.ts'

export interface StartingResetCommand { commandId: string; targetPlayerId: string; confirmPlayerId: string; mode: 'tutorial' | 'full-onboarding' }
export interface StartingResetResult {
  commandId: string; targetPlayerId: string; starting: StartingExperienceV1; location: WorldLocation
  retiredSpecimenIds: string[]; retiredSeedIds: string[]
  clearedNurserySlots?: string[]
}
export function isStartingResetCommand(value: unknown): value is StartingResetCommand {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const v = value as StartingResetCommand
  return Object.keys(v).sort().join(',') === 'commandId,confirmPlayerId,mode,targetPlayerId'
    && ['tutorial', 'full-onboarding'].includes(v.mode)
    && isCanonicalUuid(v.commandId) && isCanonicalUuid(v.targetPlayerId) && v.confirmPlayerId === v.targetPlayerId
}
export function isStartingResetResult(value: unknown): value is StartingResetResult {
  if (!value || typeof value !== 'object') return false
  const v = value as StartingResetResult
  return isCanonicalUuid(v.commandId) && isCanonicalUuid(v.targetPlayerId) && isStartingExperience(v.starting) && isWorldLocation(v.location)
    && Array.isArray(v.retiredSpecimenIds) && v.retiredSpecimenIds.every(isCanonicalUuid)
    && Array.isArray(v.retiredSeedIds) && v.retiredSeedIds.every(isCanonicalUuid)
    && (v.clearedNurserySlots === undefined || (Array.isArray(v.clearedNurserySlots) && v.clearedNurserySlots.every(s => /^slot-[1-8]$/.test(s))))
}
