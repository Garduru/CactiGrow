import { eq } from 'drizzle-orm'
import type { CactiGrowDatabase } from '../db/client/database.ts'
import {
  bredSeeds, gameplayCommandReceipts, nurseryOccupancies, plantSpecimens,
  playerGrowerState, playerOnboarding, playerPlantLifecycleVersions, playerSeedStacks,
} from '../db/schema/index.ts'
import { createGeneticsLabState } from '../../src/features/lab/labModel.ts'
import { createPropertyState } from '../../src/features/property/propertyModel.ts'
import { createAchievementProgress } from '../../src/features/achievements/achievementsModel.ts'
import { createSpeciesDiscoveries } from '../../src/features/journal/journalModel.ts'

export const GROWER_ALPHA_PROFILE = {
  id: 'grower-alpha-v1',
  cultivationXp: 0,
  tokenBalance: 0,
  starterSeeds: [
    { speciesId: 'echinopsis-pachanoi', quantity: 4 },
    { speciesId: 'lophophora-williamsii', quantity: 2 },
  ],
} as const

// Called only after staging Access JWT verification and durable player resolution.
// The unique onboarding row serializes concurrent first requests. An existing
// gameplay footprint is never mistaken for a fresh player, even with zero seeds.
export async function initializeStagingGrower(database: CactiGrowDatabase, playerId: string): Promise<void> {
  await database.transaction(async (transaction) => {
    const created = await transaction.insert(playerOnboarding).values({
      playerId,
      profileId: GROWER_ALPHA_PROFILE.id,
      cultivationXp: GROWER_ALPHA_PROFILE.cultivationXp,
      tokenBalance: GROWER_ALPHA_PROFILE.tokenBalance,
    }).onConflictDoNothing().returning({ playerId: playerOnboarding.playerId })
    await transaction.insert(playerGrowerState).values({
      playerId,
      achievements: createAchievementProgress(),
      discoveries: createSpeciesDiscoveries(GROWER_ALPHA_PROFILE.starterSeeds.map((seed) => ({ speciesId: seed.speciesId, source: 'starter' as const, sourceRef: `starter:${seed.speciesId}` })), Date.now()),
      lab: createGeneticsLabState(),
      property: createPropertyState(Date.now()),
    }).onConflictDoNothing()
    if (!created.length) return

    const footprints = await Promise.all([
      transaction.select({ playerId: playerSeedStacks.playerId }).from(playerSeedStacks).where(eq(playerSeedStacks.playerId, playerId)).limit(1),
      transaction.select({ playerId: playerPlantLifecycleVersions.playerId }).from(playerPlantLifecycleVersions).where(eq(playerPlantLifecycleVersions.playerId, playerId)).limit(1),
      transaction.select({ playerId: plantSpecimens.ownerPlayerId }).from(plantSpecimens).where(eq(plantSpecimens.ownerPlayerId, playerId)).limit(1),
      transaction.select({ playerId: bredSeeds.ownerPlayerId }).from(bredSeeds).where(eq(bredSeeds.ownerPlayerId, playerId)).limit(1),
      transaction.select({ playerId: nurseryOccupancies.playerId }).from(nurseryOccupancies).where(eq(nurseryOccupancies.playerId, playerId)).limit(1),
      transaction.select({ playerId: gameplayCommandReceipts.playerId }).from(gameplayCommandReceipts).where(eq(gameplayCommandReceipts.playerId, playerId)).limit(1),
    ])
    if (footprints.some((rows) => rows.length > 0)) return

    await transaction.insert(playerSeedStacks).values(GROWER_ALPHA_PROFILE.starterSeeds.map((seed) => ({
      playerId, speciesId: seed.speciesId, quantity: seed.quantity, version: 1,
    })))
    await transaction.insert(playerPlantLifecycleVersions).values({ playerId, version: 0 })
    await transaction.update(playerOnboarding).set({ starterGrantedAt: new Date() }).where(eq(playerOnboarding.playerId, playerId))
  })
}
