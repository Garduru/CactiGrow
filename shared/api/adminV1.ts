import { isCanonicalUuid } from '../realtime/identifiers.ts'

export const staffRoles = ['PLAYER', 'MODERATOR', 'ADMIN', 'OWNER'] as const
export type StaffRole = typeof staffRoles[number]
export const moderatorPermissions = ['admin.access', 'player.search', 'player.inspect', 'social.inspect', 'marketplace.inspect', 'marketplace.moderate'] as const
export const adminPermissions = [...moderatorPermissions, 'player.search.internal', 'economy.inspect', 'economy.adjust', 'progression.inspect', 'progression.adjust', 'inventory.inspect', 'inventory.adjust', 'specimen.inspect', 'audit.read'] as const
export const ownerPermissions = [...adminPermissions, 'roles.read', 'roles.manage'] as const
export type AdminPermission = typeof ownerPermissions[number]
export function permissionsForRole(role: StaffRole): readonly AdminPermission[] {
  return role === 'OWNER' ? ownerPermissions : role === 'ADMIN' ? adminPermissions : role === 'MODERATOR' ? moderatorPermissions : []
}
export interface AdminSession { playerId: string; displayName: string | null; role: StaffRole; permissions: readonly AdminPermission[]; environment: string; version: string }
export interface AdminPlayerSummary { playerId: string; publicId: string | null; displayName: string | null; joinedAt: string; role: StaffRole; totalLevel: number; status: 'registered' }
export interface AdminListing { id: string; sellerPlayerId: string; specimenId: string; price: number; status: string; createdAt: string }
export interface AdminPlayerInspection { player: AdminPlayerSummary; social?: { friends: number; incoming: number; outgoing: number; blocks: number }; listings?: AdminListing[]; currency?: number; skills?: { id: string; xp: number; level: number }[]; seeds?: { speciesId: string; quantity: number }[]; specimenCount?: number; favoriteCount?: number }
export interface AdminSpecimen { id: string; ownerPlayerId: string; speciesId: string; cloneLineId: string; lifecycleStatus: string; plantedAt: string; collectedAt: string | null; readyAt: string | null; favorite: boolean; researchDepth: string; activeListingId: string | null }
export interface AdminAudit { id: string; actorPlayerId: string; actorRole: StaffRole; action: string; targetPlayerId: string | null; reason: string; before: Record<string, string | number | boolean | null>; after: Record<string, string | number | boolean | null>; commandId: string; createdAt: string }
export interface AdminPage<T> { items: T[]; nextOffset: number | null }
export interface AdminRoleEntry { playerId: string; displayName: string | null; role: StaffRole }
export interface AdminMutationResult { audit: AdminAudit; replayed: boolean }
export interface AdminMutation { commandId: string; reason: string; confirmed: true; delta?: number; skillId?: 'cultivation' | 'breeding' | 'genetics'; speciesId?: string; role?: StaffRole; confirmOwnerPlayerId?: string }
export type AdminAction = 'currency' | 'progression' | 'inventory' | 'role' | 'cancel-listing'
export function isAdminMutation(value: unknown, action: AdminAction): value is AdminMutation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const v = value as Record<string, unknown>
  const extra = action === 'currency' ? ['delta'] : action === 'progression' ? ['delta', 'skillId'] : action === 'inventory' ? ['delta', 'speciesId'] : action === 'role' ? ['role', 'confirmOwnerPlayerId'] : []
  if (Object.keys(v).some(k => !['commandId', 'reason', 'confirmed', ...extra].includes(k)) || !isCanonicalUuid(v.commandId) || v.confirmed !== true || typeof v.reason !== 'string' || v.reason.trim().length < 3 || v.reason.trim().length > 240 || Array.from(v.reason).some(char => char.charCodeAt(0) < 32)) return false
  if (['currency', 'progression', 'inventory'].includes(action)) {
    const max = action === 'inventory' ? 100 : action === 'currency' ? 100000 : 1000000
    if (!Number.isSafeInteger(v.delta) || v.delta === 0 || Math.abs(v.delta as number) > max) return false
  }
  if (action === 'progression' && !['cultivation', 'breeding', 'genetics'].includes(v.skillId as string)) return false
  if (action === 'inventory' && (typeof v.speciesId !== 'string' || v.speciesId.length > 80)) return false
  if (action === 'role' && (!staffRoles.includes(v.role as StaffRole) || (v.role === 'OWNER' ? !isCanonicalUuid(v.confirmOwnerPlayerId) : v.confirmOwnerPlayerId !== undefined))) return false
  return true
}
export function isAdminSession(value: unknown): value is AdminSession {
  if (!value || typeof value !== 'object') return false
  const v = value as AdminSession
  return isCanonicalUuid(v.playerId) && staffRoles.includes(v.role) && v.role !== 'PLAYER' && (v.displayName === null || typeof v.displayName === 'string') && typeof v.environment === 'string' && typeof v.version === 'string' && Array.isArray(v.permissions) && v.permissions.length === permissionsForRole(v.role).length && v.permissions.every(p => permissionsForRole(v.role).includes(p)) && new Set(v.permissions).size === v.permissions.length && Object.keys(v).every(k => ['playerId', 'displayName', 'role', 'permissions', 'environment', 'version'].includes(k))
}

function record(v: unknown): v is Record<string, unknown> { return !!v && typeof v === 'object' && !Array.isArray(v) }
function exact(v: Record<string, unknown>, keys: readonly string[]) { return Object.keys(v).every(k => keys.includes(k)) }
function integer(v: unknown) { return typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 }
function date(v: unknown) { return typeof v === 'string' && Number.isFinite(Date.parse(v)) }
function nullableName(v: unknown) { return v === null || typeof v === 'string' }
export function isAdminPlayer(v: unknown): v is AdminPlayerSummary {
  return record(v) && exact(v, ['playerId', 'publicId', 'displayName', 'joinedAt', 'role', 'totalLevel', 'status']) && isCanonicalUuid(v.playerId) && (v.publicId === null || isCanonicalUuid(v.publicId)) && nullableName(v.displayName) && date(v.joinedAt) && staffRoles.includes(v.role as StaffRole) && integer(v.totalLevel) && v.status === 'registered'
}
export function isAdminListing(v: unknown): v is AdminListing {
  return record(v) && exact(v, ['id', 'sellerPlayerId', 'specimenId', 'price', 'status', 'createdAt']) && isCanonicalUuid(v.id) && isCanonicalUuid(v.sellerPlayerId) && isCanonicalUuid(v.specimenId) && integer(v.price) && ['active', 'sold', 'cancelled'].includes(v.status as string) && date(v.createdAt)
}
export function isAdminInspection(v: unknown): v is AdminPlayerInspection {
  return record(v) && exact(v, ['player', 'social', 'listings', 'currency', 'skills', 'seeds', 'specimenCount', 'favoriteCount']) && isAdminPlayer(v.player)
    && (v.social === undefined || (record(v.social) && exact(v.social, ['friends', 'incoming', 'outgoing', 'blocks']) && ['friends', 'incoming', 'outgoing', 'blocks'].every(k => integer((v.social as Record<string, unknown>)[k]))))
    && (v.listings === undefined || (Array.isArray(v.listings) && v.listings.length <= 50 && v.listings.every(isAdminListing)))
    && (v.currency === undefined || integer(v.currency)) && (v.specimenCount === undefined || integer(v.specimenCount)) && (v.favoriteCount === undefined || integer(v.favoriteCount))
    && (v.skills === undefined || (Array.isArray(v.skills) && v.skills.length === 3 && new Set(v.skills.map(s => record(s) ? s.id : null)).size === 3 && v.skills.every(s => record(s) && exact(s, ['id', 'xp', 'level']) && ['cultivation', 'breeding', 'genetics'].includes(s.id as string) && integer(s.xp) && integer(s.level))))
    && (v.seeds === undefined || (Array.isArray(v.seeds) && v.seeds.length <= 50 && v.seeds.every(s => record(s) && exact(s, ['speciesId', 'quantity']) && typeof s.speciesId === 'string' && integer(s.quantity))))
}
export function isAdminSpecimen(v: unknown): v is AdminSpecimen {
  return record(v) && exact(v, ['id', 'ownerPlayerId', 'speciesId', 'cloneLineId', 'lifecycleStatus', 'plantedAt', 'collectedAt', 'readyAt', 'favorite', 'researchDepth', 'activeListingId']) && isCanonicalUuid(v.id) && isCanonicalUuid(v.ownerPlayerId) && isCanonicalUuid(v.cloneLineId) && typeof v.speciesId === 'string' && ['growing', 'owned', 'sold'].includes(v.lifecycleStatus as string) && date(v.plantedAt) && (v.collectedAt === null || date(v.collectedAt)) && (v.readyAt === null || date(v.readyAt)) && typeof v.favorite === 'boolean' && typeof v.researchDepth === 'string' && (v.activeListingId === null || isCanonicalUuid(v.activeListingId))
}
function summary(v: unknown) { return record(v) && Object.values(v).every(x => x === null || ['string', 'number', 'boolean'].includes(typeof x)) && Object.keys(v).every(k => ['role', 'source', 'listingId', 'specimenId', 'status', 'price', 'skillId', 'speciesId', 'balance', 'xp', 'quantity', 'requestedDelta', 'appliedDelta'].includes(k)) }
export function isAdminAudit(v: unknown): v is AdminAudit {
  return record(v) && exact(v, ['id', 'actorPlayerId', 'actorRole', 'action', 'targetPlayerId', 'reason', 'before', 'after', 'commandId', 'createdAt']) && isCanonicalUuid(v.id) && isCanonicalUuid(v.actorPlayerId) && staffRoles.includes(v.actorRole as StaffRole) && v.actorRole !== 'PLAYER' && typeof v.action === 'string' && (v.targetPlayerId === null || isCanonicalUuid(v.targetPlayerId)) && typeof v.reason === 'string' && v.reason.length <= 240 && summary(v.before) && summary(v.after) && isCanonicalUuid(v.commandId) && date(v.createdAt)
}
export function isAdminResult(v: unknown): v is AdminMutationResult { return record(v) && exact(v, ['audit', 'replayed']) && isAdminAudit(v.audit) && typeof v.replayed === 'boolean' }
export function isAdminRoleEntry(v: unknown): v is AdminRoleEntry { return record(v) && exact(v, ['playerId', 'role', 'displayName']) && isCanonicalUuid(v.playerId) && staffRoles.includes(v.role as StaffRole) && nullableName(v.displayName) }
export function adminPageValidator<T>(validate: (v: unknown) => v is T) {
  return (v: unknown): v is AdminPage<T> => record(v) && exact(v, ['items', 'nextOffset']) && Array.isArray(v.items) && v.items.length <= 50 && v.items.every(validate) && (v.nextOffset === null || integer(v.nextOffset))
}
