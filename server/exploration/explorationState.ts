import { and, desc, eq, sql } from 'drizzle-orm'
import { playerGrowerEvents } from '../db/schema/index.ts'
import { ApiError } from '../api/errors.ts'
import type { StartingTransaction } from '../starting/startingState.ts'
import type { WorldPoint } from '../../shared/world/types.ts'
import type { ExplorationRewardV1 } from '../../shared/api/explorationV1.ts'

export const EXPLORATION_EVENT = 'first-basin-exploration-checkpoint-v1'
export interface ExplorationCheckpoint {
  projectionVersion: 1
  revision: number
  cooldowns: Record<string, string>
  landmarks: Record<string, string>
  notes: Record<string, string>
  wildHarvestingXp: number
  anchor: { areaId: string; worldRevision: number; position: WorldPoint; at: string } | null
}
const timestamps = (value: unknown) => !!value && typeof value === 'object' && !Array.isArray(value)
  && Object.entries(value).length <= 100 && Object.entries(value).every(([key, at]) => /^[a-z][a-z0-9-]{0,63}$/.test(key) && typeof at === 'string' && Number.isFinite(Date.parse(at)))
export async function loadExplorationState(tx: StartingTransaction, playerId: string): Promise<ExplorationCheckpoint> {
  const [event] = await tx.select({ payload: playerGrowerEvents.payload }).from(playerGrowerEvents)
    .where(and(eq(playerGrowerEvents.playerId, playerId), eq(playerGrowerEvents.eventType, EXPLORATION_EVENT)))
    .orderBy(desc(sql`(${playerGrowerEvents.payload}->>'revision')::integer`)).limit(1)
  if (!event) return { projectionVersion: 1, revision: 0, cooldowns: {}, landmarks: {}, notes: {}, wildHarvestingXp: 0, anchor: null }
  const s = event.payload as ExplorationCheckpoint
  if (s.projectionVersion !== 1 || !Number.isSafeInteger(s.revision) || s.revision < 0
    || !Number.isSafeInteger(s.wildHarvestingXp) || s.wildHarvestingXp < 0 || !timestamps(s.cooldowns) || !timestamps(s.landmarks) || !timestamps(s.notes)
    || (s.anchor !== null && (!s.anchor || typeof s.anchor.areaId !== 'string' || !Number.isSafeInteger(s.anchor.worldRevision) || s.anchor.worldRevision < 0
      || !s.anchor.position || ![s.anchor.position.x, s.anchor.position.y].every(Number.isFinite) || !Number.isFinite(Date.parse(s.anchor.at))))) {
    throw ApiError.conflict('The exploration checkpoint needs recovery. No rewards were changed.')
  }
  return { projectionVersion: 1, revision: s.revision, cooldowns: { ...s.cooldowns }, landmarks: { ...s.landmarks }, notes: { ...s.notes }, wildHarvestingXp: s.wildHarvestingXp,
    anchor: s.anchor ? { ...s.anchor, position: { ...s.anchor.position } } : null }
}
export async function saveExplorationState(tx: StartingTransaction, playerId: string, state: ExplorationCheckpoint, commandId: string, now: Date, fingerprint: string, reward?: ExplorationRewardV1) {
  state.revision++
  await tx.insert(playerGrowerEvents).values({ id: crypto.randomUUID(), playerId, eventType: EXPLORATION_EVENT, sourceCommandId: commandId, occurredAt: now,
    payload: { ...state, fingerprint, ...(reward ? { reward } : {}) } })
}
