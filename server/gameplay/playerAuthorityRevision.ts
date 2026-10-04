import { eq } from 'drizzle-orm'
import type { CactiGrowDatabase } from '../db/client/database.ts'
import { playerOnboarding, playerGrowerState, playerPlantLifecycleVersions } from '../db/schema/index.ts'
import { ApiError } from '../api/errors.ts'
import type { PlayerAuthorityRevisionV1 } from '../../shared/api/playerAuthorityRevisionV1.ts'

/** One owner-scoped indexed read; no gameplay payloads, writes or new counters. */
export async function readPlayerAuthorityRevision(database: CactiGrowDatabase, playerId: string): Promise<PlayerAuthorityRevisionV1> {
  const [row] = await database.select({
    profileVersion: playerOnboarding.version,
    growerVersion: playerGrowerState.version,
    lifecycleVersion: playerPlantLifecycleVersions.version,
  }).from(playerOnboarding)
    .leftJoin(playerGrowerState, eq(playerGrowerState.playerId, playerOnboarding.playerId))
    .leftJoin(playerPlantLifecycleVersions, eq(playerPlantLifecycleVersions.playerId, playerOnboarding.playerId))
    .where(eq(playerOnboarding.playerId, playerId)).limit(1)
  if (!row) throw ApiError.notFound('Player progression is unavailable.')
  return { projectionVersion: 1, profileVersion: row.profileVersion, growerVersion: row.growerVersion ?? 0, lifecycleVersion: row.lifecycleVersion ?? 0 }
}
