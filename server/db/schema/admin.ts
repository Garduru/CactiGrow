import { check, index, jsonb, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { players } from './identity.ts'
import type { StaffRole } from '../../../shared/api/adminV1.ts'

export const adminRoleAssignments = pgTable('admin_role_assignments', {
  playerId: uuid('player_id').primaryKey().references(() => players.id),
  role: text('role').$type<Exclude<StaffRole, 'PLAYER'>>().notNull(),
  assignedByPlayerId: uuid('assigned_by_player_id').notNull().references(() => players.id),
  assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [check('admin_role_assignments_role_valid', sql`${t.role} IN ('MODERATOR','ADMIN','OWNER')`)])
export const adminAuditLog = pgTable('admin_audit_log', {
  id: uuid('id').primaryKey(), actorPlayerId: uuid('actor_player_id').notNull().references(() => players.id),
  actorRole: text('actor_role').$type<StaffRole>().notNull(), action: text('action').notNull(),
  targetPlayerId: uuid('target_player_id').references(() => players.id), reason: text('reason').notNull(),
  before: jsonb('before').$type<Record<string, string | number | boolean | null>>().notNull(),
  after: jsonb('after').$type<Record<string, string | number | boolean | null>>().notNull(),
  commandId: uuid('command_id').notNull(), requestFingerprint: text('request_fingerprint').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [unique('admin_audit_log_actor_command_unique').on(t.actorPlayerId, t.commandId), index('admin_audit_log_recent_idx').on(t.createdAt, t.id), index('admin_audit_log_target_idx').on(t.targetPlayerId, t.createdAt), check('admin_audit_log_reason_valid', sql`length(btrim(${t.reason})) BETWEEN 3 AND 240`), check('admin_audit_log_actor_role_valid', sql`${t.actorRole} IN ('MODERATOR','ADMIN','OWNER')`)])
