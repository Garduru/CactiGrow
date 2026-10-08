import { isCanonicalUuid } from '../realtime/identifiers.ts'
import { isStartingExperience, type StartingExperienceV1 } from './startingExperienceV1.ts'
import type { WorldPoint } from '../world/types.ts'
import { isFieldSurveyProjectionV1, type FieldSurveyProjectionV1 } from './fieldSurveyV1.ts'

export const EXPLORATION_INTERACTION_RADIUS = 96
export interface ExplorationProjectionV1 {
  projectionVersion: 1
  serverNow: string
  revision: number
  harvestingXp: number
  nodes: { entityId: string; areaId: string; readyAt: string | null }[]
  landmarks: { landmarkId: string; areaId: string; discoveredAt: string | null }[]
  notes: { noteId: string; areaId: string; discoveredAt: string | null }[]
}
type ExplorationCommandBase = { v: 1; commandId: string; expectedWorldRevision: number; position: WorldPoint }
export type ExplorationCommandV1 = ExplorationCommandBase & (
  | { type: 'harvest' | 'inspect'; entityId: string }
  | { type: 'discover-landmark'; landmarkId: string }
)
export type ExplorationCommandInput = ExplorationCommandV1 extends infer C ? C extends ExplorationCommandV1 ? Omit<C, 'commandId' | 'v'> : never : never
export interface ExplorationRewardV1 { name: string; speciesId: string; quantity: number; harvestingXp: number }
export interface ExplorationResultV1 { projection: ExplorationProjectionV1; starting: StartingExperienceV1; reward?: ExplorationRewardV1; fieldSurvey?: FieldSurveyProjectionV1 }
export type ExplorationDevCommandV1 = { v: 1; commandId: string; type: 'reset-landmarks' | 'reset-cooldowns'; expectedRevision: number }
export type ExplorationRestoreCommandV1 = { v: 1; commandId: string; expectedWorldRevision: number }
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const id = (value: unknown): value is string => typeof value === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(value)
const revision = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0
const timestamp = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value))
const optionalTimestamp = (value: unknown) => value === null || timestamp(value)
export function isExplorationCommandV1(value: unknown): value is ExplorationCommandV1 {
  if (!record(value) || value.v !== 1 || !isCanonicalUuid(value.commandId) || !revision(value.expectedWorldRevision)
    || !record(value.position) || Object.keys(value.position).sort().join(',') !== 'x,y'
    || ![value.position.x, value.position.y].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100000)) return false
  const target = value.type === 'discover-landmark' ? 'landmarkId' : 'entityId'
  return ['harvest', 'inspect', 'discover-landmark'].includes(String(value.type)) && id(value[target])
    && Object.keys(value).sort().join(',') === ['v', 'commandId', 'type', 'expectedWorldRevision', 'position', target].sort().join(',')
}
export function isExplorationDevCommandV1(value: unknown): value is ExplorationDevCommandV1 {
  return record(value) && Object.keys(value).sort().join(',') === 'commandId,expectedRevision,type,v'
    && value.v === 1 && isCanonicalUuid(value.commandId) && revision(value.expectedRevision)
    && (value.type === 'reset-landmarks' || value.type === 'reset-cooldowns')
}
export function isExplorationRestoreCommandV1(value: unknown): value is ExplorationRestoreCommandV1 {
  return record(value) && Object.keys(value).sort().join(',') === 'commandId,expectedWorldRevision,v'
    && value.v === 1 && isCanonicalUuid(value.commandId) && revision(value.expectedWorldRevision)
}
export function isExplorationProjectionV1(value: unknown): value is ExplorationProjectionV1 {
  if (!record(value) || value.projectionVersion !== 1 || !timestamp(value.serverNow) || !revision(value.revision)
    || !revision(value.harvestingXp) || !Array.isArray(value.nodes) || !Array.isArray(value.landmarks) || !Array.isArray(value.notes)) return false
  return value.nodes.length <= 100 && value.landmarks.length <= 100 && value.notes.length <= 100
    && value.nodes.every(n => record(n) && id(n.entityId) && id(n.areaId) && optionalTimestamp(n.readyAt))
    && value.landmarks.every(n => record(n) && id(n.landmarkId) && id(n.areaId) && optionalTimestamp(n.discoveredAt))
    && value.notes.every(n => record(n) && id(n.noteId) && id(n.areaId) && optionalTimestamp(n.discoveredAt))
}
export function isExplorationResultV1(value: unknown): value is ExplorationResultV1 {
  return record(value) && isExplorationProjectionV1(value.projection) && isStartingExperience(value.starting)
    && (value.fieldSurvey === undefined || isFieldSurveyProjectionV1(value.fieldSurvey))
    && (value.reward === undefined || (record(value.reward) && typeof value.reward.name === 'string' && value.reward.name.length <= 100
      && id(value.reward.speciesId) && Number.isSafeInteger(value.reward.quantity) && (value.reward.quantity as number) >= 3 && (value.reward.quantity as number) <= 10
      && revision(value.reward.harvestingXp)))
}
