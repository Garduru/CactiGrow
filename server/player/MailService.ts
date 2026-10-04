import { and, count, desc, eq, gte, inArray, isNull, or, sql } from 'drizzle-orm'
import type { CactiGrowDatabase } from '../db/client/database.ts'
import { gameplayCommandReceipts, mailMessages, marketplaceListings, nurseryOccupancies, plantSpecimens, playerBlocks, playerGardenDisplays, playerGardenSpecimens, playerOnboarding, playerPlantLifecycleVersions, playerProfiles, playerSeedStacks } from '../db/schema/index.ts'
import { ApiError } from '../api/errors.ts'
import { assertSpecimenUnprotected } from '../gameplay/specimenCommerceEligibility.ts'
import { MAX_ECONOMY_INTEGER } from '../gameplay/shopCatalog.ts'
import { isMailCommand, type MailAttachment, type Mailbox, type MailCommand } from '../../shared/api/mailV1.ts'

type Transaction = Parameters<Parameters<CactiGrowDatabase['transaction']>[0]>[0]
async function bumpInventory(tx: Transaction, playerId: string, now: Date) {
  await tx.insert(playerPlantLifecycleVersions).values({ playerId, version: 1, updatedAt: now }).onConflictDoUpdate({ target: playerPlantLifecycleVersions.playerId, set: { version: sql`${playerPlantLifecycleVersions.version} + 1`, updatedAt: now } })
}

export class MailService {
  private readonly database: CactiGrowDatabase
  constructor(database: CactiGrowDatabase) { this.database = database }
  async unreadCount(playerId: string) {
    const [result] = await this.database.select({ total: count() }).from(mailMessages).where(and(eq(mailMessages.recipientPlayerId, playerId), isNull(mailMessages.readAt)))
    return { unreadCount: result.total }
  }

  async mailbox(playerId: string, inboxOffset = 0, sentOffset = 0): Promise<Mailbox> {
    const [inbox, sent, unread] = await Promise.all([
      this.database.select().from(mailMessages).where(eq(mailMessages.recipientPlayerId, playerId)).orderBy(desc(mailMessages.sentAt), desc(mailMessages.id)).offset(inboxOffset).limit(51),
      this.database.select().from(mailMessages).where(eq(mailMessages.senderPlayerId, playerId)).orderBy(desc(mailMessages.sentAt), desc(mailMessages.id)).offset(sentOffset).limit(51),
      this.database.select({ total: count() }).from(mailMessages).where(and(eq(mailMessages.recipientPlayerId, playerId), isNull(mailMessages.readAt))),
    ])
    const ids = [...new Set([...inbox, ...sent].flatMap(m => [m.senderPlayerId, m.recipientPlayerId]))]
    const profiles = ids.length ? await this.database.select().from(playerProfiles).where(inArray(playerProfiles.playerId, ids)) : []
    const byId = new Map(profiles.map(p => [p.playerId, p]))
    const project = (m: typeof mailMessages.$inferSelect) => {
      const sender = byId.get(m.senderPlayerId), recipient = byId.get(m.recipientPlayerId)
      if (!sender || !recipient) throw new Error('Mail references an unavailable profile.')
      return { id: m.id, senderPublicId: sender.publicId, senderName: sender.displayName, recipientPublicId: recipient.publicId, recipientName: recipient.displayName,
        subject: m.subject, text: m.text, sentAt: m.sentAt.toISOString(), readAt: m.readAt?.toISOString() ?? null, claimedAt: m.claimedAt?.toISOString() ?? null, attachment: m.attachment }
    }
    return { projectionVersion: 1, inbox: inbox.slice(0, 50).map(project), sent: sent.slice(0, 50).map(project), unreadCount: unread[0].total, hasMoreInbox: inbox.length > 50, hasMoreSent: sent.length > 50 }
  }

  async execute(playerId: string, command: MailCommand): Promise<{ mailId: string }> {
    if (!isMailCommand(command)) throw ApiError.validation('Invalid mail command.')
    return this.database.transaction(async tx => {
      const now = new Date()
      if (command.type !== 'send') {
        const [mail] = await tx.select().from(mailMessages).where(and(eq(mailMessages.id, command.mailId), eq(mailMessages.recipientPlayerId, playerId))).for('update').limit(1)
        if (!mail) throw ApiError.notFound('Mail not found in your inbox.')
        if (command.type === 'claim' && !mail.attachment) throw ApiError.conflict('This mail has no attachment.')
        if (command.type === 'claim' && mail.claimedAt) throw ApiError.conflict('This attachment has already been claimed.')
        if (command.type === 'claim' && !mail.claimedAt) {
          await this.claim(tx, playerId, mail, now)
          await tx.update(mailMessages).set({ claimedAt: now, readAt: mail.readAt ?? now }).where(eq(mailMessages.id, mail.id))
        } else if (!mail.readAt) await tx.update(mailMessages).set({ readAt: now }).where(eq(mailMessages.id, mail.id))
        return { mailId: mail.id }
      }
      // Reuse the existing command receipt boundary; incompatible key reuse is rejected.
      const fingerprint = JSON.stringify({ ...command, commandId: undefined })
      await tx.insert(gameplayCommandReceipts).values({ playerId, idempotencyKey: command.commandId, commandType: 'send-mail', requestFingerprint: fingerprint, status: 'processing' }).onConflictDoNothing()
      const [receipt] = await tx.select().from(gameplayCommandReceipts).where(and(eq(gameplayCommandReceipts.playerId, playerId), eq(gameplayCommandReceipts.idempotencyKey, command.commandId))).for('update')
      if (receipt.commandType !== 'send-mail' || receipt.requestFingerprint !== fingerprint) throw new ApiError('IDEMPOTENCY_KEY_REUSED', 409, 'This send key was already used for different content.')
      if (receipt.status === 'completed') return receipt.responsePayload as { mailId: string }
      const [recipient] = await tx.select().from(playerProfiles).where(eq(playerProfiles.publicId, command.recipientPublicId)).limit(1)
      if (!recipient || recipient.playerId === playerId) throw ApiError.validation('Choose another player as recipient.')
      const profiles = await tx.select().from(playerProfiles).where(inArray(playerProfiles.playerId, [playerId, recipient.playerId])).orderBy(playerProfiles.playerId).for('update')
      if (profiles.length !== 2) throw ApiError.conflict('Choose a character name before sending mail.')
      // Same pair locks as social mutations: a concurrent block cannot slip past validation.
      const blocks = await tx.select().from(playerBlocks).where(or(and(eq(playerBlocks.blockerPlayerId, playerId), eq(playerBlocks.blockedPlayerId, recipient.playerId)), and(eq(playerBlocks.blockerPlayerId, recipient.playerId), eq(playerBlocks.blockedPlayerId, playerId)))).limit(1)
      if (blocks.length) throw ApiError.conflict('Mail is unavailable for this player.')
      const [recent] = await tx.select({ total: count() }).from(mailMessages).where(and(eq(mailMessages.senderPlayerId, playerId), gte(mailMessages.sentAt, new Date(now.getTime() - 60_000))))
      if (recent.total >= 10) throw ApiError.conflict('Mail limit reached. Wait a minute before sending again.')
      const attachment = command.attachment
      if (attachment) await this.reserve(tx, playerId, attachment, now)
      const id = crypto.randomUUID()
      await tx.insert(mailMessages).values({ id, senderPlayerId: playerId, recipientPlayerId: recipient.playerId, commandId: command.commandId, requestFingerprint: fingerprint,
        subject: command.subject.trim(), text: command.text.trim(), attachment, specimenId: attachment?.kind === 'specimen' ? attachment.specimenId : null, sentAt: now })
      if (attachment) await bumpInventory(tx, playerId, now)
      const result = { mailId: id }
      await tx.update(gameplayCommandReceipts).set({ status: 'completed', responsePayload: result, completedAt: now }).where(and(eq(gameplayCommandReceipts.playerId, playerId), eq(gameplayCommandReceipts.idempotencyKey, command.commandId)))
      return result
    })
  }

  private async reserve(tx: Transaction, playerId: string, attachment: MailAttachment, now: Date) {
    if (attachment.kind === 'currency') {
      const [balance] = await tx.select().from(playerOnboarding).where(eq(playerOnboarding.playerId, playerId)).for('update')
      if (!balance || balance.tokenBalance < attachment.quantity) throw ApiError.conflict('Not enough currency for this attachment.')
      await tx.update(playerOnboarding).set({ tokenBalance: balance.tokenBalance - attachment.quantity, version: balance.version + 1 }).where(eq(playerOnboarding.playerId, playerId))
    } else if (attachment.kind === 'commodity') {
      const [stack] = await tx.select().from(playerSeedStacks).where(and(eq(playerSeedStacks.playerId, playerId), eq(playerSeedStacks.speciesId, attachment.speciesId))).for('update')
      if (!stack || stack.quantity < attachment.quantity) throw ApiError.conflict('Not enough seeds for this attachment.')
      await tx.update(playerSeedStacks).set({ quantity: stack.quantity - attachment.quantity, version: stack.version + 1, updatedAt: now }).where(and(eq(playerSeedStacks.playerId, playerId), eq(playerSeedStacks.speciesId, attachment.speciesId)))
    } else {
      const [specimen] = await tx.select().from(plantSpecimens).where(and(eq(plantSpecimens.id, attachment.specimenId), eq(plantSpecimens.ownerPlayerId, playerId))).for('update')
      if (!specimen || specimen.lifecycleStatus !== 'owned' || !specimen.collectedAt) throw ApiError.conflict('Choose an owned, collected specimen.')
      await assertSpecimenUnprotected(tx, playerId, specimen.id)
      const [listed, occupied] = await Promise.all([
        tx.select().from(marketplaceListings).where(and(eq(marketplaceListings.specimenId, specimen.id), eq(marketplaceListings.status, 'active'))).limit(1),
        tx.select().from(nurseryOccupancies).where(eq(nurseryOccupancies.specimenId, specimen.id)).limit(1),
      ])
      if (listed.length || occupied.length) throw ApiError.conflict('This specimen is listed or otherwise unavailable.')
      await tx.delete(playerGardenDisplays).where(and(eq(playerGardenDisplays.playerId, playerId), eq(playerGardenDisplays.specimenId, specimen.id)))
    }
  }

  private async claim(tx: Transaction, playerId: string, mail: typeof mailMessages.$inferSelect, now: Date) {
    const attachment = mail.attachment!
    if (attachment.kind === 'currency') {
      const [balance] = await tx.select().from(playerOnboarding).where(eq(playerOnboarding.playerId, playerId)).for('update')
      if (!balance || balance.tokenBalance > MAX_ECONOMY_INTEGER - attachment.quantity) throw ApiError.conflict('Your balance cannot receive this attachment yet.')
      await tx.update(playerOnboarding).set({ tokenBalance: balance.tokenBalance + attachment.quantity, version: balance.version + 1 }).where(eq(playerOnboarding.playerId, playerId))
    } else if (attachment.kind === 'commodity') {
      await tx.insert(playerSeedStacks).values({ playerId, speciesId: attachment.speciesId, quantity: 0 }).onConflictDoNothing()
      const [stack] = await tx.select().from(playerSeedStacks).where(and(eq(playerSeedStacks.playerId, playerId), eq(playerSeedStacks.speciesId, attachment.speciesId))).for('update')
      if (stack.quantity > MAX_ECONOMY_INTEGER - attachment.quantity) throw ApiError.conflict('Your seed stack cannot receive this attachment yet.')
      await tx.update(playerSeedStacks).set({ quantity: stack.quantity + attachment.quantity, version: stack.version + 1, updatedAt: now }).where(and(eq(playerSeedStacks.playerId, playerId), eq(playerSeedStacks.speciesId, attachment.speciesId)))
    } else {
      const [specimen] = await tx.select().from(plantSpecimens).where(eq(plantSpecimens.id, attachment.specimenId)).for('update')
      if (!specimen || specimen.ownerPlayerId !== mail.senderPlayerId || specimen.lifecycleStatus !== 'owned') throw ApiError.conflict('This reserved specimen is unavailable. Contact support.')
      const [metadata] = await tx.select().from(playerGardenSpecimens).where(and(eq(playerGardenSpecimens.playerId, mail.senderPlayerId), eq(playerGardenSpecimens.specimenId, specimen.id)))
      if (metadata) {
        await tx.insert(playerGardenSpecimens).values({ playerId, specimenId: specimen.id, favorite: false, tags: metadata.tags, updatedAt: now }).onConflictDoUpdate({ target: [playerGardenSpecimens.playerId, playerGardenSpecimens.specimenId], set: { tags: metadata.tags, favorite: false, updatedAt: now } })
        await tx.delete(playerGardenSpecimens).where(and(eq(playerGardenSpecimens.playerId, mail.senderPlayerId), eq(playerGardenSpecimens.specimenId, specimen.id)))
      }
      await tx.update(plantSpecimens).set({ ownerPlayerId: playerId, version: specimen.version + 1, updatedAt: now }).where(eq(plantSpecimens.id, specimen.id))
    }
    for (const id of (attachment.kind === 'specimen' ? [mail.senderPlayerId, playerId] : [playerId]).sort()) await bumpInventory(tx, id, now)
  }
}
