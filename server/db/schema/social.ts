import { check, index, pgTable, primaryKey, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { players } from './identity.ts'

export const playerProfiles = pgTable('player_profiles', {
  playerId: uuid('player_id').primaryKey().references(() => players.id, { onDelete: 'cascade' }),
  publicId: uuid('public_id').defaultRandom().notNull(),
  displayName: varchar('display_name', { length: 20 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('player_profiles_public_id_unique').on(table.publicId),
  uniqueIndex('player_profiles_display_name_lower_unique').on(sql`lower(${table.displayName})`),
  check('player_profiles_display_name_valid', sql`${table.displayName} = btrim(${table.displayName}) AND ${table.displayName} ~ '^[[:alnum:] _-]{3,20}$'`),
])

export const friendRequests = pgTable('friend_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  fromPlayerId: uuid('from_player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  toPlayerId: uuid('to_player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 16 }).notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('friend_requests_distinct_players', sql`${table.fromPlayerId} <> ${table.toPlayerId}`),
  check('friend_requests_status_valid', sql`${table.status} IN ('pending', 'accepted', 'declined', 'cancelled')`),
  uniqueIndex('friend_requests_pending_pair_unique')
    .on(sql`LEAST(${table.fromPlayerId}, ${table.toPlayerId})`, sql`GREATEST(${table.fromPlayerId}, ${table.toPlayerId})`)
    .where(sql`${table.status} = 'pending'`),
  index('friend_requests_to_status_index').on(table.toPlayerId, table.status),
  index('friend_requests_from_status_index').on(table.fromPlayerId, table.status),
])

export const friendships = pgTable('friendships', {
  playerLowId: uuid('player_low_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  playerHighId: uuid('player_high_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.playerLowId, table.playerHighId] }),
  check('friendships_ordered_distinct_players', sql`${table.playerLowId} < ${table.playerHighId}`),
  index('friendships_high_player_index').on(table.playerHighId),
])

export const playerBlocks = pgTable('player_blocks', {
  blockerPlayerId: uuid('blocker_player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  blockedPlayerId: uuid('blocked_player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.blockerPlayerId, table.blockedPlayerId] }),
  check('player_blocks_distinct_players', sql`${table.blockerPlayerId} <> ${table.blockedPlayerId}`),
  index('player_blocks_blocked_player_index').on(table.blockedPlayerId),
])