import { check, index, integer, jsonb, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { players } from './identity.ts'
import { cloneLines, plantSpecimens } from './plantLifecycle.ts'
import type { WildProvenanceV1 } from '../../../shared/api/wildGeneticsV1.ts'
import type { GeneticFeatureState } from '../../../src/types/geneticFeature.ts'
import type { PlantGeneticsV1 } from '../../../shared/api/plantLifecycleV1.ts'

// Lot siblings each have a once-established normal clone line. Rows survive planting/transfer.
export const wildGeneticSeeds = pgTable('wild_genetic_seeds', {
  id: uuid('id').primaryKey(),
  ownerPlayerId: uuid('owner_player_id').notNull().references(() => players.id),
  lotId: uuid('lot_id').notNull(),
  ordinal: integer('ordinal').notNull(),
  cloneLineId: uuid('clone_line_id').notNull().unique().references(() => cloneLines.id),
  provenance: jsonb('provenance').$type<WildProvenanceV1>().notNull(),
  sourceGenetics: jsonb('source_genetics').$type<{ parents: [PlantGeneticsV1, PlantGeneticsV1]; features: [GeneticFeatureState[], GeneticFeatureState[]] }>().notNull(),
  geneticFeatures: jsonb('genetic_features').$type<GeneticFeatureState[]>().notNull(),
  status: text('status').notNull().default('available'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  plantedAt: timestamp('planted_at', { withTimezone: true }),
  plantedSpecimenId: uuid('planted_specimen_id').unique().references(() => plantSpecimens.id),
}, t => [
  unique('wild_genetic_seeds_lot_ordinal_unique').on(t.ownerPlayerId, t.lotId, t.ordinal),
  index('wild_genetic_seeds_owner_idx').on(t.ownerPlayerId),
  check('wild_genetic_seeds_ordinal_bounded', sql`${t.ordinal} BETWEEN 0 AND 9`),
  check('wild_genetic_seeds_status_valid', sql`(${t.status} = 'available' AND ${t.plantedAt} IS NULL AND ${t.plantedSpecimenId} IS NULL) OR (${t.status} = 'planted' AND ${t.plantedAt} IS NOT NULL AND ${t.plantedSpecimenId} IS NOT NULL)`),
])
