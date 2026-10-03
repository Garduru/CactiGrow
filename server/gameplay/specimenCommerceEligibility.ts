import { and, eq } from 'drizzle-orm'
import type { CactiGrowDatabase } from '../db/client/database.ts'
import { playerGardenSpecimens } from '../db/schema/index.ts'
import { ApiError } from '../api/errors.ts'
import { isProtectedFromTransfer } from '../../src/features/garden/collectionManagement.ts'

type Transaction = Parameters<Parameters<CactiGrowDatabase['transaction']>[0]>[0]

// Call while holding the specimen lock, shared with Garden favorite updates.
// Future explicit protection flags belong here, not in individual sale screens.
export async function assertSpecimenUnprotected(tx: Transaction, playerId: string, specimenId: string) {
  const [metadata] = await tx.select().from(playerGardenSpecimens).where(and(eq(playerGardenSpecimens.playerId, playerId), eq(playerGardenSpecimens.specimenId, specimenId))).limit(1)
  if (isProtectedFromTransfer(metadata)) throw new ApiError('CONFLICT', 409, 'This plant is favorited. Unfavorite it before selling or trading.')
}
