import { isCanonicalUuid } from '../realtime/identifiers.ts'
import { isStartingExperience, type StartingExperienceV1 } from './startingExperienceV1.ts'
import type { WorldPoint } from '../world/types.ts'

export const FIELD_SURVEY = {
  questId: 'first-basin-field-survey', title: 'First Basin Field Survey',
  npcEntityId: 'mara-basin-survey', npcAreaId: 'cross-path-1',
  landmarkIds: ['entrance-grove', 'dry-wash', 'eastern-ridge'],
  caveAreaId: 'basin-cave', caveLandmarkId: 'seeping-stone', caveNoteId: 'cave-mineral-seam-note',
  reward: { harvestingXp: 30, currency: 25 },
} as const
export interface FieldSurveyObjectivesV1 {
  landmarks: { landmarkId: string; discoveredAt: string | null }[]
  sanPedroHarvested: boolean
  peyoteHarvested: boolean
  caveEntered: boolean
  caveLandmarkDiscovered: boolean
  caveNoteInspected: boolean
}
export interface FieldSurveyProjectionV1 {
  projectionVersion: 1
  revision: number
  /** Response-only ordering across quest, exploration, world and tutorial changes. */
  progressRevision: number
  status: 'locked' | 'available' | 'active' | 'ready-to-report' | 'complete'
  acceptedAt: string | null
  completedAt: string | null
  rewardClaimed: boolean
  objectives: FieldSurveyObjectivesV1
}
export type FieldSurveyCommandV1 = { v: 1; commandId: string; type: 'accept' | 'report'; entityId: string; expectedWorldRevision: number; position: WorldPoint }
export type FieldSurveyCommandInput = Omit<FieldSurveyCommandV1, 'v' | 'commandId'>
export type FieldSurveyDevCommandV1 = { v: 1; commandId: string; type: 'reset-field-survey'; expectedRevision: number }
export interface FieldSurveyRewardV1 { harvestingXp: number; currency: number }
export interface FieldSurveyResultV1 { projection: FieldSurveyProjectionV1; starting: StartingExperienceV1; reward?: FieldSurveyRewardV1 }
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const revision = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0
const at = (value: unknown) => value === null || typeof value === 'string' && Number.isFinite(Date.parse(value))
export function isFieldSurveyCommandV1(value: unknown): value is FieldSurveyCommandV1 {
  return record(value) && Object.keys(value).sort().join(',') === 'commandId,entityId,expectedWorldRevision,position,type,v'
    && value.v === 1 && isCanonicalUuid(value.commandId) && ['accept', 'report'].includes(String(value.type))
    && value.entityId === FIELD_SURVEY.npcEntityId && revision(value.expectedWorldRevision)
    && record(value.position) && Object.keys(value.position).sort().join(',') === 'x,y'
    && [value.position.x, value.position.y].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100000)
}
export function isFieldSurveyDevCommandV1(value: unknown): value is FieldSurveyDevCommandV1 {
  return record(value) && Object.keys(value).sort().join(',') === 'commandId,expectedRevision,type,v'
    && value.v === 1 && isCanonicalUuid(value.commandId) && value.type === 'reset-field-survey' && revision(value.expectedRevision)
}
export function isFieldSurveyProjectionV1(value: unknown): value is FieldSurveyProjectionV1 {
  if (!record(value) || value.projectionVersion !== 1 || !revision(value.revision) || !revision(value.progressRevision)
    || !['locked', 'available', 'active', 'ready-to-report', 'complete'].includes(String(value.status))
    || !at(value.acceptedAt) || !at(value.completedAt) || typeof value.rewardClaimed !== 'boolean' || !record(value.objectives)) return false
  const o = value.objectives
  return Array.isArray(o.landmarks) && o.landmarks.length === FIELD_SURVEY.landmarkIds.length
    && o.landmarks.every((l, index) => record(l) && l.landmarkId === FIELD_SURVEY.landmarkIds[index] && at(l.discoveredAt))
    && ['sanPedroHarvested', 'peyoteHarvested', 'caveEntered', 'caveLandmarkDiscovered', 'caveNoteInspected'].every(key => typeof o[key] === 'boolean')
    && (value.status !== 'complete' || value.completedAt !== null && value.acceptedAt !== null && value.rewardClaimed)
    && (!['active', 'ready-to-report'].includes(String(value.status)) || value.acceptedAt !== null && value.completedAt === null)
}
export function isFieldSurveyResultV1(value: unknown): value is FieldSurveyResultV1 {
  return record(value) && isFieldSurveyProjectionV1(value.projection) && isStartingExperience(value.starting)
    && (value.reward === undefined || record(value.reward) && revision(value.reward.harvestingXp) && (value.reward.harvestingXp as number) <= FIELD_SURVEY.reward.harvestingXp
      && value.reward.currency === FIELD_SURVEY.reward.currency)
}
