import { and, eq, sql } from 'drizzle-orm'
import type { CactiGrowDatabase } from '../db/client/database.ts'
import { playerOnboarding, playerSeedStacks, playerPlantLifecycleVersions } from '../db/schema/index.ts'
import { ApiError } from '../api/errors.ts'
import { addXp } from '../../src/features/progression/progressionModel.ts'
import { SHOP_CATALOG, MAX_ECONOMY_INTEGER } from './shopCatalog.ts'
export type GameplayTransaction = Parameters<Parameters<CactiGrowDatabase['transaction']>[0]>[0]
export async function adjustPlayerBalance(tx: GameplayTransaction, playerId: string, delta: number) {
  const [profile] = await tx.select().from(playerOnboarding).where(eq(playerOnboarding.playerId, playerId)).for('update')
  if (!profile) throw ApiError.notFound('Player progression is unavailable.')
  const after = profile.tokenBalance + delta
  if (!Number.isSafeInteger(delta) || !Number.isSafeInteger(after) || after < 0 || after > MAX_ECONOMY_INTEGER) throw ApiError.validation('Currency adjustment exceeds the available balance or storage capacity.')
  await tx.update(playerOnboarding).set({ tokenBalance: after, version: profile.version + 1 }).where(eq(playerOnboarding.playerId, playerId))
  return { before: profile.tokenBalance, after }
}
export async function adjustPlayerSkill(tx: GameplayTransaction, playerId: string, skillId: 'cultivation' | 'breeding' | 'genetics', delta: number) {
  const key = ({ cultivation: 'cultivationXp', breeding: 'breedingXp', genetics: 'geneticsXp' } as const)[skillId]
  if (!key || !Number.isSafeInteger(delta)) throw ApiError.validation('Invalid XP adjustment.')
  const [profile] = await tx.select().from(playerOnboarding).where(eq(playerOnboarding.playerId, playerId)).for('update')
  if (!profile) throw ApiError.notFound('Player progression is unavailable.')
  const before = profile[key]
  const after = delta > 0 ? addXp(before, delta) : before + delta
  if (after === null || after < 0) throw ApiError.validation('XP cannot become negative.')
  await tx.update(playerOnboarding).set({ [key]: after, version: profile.version + 1 }).where(eq(playerOnboarding.playerId, playerId))
  return { before, after }
}
export async function adjustPlayerSeeds(tx: GameplayTransaction, playerId: string, speciesId: string, delta: number, now: Date) {
  if (!SHOP_CATALOG.some(item => item.speciesId === speciesId)) throw ApiError.validation('Unsupported seed species.')
  await tx.insert(playerSeedStacks).values({ playerId, speciesId, quantity: 0 }).onConflictDoNothing()
  const [stack] = await tx.select().from(playerSeedStacks).where(and(eq(playerSeedStacks.playerId, playerId), eq(playerSeedStacks.speciesId, speciesId))).for('update')
  const after = stack.quantity + delta
  if (!Number.isSafeInteger(delta) || !Number.isSafeInteger(after) || after < 0 || after > MAX_ECONOMY_INTEGER) throw ApiError.validation('Seed adjustment exceeds the available stack or storage capacity.')
  await tx.update(playerSeedStacks).set({ quantity: after, version: stack.version + 1, updatedAt: now }).where(and(eq(playerSeedStacks.playerId, playerId), eq(playerSeedStacks.speciesId, speciesId)))
  await tx.insert(playerPlantLifecycleVersions).values({ playerId, version: 1, updatedAt: now }).onConflictDoUpdate({ target: playerPlantLifecycleVersions.playerId, set: { version: sql`${playerPlantLifecycleVersions.version} + 1`, updatedAt: now } })
  return { before: stack.quantity, after }
}
