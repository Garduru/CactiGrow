import { and, desc, eq, sql } from 'drizzle-orm'
import type { CactiGrowDatabase } from '../db/client/database.ts'
import { playerGrowerEvents, playerOnboarding } from '../db/schema/index.ts'
import { DEFAULT_APPEARANCE, isStartingExperience, type StartingExperienceV1 } from '../../shared/api/startingExperienceV1.ts'
import { ApiError } from '../api/errors.ts'
export type StartingTransaction = Parameters<Parameters<CactiGrowDatabase['transaction']>[0]>[0]
export const STARTING_PROFILE = 'starting-experience-v1'
export const STARTING_EVENT = 'starting-experience-checkpoint-v1'
export const TUTORIAL_ORIGIN = 'starting-experience-tutorial'
export function initialStartingState(compatibilityComplete: boolean): StartingExperienceV1 {
  return { projectionVersion: 1, revision: 0, compatibilityComplete, nameComplete: false, appearance: { ...DEFAULT_APPEARANCE }, appearanceComplete: compatibilityComplete,
    spawnTutorialComplete: compatibilityComplete, farmTutorialComplete: compatibilityComplete, spawnStage: compatibilityComplete ? 'complete' : 'appearance', farmStage: compatibilityComplete ? 'complete' : 'undiscovered',
    equipment: { tool: null, head: null, body: null, accessory: null }, ownedEquipment: [], harvestingXp: 0, tutorialSeedAvailable: false, farmSeedAvailable: false, pot: null, tutorialParentIds: [], offspringSeedId: null }
}
// Same canonical onboarding owner row as WorldService. Callers hold it through commit.
export async function lockStartingOwner(tx: StartingTransaction, playerId: string) {
  const [owner] = await tx.select().from(playerOnboarding).where(eq(playerOnboarding.playerId, playerId)).for('update').limit(1)
  if (!owner) throw ApiError.conflict('Player onboarding is not initialized.')
  return owner
}
export async function loadStartingState(tx: StartingTransaction, playerId: string, profileId: string) {
  const [event] = await tx.select({ payload: playerGrowerEvents.payload }).from(playerGrowerEvents).where(and(eq(playerGrowerEvents.playerId, playerId), eq(playerGrowerEvents.eventType, STARTING_EVENT))).orderBy(desc(sql`(${playerGrowerEvents.payload}->>'revision')::integer`)).limit(1)
  if (!event) return initialStartingState(profileId !== STARTING_PROFILE)
  if (!isStartingExperience(event.payload)) throw ApiError.conflict('The tutorial checkpoint needs recovery. No rewards were changed.')
  const state = structuredClone(event.payload)
  Reflect.deleteProperty(state, 'fingerprint')
  return state
}
export async function saveStartingState(tx: StartingTransaction, playerId: string, state: StartingExperienceV1, commandId: string, now: Date, fingerprint?: string) {
  state.revision++
  await tx.insert(playerGrowerEvents).values({ id: crypto.randomUUID(), playerId, eventType: STARTING_EVENT, sourceCommandId: commandId, occurredAt: now, payload: { ...state, ...(fingerprint ? { fingerprint } : {}) } })
}
export async function progressWorldTutorial(tx: StartingTransaction, playerId: string, fromAreaId: string, toAreaId: string, physical: boolean, commandId: string) {
  const [owner] = await tx.select().from(playerOnboarding).where(eq(playerOnboarding.playerId, playerId)).limit(1)
  if (!owner) return
  const state = await loadStartingState(tx, playerId, owner.profileId)
  if (state.compatibilityComplete) return
  if (!state.appearanceComplete) throw ApiError.conflict('Choose your appearance before exploring.')
  if (physical && fromAreaId === 'cross-path-1' && toAreaId !== 'player-farm' && !state.farmTutorialComplete) throw ApiError.conflict('Visit your Farm first. Learn the basics before exploring farther.')
  let changed = false
  if (physical && fromAreaId === 'path-1' && toAreaId === 'cross-path-1' && !state.spawnTutorialComplete) {
    if (state.spawnStage !== 'leave-zone') throw ApiError.conflict('Collect the plant from the Path 1 tutorial pot before leaving the Starting Zone.')
    state.spawnStage = 'complete'; state.spawnTutorialComplete = true; changed = true
  }
  if (physical && toAreaId === 'player-farm' && state.spawnTutorialComplete && state.farmStage === 'undiscovered') { state.farmStage = 'nursery'; state.farmSeedAvailable = true; changed = true }
  if (changed) await saveStartingState(tx, playerId, state, commandId, new Date())
}
