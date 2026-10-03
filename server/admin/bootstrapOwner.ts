import { count, eq } from 'drizzle-orm'
import type { CactiGrowDatabase } from '../db/client/database.ts'
import { players, adminRoleAssignments, adminAuditLog } from '../db/schema/index.ts'
import { lockStaffRoles } from './permissions.ts'
import { isCanonicalUuid } from '../../shared/realtime/identifiers.ts'
import { ApiError } from '../api/errors.ts'

/** Direct owner-connection CLI only. Never exported from an HTTP route. */
export async function bootstrapOwner(database: CactiGrowDatabase, playerId: string, confirmPlayerId: string) {
  if (!isCanonicalUuid(playerId) || confirmPlayerId !== playerId) throw ApiError.validation('Confirm the exact internal player UUID.')
  return database.transaction(async tx => {
    await lockStaffRoles(tx, true)
    const [player] = await tx.select({ id: players.id }).from(players).where(eq(players.id, playerId))
    if (!player) throw ApiError.notFound('The exact player does not exist.')
    const [owners] = await tx.select({ total: count() }).from(adminRoleAssignments).where(eq(adminRoleAssignments.role, 'OWNER'))
    if (owners.total) throw ApiError.conflict('An OWNER already exists. Use authenticated role management.')
    const [existing] = await tx.select().from(adminRoleAssignments).where(eq(adminRoleAssignments.playerId, playerId))
    const now = new Date(), commandId = crypto.randomUUID()
    await tx.insert(adminRoleAssignments).values({ playerId, role: 'OWNER', assignedByPlayerId: playerId, assignedAt: now, updatedAt: now }).onConflictDoUpdate({ target: adminRoleAssignments.playerId, set: { role: 'OWNER', assignedByPlayerId: playerId, updatedAt: now } })
    await tx.insert(adminAuditLog).values({ id: crypto.randomUUID(), actorPlayerId: playerId, actorRole: 'OWNER', action: 'OWNER_BOOTSTRAPPED', targetPlayerId: playerId, reason: 'Initial OWNER bootstrap through direct owner CLI', before: { role: existing?.role ?? 'PLAYER', source: 'owner-cli' }, after: { role: 'OWNER', source: 'owner-cli' }, commandId, requestFingerprint: 'owner-cli-bootstrap-v1', createdAt: now })
    return { playerId, role: 'OWNER', commandId }
  })
}
