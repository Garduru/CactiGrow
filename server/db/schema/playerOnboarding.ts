import { check, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { players } from './identity.ts'

// One effective Grower character per player in Alpha. The profile ID keeps the
// starter package separate from durable identity and future character modes.
export const playerOnboarding = pgTable('player_onboarding', {
  playerId: uuid('player_id').primaryKey().references(() => players.id),
  profileId: text('profile_id').notNull(),
  initializedAt: timestamp('initialized_at', { withTimezone: true }).notNull().defaultNow(),
  starterGrantedAt: timestamp('starter_granted_at', { withTimezone: true }),
  tutorialStartedAt: timestamp('tutorial_started_at', { withTimezone: true }),
  tutorialCompletedAt: timestamp('tutorial_completed_at', { withTimezone: true }),
  cultivationXp: integer('cultivation_xp').notNull().default(0),
  breedingXp: integer('breeding_xp').notNull().default(0),
  geneticsXp: integer('genetics_xp').notNull().default(0),
  tokenBalance: integer('token_balance').notNull().default(0),
  version: integer('version').notNull().default(1),
}, (table) => [
  check('player_onboarding_cultivation_xp_nonnegative', sql`${table.cultivationXp} >= 0`),
  check('player_onboarding_breeding_xp_nonnegative', sql`${table.breedingXp} >= 0`),
  check('player_onboarding_genetics_xp_nonnegative', sql`${table.geneticsXp} >= 0`),
  check('player_onboarding_token_balance_nonnegative', sql`${table.tokenBalance} >= 0`),
  check('player_onboarding_version_positive', sql`${table.version} >= 1`),
])
