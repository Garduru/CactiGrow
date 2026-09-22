import { boolean, check, integer, jsonb, pgTable, primaryKey, text, timestamp, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { players } from './identity.ts'
import { bredSeeds, plantSpecimens } from './plantLifecycle.ts'
import type { AchievementProgress } from '../../../src/types/achievement.ts'
import type { SpeciesDiscoveries, JournalStats } from '../../../src/types/journal.ts'
import type { GeneticsResearchState } from '../../../src/types/research.ts'
import type { GeneticsLabState } from '../../../src/types/lab.ts'
import type { PropertyState } from '../../../src/types/property.ts'
import type { QuantitativeSeedTreatment } from '../../../src/types/treatment.ts'

export const playerGrowerEvents = pgTable('player_grower_events', {
  id: uuid('id').primaryKey(), playerId: uuid('player_id').notNull().references(() => players.id),
  eventType: text('event_type').notNull(), sourceCommandId: uuid('source_command_id').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(), payload: jsonb('payload').notNull().default({}),
}, (t) => [unique('player_grower_events_source_unique').on(t.playerId, t.sourceCommandId, t.eventType)])

export const playerGardenSpecimens = pgTable('player_garden_specimens', {
  playerId: uuid('player_id').notNull().references(() => players.id), specimenId: uuid('specimen_id').notNull().references(() => plantSpecimens.id),
  favorite: boolean('favorite').notNull().default(false), tags: jsonb('tags').$type<string[]>().notNull().default([]), updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.playerId, t.specimenId] })])

export const playerGardenDisplays = pgTable('player_garden_displays', {
  playerId: uuid('player_id').notNull().references(() => players.id), slotId: text('slot_id').notNull(), specimenId: uuid('specimen_id').notNull().references(() => plantSpecimens.id), updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.playerId, t.slotId] }), unique('player_garden_displays_specimen_unique').on(t.playerId, t.specimenId), check('player_garden_displays_slot_valid', sql`${t.slotId} IN ('garden-display-back-left','garden-display-back-center','garden-display-back-right','garden-display-front-left','garden-display-front-center','garden-display-front-right')`)])

export const playerGrowerState = pgTable('player_grower_state', {
  playerId: uuid('player_id').primaryKey().references(() => players.id),
  achievements: jsonb('achievements').$type<AchievementProgress[]>().notNull().default([]),
  discoveries: jsonb('discoveries').$type<SpeciesDiscoveries>().notNull().default({}), journalStats: jsonb('journal_stats').$type<JournalStats>().notNull().default({ shinyCloneLineIds: [] }),
  research: jsonb('research').$type<GeneticsResearchState>().notNull().default({ records: {}, completedDiscoveryMilestoneIds: [] }),
  lab: jsonb('lab').$type<GeneticsLabState>().notNull(), property: jsonb('property').$type<PropertyState>().notNull(),
  version: integer('version').notNull().default(1), updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [check('player_grower_state_version_positive', sql`${t.version} >= 1`)])

export const bredSeedTreatments = pgTable('bred_seed_treatments', {
  seedId: uuid('seed_id').primaryKey().references(() => bredSeeds.id),
  ownerPlayerId: uuid('owner_player_id').notNull().references(() => players.id),
  treatment: jsonb('treatment').$type<QuantitativeSeedTreatment>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const marketplaceListings = pgTable('marketplace_listings', {
  id: uuid('id').primaryKey(), sellerPlayerId: uuid('seller_player_id').notNull().references(() => players.id), specimenId: uuid('specimen_id').notNull().references(() => plantSpecimens.id),
  askingPrice: integer('asking_price').notNull(), status: text('status').notNull(), buyerPlayerId: uuid('buyer_player_id').references(() => players.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(), completedAt: timestamp('completed_at', { withTimezone: true }), version: integer('version').notNull().default(1),
}, (t) => [uniqueIndex('marketplace_listings_active_specimen_unique').on(t.specimenId).where(sql`${t.status} = 'active'`), check('marketplace_listings_price_valid', sql`${t.askingPrice} BETWEEN 1 AND 1000000`), check('marketplace_listings_status_valid', sql`${t.status} IN ('active','cancelled','sold')`)])
