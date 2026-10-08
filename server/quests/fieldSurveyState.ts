import { and, desc, eq, sql } from 'drizzle-orm'
import { playerGrowerEvents } from '../db/schema/index.ts'
import { ApiError } from '../api/errors.ts'
import type { StartingTransaction } from '../starting/startingState.ts'
import { FIELD_SURVEY, type FieldSurveyRewardV1 } from '../../shared/api/fieldSurveyV1.ts'

export const FIELD_SURVEY_EVENT = 'first-basin-field-survey-checkpoint-v1'
export const FIELD_SURVEY_REWARD_EVENT = 'first-basin-field-survey-reward-v1'
export interface FieldSurveyCheckpoint { projectionVersion: 1; revision: number; acceptedAt: string | null; completedAt: string | null }
const timestamp = (value: unknown) => value === null || typeof value === 'string' && Number.isFinite(Date.parse(value))
export async function loadFieldSurveyState(tx: StartingTransaction, playerId: string): Promise<FieldSurveyCheckpoint> {
  const [event] = await tx.select({ payload: playerGrowerEvents.payload }).from(playerGrowerEvents)
    .where(and(eq(playerGrowerEvents.playerId, playerId), eq(playerGrowerEvents.eventType, FIELD_SURVEY_EVENT)))
    .orderBy(desc(sql`(${playerGrowerEvents.payload}->>'revision')::integer`)).limit(1)
  if (!event) return { projectionVersion: 1, revision: 0, acceptedAt: null, completedAt: null }
  const s = event.payload as FieldSurveyCheckpoint
  if (s.projectionVersion !== 1 || !Number.isSafeInteger(s.revision) || s.revision < 0 || !timestamp(s.acceptedAt) || !timestamp(s.completedAt)
    || s.completedAt !== null && s.acceptedAt === null) throw ApiError.conflict('The Field Survey checkpoint needs recovery. No rewards were changed.')
  return { projectionVersion: 1, revision: s.revision, acceptedAt: s.acceptedAt, completedAt: s.completedAt }
}
export async function loadFieldSurveyReward(tx: StartingTransaction, playerId: string): Promise<FieldSurveyRewardV1 | null> {
  const [event] = await tx.select({ payload: playerGrowerEvents.payload }).from(playerGrowerEvents)
    .where(and(eq(playerGrowerEvents.playerId, playerId), eq(playerGrowerEvents.eventType, FIELD_SURVEY_REWARD_EVENT))).limit(1)
  if (!event) return null
  const reward = (event.payload as { reward?: FieldSurveyRewardV1 }).reward
  if (!reward || !Number.isSafeInteger(reward.harvestingXp) || reward.harvestingXp < 0 || reward.harvestingXp > FIELD_SURVEY.reward.harvestingXp || reward.currency !== FIELD_SURVEY.reward.currency) {
    throw ApiError.conflict('The Field Survey reward record needs recovery. No rewards were changed.')
  }
  return { ...reward }
}
export async function saveFieldSurveyState(tx: StartingTransaction, playerId: string, state: FieldSurveyCheckpoint, commandId: string, now: Date, fingerprint: string, reward?: FieldSurveyRewardV1) {
  state.revision++
  await tx.insert(playerGrowerEvents).values({ id: crypto.randomUUID(), playerId, eventType: FIELD_SURVEY_EVENT, sourceCommandId: commandId, occurredAt: now,
    payload: { ...state, fingerprint, ...(reward ? { reward } : {}) } })
}
