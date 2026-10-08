import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import type { CactiGrowDatabase } from '../db/client/database.ts'
import { bredSeeds, cloneLines, nurseryOccupancies, plantSpecimens, playerGardenDisplays, playerGrowerEvents, playerOnboarding, playerPlantLifecycleVersions, playerProfiles } from '../db/schema/index.ts'
import { ApiError } from '../api/errors.ts'
import { lockStaffRoles, requirePermission } from '../admin/permissions.ts'
import { isStartingResetCommand, type StartingResetCommand, type StartingResetResult } from '../../shared/api/startingResetV1.ts'
import { initialLocation } from '../../shared/world/world.ts'
import { initialStartingState, loadStartingState, lockStartingOwner, saveStartingState, STARTING_PROFILE, TUTORIAL_ORIGIN } from './startingState.ts'

export const STARTING_RESET_EVENT = 'starting-experience-reset-v1'
const WORLD_EVENT = 'world-foundation-location-v1'
/** Retain practice identities/genetics/lineage for audit; only retire them from playable inventory. */
export async function retiredTutorialMaterial(database: Pick<CactiGrowDatabase, 'select'>, playerId: string) {
  const [event] = await database.select({ payload: playerGrowerEvents.payload }).from(playerGrowerEvents)
    .where(and(eq(playerGrowerEvents.playerId, playerId), eq(playerGrowerEvents.eventType, STARTING_RESET_EVENT)))
    .orderBy(desc(sql`(${playerGrowerEvents.payload}->>'revision')::integer`)).limit(1)
  const saved = event?.payload as { retiredSpecimenIds?: string[]; retiredSeedIds?: string[] } | undefined
  return { retiredSpecimenIds: saved?.retiredSpecimenIds ?? [], retiredSeedIds: saved?.retiredSeedIds ?? [] }
}

export class StartingResetService {
  private readonly database: CactiGrowDatabase
  private readonly environment: string
  constructor(database: CactiGrowDatabase, environment: string) { this.database = database; this.environment = environment }
  async execute(actorPlayerId: string, command: StartingResetCommand): Promise<StartingResetResult> {
    if (!['staging', 'development'].includes(this.environment)) throw ApiError.notFound('API route not found.')
    if (!isStartingResetCommand(command)) throw ApiError.validation('Confirm the exact target player UUID.')
    const target = command.targetPlayerId, fingerprint = JSON.stringify(command)
    return this.database.transaction(async tx => {
      // Lock staff authorization through commit for cross-account operations.
      if (actorPlayerId !== target) {
        await lockStaffRoles(tx)
        await requirePermission(tx, actorPlayerId, 'progression.adjust')
        await requirePermission(tx, actorPlayerId, 'inventory.adjust')
      }
      const owner = await lockStartingOwner(tx, target)
      const [profile] = await tx.select().from(playerProfiles).where(eq(playerProfiles.playerId, target)).limit(1)
      if (!profile) throw ApiError.conflict('Choose a character name before resetting Starting Experience.')
      const [receipt] = await tx.select({ payload: playerGrowerEvents.payload }).from(playerGrowerEvents)
        .where(and(eq(playerGrowerEvents.playerId, target), eq(playerGrowerEvents.eventType, STARTING_RESET_EVENT), eq(playerGrowerEvents.sourceCommandId, command.commandId))).limit(1)
      if (receipt) {
        const saved = receipt.payload as { actorPlayerId: string; fingerprint: string; result: StartingResetResult }
        if (saved.actorPlayerId !== actorPlayerId || saved.fingerprint !== fingerprint) throw ApiError.conflict('Reset command ID was already used.')
        return saved.result
      }
      const previous = await loadStartingState(tx, target, owner.profileId)
      const [world] = await tx.select({ payload: playerGrowerEvents.payload }).from(playerGrowerEvents)
        .where(and(eq(playerGrowerEvents.playerId, target), eq(playerGrowerEvents.eventType, WORLD_EVENT)))
        .orderBy(desc(sql`(${playerGrowerEvents.payload}->>'revision')::integer`)).limit(1)
      // Partial resets preserve normal cultivation; full resets release actual Nursery occupancy.
      // Archive physical identities in the existing audit, without inventing a sale or deleting lineage.
      const previouslyRetired = await retiredTutorialMaterial(tx, target)
      const occupancies = await tx.select().from(nurseryOccupancies).where(eq(nurseryOccupancies.playerId, target)).orderBy(nurseryOccupancies.slotId).for('update')
      const growing = command.mode === 'full-onboarding'
        ? await tx.select({ id: plantSpecimens.id }).from(plantSpecimens).where(and(eq(plantSpecimens.ownerPlayerId, target), eq(plantSpecimens.lifecycleStatus, 'growing'))) : []
      const specimens = await tx.select({ id: plantSpecimens.id }).from(plantSpecimens)
        .innerJoin(cloneLines, eq(cloneLines.id, plantSpecimens.cloneLineId))
        .where(and(eq(plantSpecimens.ownerPlayerId, target), eq(cloneLines.originPlayerId, target), eq(cloneLines.originType, TUTORIAL_ORIGIN)))
      const seeds = await tx.select({ id: bredSeeds.id }).from(bredSeeds)
        .innerJoin(cloneLines, eq(cloneLines.id, bredSeeds.cloneLineId))
        .where(and(eq(bredSeeds.ownerPlayerId, target), eq(cloneLines.originPlayerId, target), eq(cloneLines.originType, TUTORIAL_ORIGIN)))
      const cleared = command.mode === 'full-onboarding' ? occupancies : occupancies.filter(s => specimens.some(p => p.id === s.specimenId))
      const retiredSpecimenIds = [...new Set([...previouslyRetired.retiredSpecimenIds, ...specimens.map(s => s.id), ...growing.map(s => s.id), ...cleared.map(s => s.specimenId)])]
      const retiredSeedIds = [...new Set([...previouslyRetired.retiredSeedIds, ...seeds.map(s => s.id)])]
      if (cleared.length) await tx.delete(nurseryOccupancies).where(and(eq(nurseryOccupancies.playerId, target), inArray(nurseryOccupancies.slotId, cleared.map(s => s.slotId))))
      if (retiredSpecimenIds.length) await tx.delete(playerGardenDisplays).where(and(eq(playerGardenDisplays.playerId, target), inArray(playerGardenDisplays.specimenId, retiredSpecimenIds)))
      const now = new Date(), starting = initialStartingState(false), location = initialLocation(profile.publicId)
      starting.nameComplete = command.mode === 'tutorial'; starting.revision = previous.revision
      location.revision = Number((world?.payload as { revision?: number } | undefined)?.revision ?? 0) + 1
      await tx.update(playerOnboarding).set({ profileId: STARTING_PROFILE, tutorialStartedAt: null, tutorialCompletedAt: null, version: owner.version + 1 }).where(eq(playerOnboarding.playerId, target))
      await saveStartingState(tx, target, starting, command.commandId, now)
      await tx.insert(playerGrowerEvents).values({ id: crypto.randomUUID(), playerId: target, sourceCommandId: command.commandId, eventType: WORLD_EVENT, occurredAt: now, payload: location })
      await tx.insert(playerPlantLifecycleVersions).values({ playerId: target, version: 1, updatedAt: now }).onConflictDoUpdate({ target: playerPlantLifecycleVersions.playerId, set: { version: sql`${playerPlantLifecycleVersions.version} + 1`, updatedAt: now } })
      const result = { commandId: command.commandId, targetPlayerId: target, starting, location, retiredSpecimenIds, retiredSeedIds, clearedNurserySlots: cleared.map(s => s.slotId) }
      await tx.insert(playerGrowerEvents).values({ id: crypto.randomUUID(), playerId: target, sourceCommandId: command.commandId, eventType: STARTING_RESET_EVENT, occurredAt: now,
        payload: { actorPlayerId, mode: command.mode, fingerprint, revision: starting.revision, previousProfileId: owner.profileId, previousSpawnStage: previous.spawnStage, previousFarmStage: previous.farmStage, ...result, result } })
      return result
    })
  }
}
