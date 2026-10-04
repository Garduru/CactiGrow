import { and, eq, isNull } from 'drizzle-orm'
import type { CactiGrowDatabase } from '../db/client/database.ts'
import { mailMessages, playerGardenSpecimens } from '../db/schema/index.ts'
import { ApiError } from '../api/errors.ts'
import { isProtectedFromTransfer } from '../../src/features/garden/collectionManagement.ts'

type Transaction = Parameters<Parameters<CactiGrowDatabase['transaction']>[0]>[0]

// Call while holding the specimen lock, shared with Garden favorite updates.
// Future explicit protection flags belong here, not in individual sale screens.
export async function assertSpecimenUnprotected(tx: Transaction, playerId: string, specimenId: string) {
  await assertSpecimenNotInMail(tx, specimenId)
  const [metadata] = await tx.select().from(playerGardenSpecimens).where(and(eq(playerGardenSpecimens.playerId, playerId), eq(playerGardenSpecimens.specimenId, specimenId))).limit(1)
  if (isProtectedFromTransfer(metadata)) throw new ApiError('CONFLICT', 409, 'This plant is favorited. Unfavorite it before selling or trading.')
}

// All callers hold the specimen lock before checking the additive reservation.
export async function assertSpecimenNotInMail(tx: Transaction, specimenId: string) {
  const [mail] = await tx.select({ id: mailMessages.id }).from(mailMessages).where(and(eq(mailMessages.specimenId, specimenId), isNull(mailMessages.claimedAt))).limit(1)
  if (mail) throw new ApiError('CONFLICT', 409, 'This specimen is reserved in Mail until the recipient claims it.')
}
