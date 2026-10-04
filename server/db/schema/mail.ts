import { check, index, jsonb, pgTable, text, timestamp, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { players } from './identity.ts'
import { plantSpecimens } from './plantLifecycle.ts'
import type { MailAttachment } from '../../../shared/api/mailV1.ts'

// One optional attachment per message. The pending specimen index is its escrow reservation.
export const mailMessages = pgTable('mail_messages', {
  id: uuid('id').primaryKey(), senderPlayerId: uuid('sender_player_id').notNull().references(() => players.id),
  recipientPlayerId: uuid('recipient_player_id').notNull().references(() => players.id),
  commandId: uuid('command_id').notNull(), requestFingerprint: text('request_fingerprint').notNull(),
  subject: text('subject').notNull(), text: text('text').notNull(), attachment: jsonb('attachment').$type<MailAttachment | null>(),
  specimenId: uuid('specimen_id').references(() => plantSpecimens.id),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull(),
  readAt: timestamp('read_at', { withTimezone: true }), claimedAt: timestamp('claimed_at', { withTimezone: true }),
}, t => [unique('mail_messages_sender_command_unique').on(t.senderPlayerId, t.commandId),
  uniqueIndex('mail_messages_pending_specimen_unique').on(t.specimenId).where(sql`${t.claimedAt} IS NULL AND ${t.specimenId} IS NOT NULL`),
  index('mail_messages_inbox_idx').on(t.recipientPlayerId, t.sentAt), index('mail_messages_sent_idx').on(t.senderPlayerId, t.sentAt),
  check('mail_messages_distinct_players', sql`${t.senderPlayerId} <> ${t.recipientPlayerId}`),
  check('mail_messages_text_bounded', sql`length(${t.subject}) BETWEEN 1 AND 80 AND length(${t.text}) BETWEEN 1 AND 2000`),
  check('mail_messages_claim_valid', sql`${t.claimedAt} IS NULL OR ${t.attachment} IS NOT NULL`),
])
