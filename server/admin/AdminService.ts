import { and, count, desc, eq, ilike, or, sql } from 'drizzle-orm'
import type { CactiGrowDatabase } from '../db/client/database.ts'
import { adminAuditLog, adminRoleAssignments, players, playerProfiles, playerOnboarding, playerSeedStacks, plantSpecimens, playerGardenSpecimens, playerGrowerState, nurseryOccupancies, cloneLines, marketplaceListings, friendships, friendRequests, playerBlocks } from '../db/schema/index.ts'
import { ApiError } from '../api/errors.ts'
import { isCanonicalUuid } from '../../shared/realtime/identifiers.ts'
import { isAdminMutation, permissionsForRole, type AdminAction, type AdminAudit, type AdminMutation, type AdminPermission, type AdminPlayerSummary, type AdminPlayerInspection, type AdminListing, type AdminSpecimen, type StaffRole } from '../../shared/api/adminV1.ts'
import { getLevelFromXp } from '../../src/features/progression/progressionModel.ts'
import { adjustPlayerBalance, adjustPlayerSkill, adjustPlayerSeeds } from '../gameplay/supportAdjustments.ts'
import { cancelMarketplaceListing } from '../gameplay/commerceTransactions.ts'
import { currentRole, requirePermission, lockStaffRoles } from './permissions.ts'

const actionPermission: Record<AdminAction, AdminPermission> = { currency: 'economy.adjust', progression: 'progression.adjust', inventory: 'inventory.adjust', role: 'roles.manage', 'cancel-listing': 'marketplace.moderate' }
function auditProjection(row: typeof adminAuditLog.$inferSelect): AdminAudit {
  return { id: row.id, actorPlayerId: row.actorPlayerId, actorRole: row.actorRole, action: row.action, targetPlayerId: row.targetPlayerId, reason: row.reason, before: row.before, after: row.after, commandId: row.commandId, createdAt: row.createdAt.toISOString() }
}
function listingProjection(row: typeof marketplaceListings.$inferSelect): AdminListing {
  return { id: row.id, sellerPlayerId: row.sellerPlayerId, specimenId: row.specimenId, price: row.askingPrice, status: row.status, createdAt: row.createdAt.toISOString() }
}
function requireId(value: string) { if (!isCanonicalUuid(value)) throw ApiError.validation('Invalid internal player or resource UUID.') }
function pageOffset(value: number) { if (!Number.isSafeInteger(value) || value < 0 || value > 10000) throw ApiError.validation('Invalid page offset.') }

export class AdminService {
  private readonly database: CactiGrowDatabase
  constructor(database: CactiGrowDatabase) { this.database = database }
  async session(actor: string, runtime: { environment: string; version: string }) {
    const role = await requirePermission(this.database, actor, 'admin.access')
    const [profile] = await this.database.select({ displayName: playerProfiles.displayName }).from(playerProfiles).where(eq(playerProfiles.playerId, actor))
    return { ...runtime, playerId: actor, displayName: profile?.displayName ?? null, role, permissions: permissionsForRole(role) }
  }
  private async summaries(where: ReturnType<typeof eq> | undefined): Promise<AdminPlayerSummary[]> {
    const rows = await this.database.select({ playerId: players.id, joinedAt: players.createdAt, publicId: playerProfiles.publicId, displayName: playerProfiles.displayName, role: adminRoleAssignments.role, cultivation: playerOnboarding.cultivationXp, breeding: playerOnboarding.breedingXp, genetics: playerOnboarding.geneticsXp }).from(players)
      .leftJoin(playerProfiles, eq(playerProfiles.playerId, players.id)).leftJoin(adminRoleAssignments, eq(adminRoleAssignments.playerId, players.id)).leftJoin(playerOnboarding, eq(playerOnboarding.playerId, players.id))
      .where(where).orderBy(players.id).limit(25)
    return rows.map(row => ({ playerId: row.playerId, publicId: row.publicId, displayName: row.displayName, joinedAt: row.joinedAt.toISOString(), role: row.role ?? 'PLAYER', totalLevel: [row.cultivation, row.breeding, row.genetics].reduce<number>((total, xp) => total + getLevelFromXp(xp ?? 0), 0), status: 'registered' }))
  }
  async search(actor: string, query: string) {
    const role = await requirePermission(this.database, actor, 'player.search')
    const q = query.trim()
    if (q.length < 2 || q.length > 80) throw ApiError.validation('Enter 2–80 characters or an exact UUID.')
    const uuid: boolean = isCanonicalUuid(q)
    const condition = uuid ? (permissionsForRole(role).includes('player.search.internal') ? or(eq(players.id, q), eq(playerProfiles.publicId, q)) : eq(playerProfiles.publicId, q)) : ilike(playerProfiles.displayName, `%${q.replace(/[\\%_]/g, '\\$&')}%`)
    return { items: await this.summaries(condition), nextOffset: null }
  }
  async inspect(actor: string, target: string): Promise<AdminPlayerInspection> {
    requireId(target)
    const role = await requirePermission(this.database, actor, 'player.inspect')
    const permissions = permissionsForRole(role)
    const [player] = await this.summaries(eq(players.id, target))
    if (!player) throw ApiError.notFound('Player not found.')
    const result: AdminPlayerInspection = { player }
    if (permissions.includes('social.inspect')) {
      const [[friends], [incoming], [outgoing], [blocks]] = await Promise.all([
        this.database.select({ total: count() }).from(friendships).where(or(eq(friendships.playerLowId, target), eq(friendships.playerHighId, target))),
        this.database.select({ total: count() }).from(friendRequests).where(and(eq(friendRequests.toPlayerId, target), eq(friendRequests.status, 'pending'))),
        this.database.select({ total: count() }).from(friendRequests).where(and(eq(friendRequests.fromPlayerId, target), eq(friendRequests.status, 'pending'))),
        this.database.select({ total: count() }).from(playerBlocks).where(eq(playerBlocks.blockerPlayerId, target)),
      ])
      result.social = { friends: friends.total, incoming: incoming.total, outgoing: outgoing.total, blocks: blocks.total }
    }
    if (permissions.includes('marketplace.inspect')) result.listings = (await this.database.select().from(marketplaceListings).where(and(eq(marketplaceListings.sellerPlayerId, target), eq(marketplaceListings.status, 'active'))).orderBy(desc(marketplaceListings.createdAt), marketplaceListings.id).limit(50)).map(listingProjection)
    if (permissions.includes('economy.inspect') || permissions.includes('progression.inspect')) {
      const [profile] = await this.database.select().from(playerOnboarding).where(eq(playerOnboarding.playerId, target))
      if (profile && permissions.includes('economy.inspect')) result.currency = profile.tokenBalance
      if (profile && permissions.includes('progression.inspect')) result.skills = [{ id: 'cultivation', xp: profile.cultivationXp }, { id: 'breeding', xp: profile.breedingXp }, { id: 'genetics', xp: profile.geneticsXp }].map(skill => ({ ...skill, level: getLevelFromXp(skill.xp) }))
    }
    if (permissions.includes('inventory.inspect')) result.seeds = (await this.database.select().from(playerSeedStacks).where(eq(playerSeedStacks.playerId, target)).limit(50)).map(row => ({ speciesId: row.speciesId, quantity: row.quantity }))
    if (permissions.includes('specimen.inspect')) {
      const [[specimens], [favorites]] = await Promise.all([this.database.select({ total: count() }).from(plantSpecimens).where(and(eq(plantSpecimens.ownerPlayerId, target), eq(plantSpecimens.lifecycleStatus, 'owned'))), this.database.select({ total: count() }).from(playerGardenSpecimens).where(and(eq(playerGardenSpecimens.playerId, target), eq(playerGardenSpecimens.favorite, true)))])
      result.specimenCount = specimens.total; result.favoriteCount = favorites.total
    }
    return result
  }
  async specimen(actor: string, id: string): Promise<AdminSpecimen> {
    requireId(id); await requirePermission(this.database, actor, 'specimen.inspect')
    const [row] = await this.database.select({ specimen: plantSpecimens, speciesId: cloneLines.speciesId }).from(plantSpecimens).innerJoin(cloneLines, eq(cloneLines.id, plantSpecimens.cloneLineId)).where(eq(plantSpecimens.id, id))
    if (!row) throw ApiError.notFound('Specimen not found.')
    const p = row.specimen
    const [[meta], [occupancy], [listing], [state]] = await Promise.all([this.database.select().from(playerGardenSpecimens).where(and(eq(playerGardenSpecimens.playerId, p.ownerPlayerId), eq(playerGardenSpecimens.specimenId, id))), this.database.select().from(nurseryOccupancies).where(eq(nurseryOccupancies.specimenId, id)), this.database.select().from(marketplaceListings).where(and(eq(marketplaceListings.specimenId, id), eq(marketplaceListings.status, 'active'))), this.database.select().from(playerGrowerState).where(eq(playerGrowerState.playerId, p.ownerPlayerId))])
    return { id, ownerPlayerId: p.ownerPlayerId, speciesId: row.speciesId, cloneLineId: p.cloneLineId, lifecycleStatus: p.lifecycleStatus, plantedAt: p.plantedAt.toISOString(), collectedAt: p.collectedAt?.toISOString() ?? null, readyAt: occupancy?.readyAt.toISOString() ?? null, favorite: meta?.favorite ?? false, researchDepth: state?.research.records[p.cloneLineId]?.analysisDepth ?? 'Unresearched', activeListingId: listing?.id ?? null }
  }
  async listings(actor: string, offset: number, filter = '') {
    await requirePermission(this.database, actor, 'marketplace.inspect'); pageOffset(offset)
    if (filter && !isCanonicalUuid(filter)) throw ApiError.validation('Listing filter requires an exact listing, seller or specimen UUID.')
    const rows = await this.database.select().from(marketplaceListings).where(and(eq(marketplaceListings.status, 'active'), filter ? or(eq(marketplaceListings.id, filter), eq(marketplaceListings.sellerPlayerId, filter), eq(marketplaceListings.specimenId, filter)) : undefined)).orderBy(desc(marketplaceListings.createdAt), marketplaceListings.id).limit(51).offset(offset)
    return { items: rows.slice(0, 50).map(listingProjection), nextOffset: rows.length > 50 ? offset + 50 : null }
  }
  async audit(actor: string, offset: number, filters: { actor?: string; target?: string; action?: string }) {
    await requirePermission(this.database, actor, 'audit.read'); pageOffset(offset)
    if (filters.actor) requireId(filters.actor); if (filters.target) requireId(filters.target)
    if (filters.action && !['CURRENCY_ADJUSTED', 'SKILL_XP_ADJUSTED', 'SEEDS_ADJUSTED', 'ROLE_ASSIGNED', 'ROLE_CHANGED', 'ROLE_REMOVED', 'OWNER_BOOTSTRAPPED', 'MARKETPLACE_LISTING_CANCELLED_BY_ADMIN'].includes(filters.action)) throw ApiError.validation('Unsupported audit action filter.')
    const rows = await this.database.select().from(adminAuditLog).where(and(filters.actor ? eq(adminAuditLog.actorPlayerId, filters.actor) : undefined, filters.target ? eq(adminAuditLog.targetPlayerId, filters.target) : undefined, filters.action ? eq(adminAuditLog.action, filters.action) : undefined)).orderBy(desc(adminAuditLog.createdAt), adminAuditLog.id).limit(51).offset(offset)
    return { items: rows.slice(0, 50).map(auditProjection), nextOffset: rows.length > 50 ? offset + 50 : null }
  }
  async roles(actor: string, offset = 0) {
    await requirePermission(this.database, actor, 'roles.read'); pageOffset(offset)
    const rows = await this.database.select({ playerId: adminRoleAssignments.playerId, role: adminRoleAssignments.role, displayName: playerProfiles.displayName }).from(adminRoleAssignments).leftJoin(playerProfiles, eq(playerProfiles.playerId, adminRoleAssignments.playerId)).orderBy(adminRoleAssignments.playerId).limit(51).offset(offset)
    return { items: rows.slice(0, 50), nextOffset: rows.length > 50 ? offset + 50 : null }
  }
  async mutate(actor: string, target: string, action: AdminAction, input: unknown) {
    requireId(target)
    // Authorization precedes payload handling and is repeated under the transaction's role lock.
    await requirePermission(this.database, actor, actionPermission[action])
    if (!isAdminMutation(input, action)) throw ApiError.validation('A valid bounded adjustment, command UUID, explicit confirmation and 3–240 character reason are required.')
    const command: AdminMutation = { ...input, reason: input.reason.trim() }
    const canonical = JSON.stringify({ target, action, ...Object.fromEntries(Object.entries(command).sort(([a], [b]) => a.localeCompare(b))) })
    const fingerprint = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical))), b => b.toString(16).padStart(2, '0')).join('')
    return this.database.transaction(async tx => {
      await lockStaffRoles(tx, action === 'role')
      const role = await requirePermission(tx, actor, actionPermission[action])
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${actor + ':admin-mutations'}, 0))`)
      const [receipt] = await tx.select().from(adminAuditLog).where(and(eq(adminAuditLog.actorPlayerId, actor), eq(adminAuditLog.commandId, command.commandId)))
      if (receipt) {
        if (receipt.requestFingerprint !== fingerprint) throw new ApiError('IDEMPOTENCY_KEY_REUSED', 409, 'Admin command ID already used.')
        return { audit: auditProjection(receipt), replayed: true }
      }
      const now = new Date()
      let targetPlayerId = target, event: string, before: AdminAudit['before'], after: AdminAudit['after']
      if (action === 'cancel-listing') {
        const listing = await cancelMarketplaceListing(tx, target, now)
        targetPlayerId = listing.sellerPlayerId; event = 'MARKETPLACE_LISTING_CANCELLED_BY_ADMIN'
        before = { listingId: listing.id, specimenId: listing.specimenId, status: listing.status, price: listing.askingPrice }
        after = { ...before, status: 'cancelled' }
      } else {
        const [player] = await tx.select({ id: players.id }).from(players).where(eq(players.id, target))
        if (!player) throw ApiError.notFound('Player not found.')
        if (action === 'role') {
          const previous = await currentRole(tx, target), next = command.role!
          if (next === 'OWNER' && command.confirmOwnerPlayerId !== target) throw ApiError.validation('OWNER promotion requires confirmation of the exact internal UUID.')
          if (previous === 'OWNER' && next !== 'OWNER') {
            const [owners] = await tx.select({ total: count() }).from(adminRoleAssignments).where(eq(adminRoleAssignments.role, 'OWNER'))
            if (owners.total <= 1) throw ApiError.conflict('The last OWNER cannot be demoted or removed.')
          }
          if (previous === next) throw ApiError.conflict('The player already has this role.')
          if (next === 'PLAYER') await tx.delete(adminRoleAssignments).where(eq(adminRoleAssignments.playerId, target))
          else await tx.insert(adminRoleAssignments).values({ playerId: target, role: next as Exclude<StaffRole, 'PLAYER'>, assignedByPlayerId: actor, assignedAt: now, updatedAt: now }).onConflictDoUpdate({ target: adminRoleAssignments.playerId, set: { role: next as Exclude<StaffRole, 'PLAYER'>, assignedByPlayerId: actor, updatedAt: now } })
          event = next === 'PLAYER' ? 'ROLE_REMOVED' : previous === 'PLAYER' ? 'ROLE_ASSIGNED' : 'ROLE_CHANGED'; before = { role: previous }; after = { role: next }
        } else {
          const change = action === 'currency' ? await adjustPlayerBalance(tx, target, command.delta!) : action === 'progression' ? await adjustPlayerSkill(tx, target, command.skillId!, command.delta!) : await adjustPlayerSeeds(tx, target, command.speciesId!, command.delta!, now)
          const key = action === 'currency' ? 'balance' : action === 'progression' ? 'xp' : 'quantity'
          const identity: AdminAudit['before'] = action === 'progression' ? { skillId: command.skillId! } : action === 'inventory' ? { speciesId: command.speciesId! } : {}
          before = { ...identity, [key]: change.before }; after = { ...identity, [key]: change.after, requestedDelta: command.delta!, appliedDelta: change.after - change.before }
          event = action === 'currency' ? 'CURRENCY_ADJUSTED' : action === 'progression' ? 'SKILL_XP_ADJUSTED' : 'SEEDS_ADJUSTED'
        }
      }
      const [record] = await tx.insert(adminAuditLog).values({ id: crypto.randomUUID(), actorPlayerId: actor, actorRole: role, action: event, targetPlayerId, reason: command.reason, before, after, commandId: command.commandId, requestFingerprint: fingerprint, createdAt: now }).returning()
      return { audit: auditProjection(record), replayed: false }
    })
  }
}
