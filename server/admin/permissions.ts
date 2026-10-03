import { eq, sql } from 'drizzle-orm'
import { adminRoleAssignments } from '../db/schema/index.ts'
import { ApiError } from '../api/errors.ts'
import { permissionsForRole, type AdminPermission, type StaffRole } from '../../shared/api/adminV1.ts'
import type { CactiGrowDatabase } from '../db/client/database.ts'
import type { GameplayTransaction } from '../gameplay/supportAdjustments.ts'

export const STAFF_ROLE_LOCK = 'cactigrow-staff-roles-v1'
export async function lockStaffRoles(tx: GameplayTransaction, exclusive = false) {
  if (exclusive) await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${STAFF_ROLE_LOCK}, 0))`)
  else await tx.execute(sql`select pg_advisory_xact_lock_shared(hashtextextended(${STAFF_ROLE_LOCK}, 0))`)
}
export async function currentRole(database: CactiGrowDatabase | GameplayTransaction, playerId: string): Promise<StaffRole> {
  const [assignment] = await database.select().from(adminRoleAssignments).where(eq(adminRoleAssignments.playerId, playerId)).limit(1)
  return assignment?.role ?? 'PLAYER'
}
export async function requirePermission(database: CactiGrowDatabase | GameplayTransaction, playerId: string, permission: AdminPermission) {
  const role = await currentRole(database, playerId)
  if (!permissionsForRole(role).includes(permission)) throw ApiError.forbidden()
  return role
}
