import { and, count, eq, ilike, inArray, or } from 'drizzle-orm'
import type { CactiGrowDatabase } from '../db/client/database.ts'
import { bredSeeds, friendRequests, friendships, playerBlocks, playerOnboarding, playerProfiles, plantSpecimens, players } from '../db/schema/index.ts'
import type { PublicPlayerProfileV1, PublicPlayerSummaryV1, SocialCommandV1, SocialOverviewV1, PlayerSearchV1 } from '../../shared/api/socialV1.ts'
import { getLevelFromXp } from '../../src/features/progression/progressionModel.ts'
import { publicSkillsFromXp, getTotalLevel } from '../../src/features/progression/publicSkills.ts'
import { ApiError } from '../api/errors.ts'

type Transaction = Parameters<Parameters<CactiGrowDatabase['transaction']>[0]>[0]
const RESERVED_NAMES = new Set(['admin', 'administrator', 'cactigrow', 'cactiswap', 'moderator', 'mod', 'staff', 'support', 'system', 'grower'])

export function normalizeCharacterName(input: string): string {
  const name = input.trim()
  const visibleCharacters = Array.from(name).length
  if (visibleCharacters < 3 || visibleCharacters > 20 || !/^[\p{L}\p{N}_ -]+$/u.test(name)
    || RESERVED_NAMES.has(name.toLocaleLowerCase())) {
    throw ApiError.validation('Choose a 3–20 character name using letters, numbers, spaces, underscores, or hyphens.')
  }
  return name
}

function databaseErrorCode(error: unknown): string | undefined {
  let current = error
  for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth += 1) {
    const details = current as { code?: unknown; cause?: unknown }
    if (typeof details.code === 'string') return details.code
    current = details.cause
  }
  return undefined
}

export class SocialService {
  private readonly database: CactiGrowDatabase
  constructor(database: CactiGrowDatabase) { this.database = database }

  async overview(playerId: string): Promise<SocialOverviewV1> {
    const [ownProfile] = await this.summaries([playerId])
    const [friendRows, incoming, outgoing, blocked] = await Promise.all([
      this.database.select().from(friendships).where(or(eq(friendships.playerLowId, playerId), eq(friendships.playerHighId, playerId))),
      this.database.select().from(friendRequests).where(and(eq(friendRequests.toPlayerId, playerId), eq(friendRequests.status, 'pending'))),
      this.database.select().from(friendRequests).where(and(eq(friendRequests.fromPlayerId, playerId), eq(friendRequests.status, 'pending'))),
      this.database.select().from(playerBlocks).where(eq(playerBlocks.blockerPlayerId, playerId)),
    ])
    const friendIds = friendRows.map((row) => row.playerLowId === playerId ? row.playerHighId : row.playerLowId)
    const incomingIds = incoming.map((row) => row.fromPlayerId)
    const outgoingIds = outgoing.map((row) => row.toPlayerId)
    const blockedIds = blocked.map((row) => row.blockedPlayerId)
    const summaries = new Map((await this.summaries([...new Set([...friendIds, ...incomingIds, ...outgoingIds, ...blockedIds])])).map((item) => [item.playerId, item.summary]))
    return {
      projectionVersion: 1,
      ownProfile: ownProfile?.summary ?? null,
      friends: friendIds.flatMap((id) => summaries.has(id) ? [summaries.get(id)!] : []),
      incomingRequests: incomingIds.flatMap((id) => summaries.has(id) ? [summaries.get(id)!] : []),
      outgoingRequests: outgoingIds.flatMap((id) => summaries.has(id) ? [summaries.get(id)!] : []),
      blockedPlayers: blockedIds.flatMap((id) => summaries.has(id) ? [summaries.get(id)!] : []),
    }
  }

  async publicProfile(viewerId: string, publicId: string): Promise<PublicPlayerProfileV1> {
    const [target] = await this.database.select({ playerId: playerProfiles.playerId }).from(playerProfiles)
      .where(eq(playerProfiles.publicId, publicId)).limit(1)
    if (!target) throw ApiError.notFound('Player profile not found.')
    const [entry] = await this.summaries([target.playerId])
    if (!entry) throw ApiError.notFound('Player profile not found.')
    const isSelf = viewerId === target.playerId
    if (isSelf) return { projectionVersion: 1, profile: entry.summary, relationship: { isSelf, areFriends: false, request: null, blockedByMe: false, blocksMe: false } }
    const low = viewerId < target.playerId ? viewerId : target.playerId
    const high = viewerId < target.playerId ? target.playerId : viewerId
    const [friend, outgoing, incoming, blockedByMe, blocksMe] = await Promise.all([
      this.database.select({ playerLowId: friendships.playerLowId }).from(friendships).where(and(eq(friendships.playerLowId, low), eq(friendships.playerHighId, high))).limit(1),
      this.database.select({ id: friendRequests.id }).from(friendRequests).where(and(eq(friendRequests.fromPlayerId, viewerId), eq(friendRequests.toPlayerId, target.playerId), eq(friendRequests.status, 'pending'))).limit(1),
      this.database.select({ id: friendRequests.id }).from(friendRequests).where(and(eq(friendRequests.fromPlayerId, target.playerId), eq(friendRequests.toPlayerId, viewerId), eq(friendRequests.status, 'pending'))).limit(1),
      this.database.select({ blockerPlayerId: playerBlocks.blockerPlayerId }).from(playerBlocks).where(and(eq(playerBlocks.blockerPlayerId, viewerId), eq(playerBlocks.blockedPlayerId, target.playerId))).limit(1),
      this.database.select({ blockerPlayerId: playerBlocks.blockerPlayerId }).from(playerBlocks).where(and(eq(playerBlocks.blockerPlayerId, target.playerId), eq(playerBlocks.blockedPlayerId, viewerId))).limit(1),
    ])
    return { projectionVersion: 1, profile: entry.summary, relationship: {
      isSelf, areFriends: friend.length > 0, request: incoming.length ? 'incoming' : outgoing.length ? 'outgoing' : null,
      blockedByMe: blockedByMe.length > 0, blocksMe: blocksMe.length > 0,
    } }
  }

  async search(viewerId: string, input: string): Promise<PlayerSearchV1> {
    const query = input.trim()
    if (Array.from(query).length < 2 || Array.from(query).length > 20) throw ApiError.validation('Enter 2-20 characters to find a player.')
    // Escape LIKE wildcards; names are data, never SQL or a relationship key.
    const pattern = `%${query.replace(/[\\%_]/g, '\\$&')}%`
    const matches = await this.database.select({ playerId: playerProfiles.playerId, publicId: playerProfiles.publicId }).from(playerProfiles)
      .where(ilike(playerProfiles.displayName, pattern)).orderBy(playerProfiles.displayName, playerProfiles.publicId).limit(12)
    if (!matches.length) return { projectionVersion: 1, results: [] }
    const ids = matches.map((row) => row.playerId)
    const [summaries, friends, requests, blocks] = await Promise.all([
      this.summaries(ids),
      this.database.select().from(friendships).where(or(and(eq(friendships.playerLowId, viewerId), inArray(friendships.playerHighId, ids)), and(eq(friendships.playerHighId, viewerId), inArray(friendships.playerLowId, ids)))),
      this.database.select().from(friendRequests).where(and(eq(friendRequests.status, 'pending'), or(and(eq(friendRequests.fromPlayerId, viewerId), inArray(friendRequests.toPlayerId, ids)), and(eq(friendRequests.toPlayerId, viewerId), inArray(friendRequests.fromPlayerId, ids))))),
      this.database.select().from(playerBlocks).where(or(and(eq(playerBlocks.blockerPlayerId, viewerId), inArray(playerBlocks.blockedPlayerId, ids)), and(eq(playerBlocks.blockedPlayerId, viewerId), inArray(playerBlocks.blockerPlayerId, ids)))),
    ])
    const byId = new Map(summaries.map((row) => [row.playerId, row.summary]))
    return { projectionVersion: 1, results: matches.flatMap(({ playerId }) => {
      const profile = byId.get(playerId)
      if (!profile) return []
      return [{ projectionVersion: 1 as const, profile, relationship: {
        isSelf: playerId === viewerId,
        areFriends: playerId !== viewerId && friends.some((row) => row.playerLowId === playerId || row.playerHighId === playerId),
        request: playerId === viewerId ? null : requests.some((row) => row.fromPlayerId === playerId) ? 'incoming' as const : requests.some((row) => row.toPlayerId === playerId) ? 'outgoing' as const : null,
        blockedByMe: blocks.some((row) => row.blockerPlayerId === viewerId && row.blockedPlayerId === playerId),
        blocksMe: blocks.some((row) => row.blockerPlayerId === playerId && row.blockedPlayerId === viewerId),
      } }]
    }) }
  }

  async execute(playerId: string, command: SocialCommandV1): Promise<SocialOverviewV1> {
    if (command.type === 'set-display-name') {
      const displayName = normalizeCharacterName(command.displayName)
      try {
        await this.database.insert(playerProfiles).values({ playerId, displayName })
          .onConflictDoUpdate({ target: playerProfiles.playerId, set: { displayName, updatedAt: new Date() } })
      } catch (error) {
        if (databaseErrorCode(error) === '23505') throw ApiError.conflict('That character name is already in use.')
        throw error
      }
      return this.overview(playerId)
    }
    const [target] = await this.database.select({ playerId: playerProfiles.playerId }).from(playerProfiles)
      .where(eq(playerProfiles.publicId, command.publicId)).limit(1)
    if (!target) throw ApiError.notFound('Player profile not found.')
    if (target.playerId === playerId) throw ApiError.validation('You cannot change a relationship with yourself.')
    await this.database.transaction(async (tx) => {
      await this.lockPair(tx, playerId, target.playerId)
      if (command.type === 'add-friend') await this.addFriend(tx, playerId, target.playerId)
      else if (command.type === 'accept-friend') await this.acceptFriend(tx, playerId, target.playerId)
      else if (command.type === 'decline-friend') await this.declineFriend(tx, playerId, target.playerId)
      else if (command.type === 'remove-friend') await this.removeFriend(tx, playerId, target.playerId)
      else if (command.type === 'block-player') await this.blockPlayer(tx, playerId, target.playerId)
      else await tx.delete(playerBlocks).where(and(eq(playerBlocks.blockerPlayerId, playerId), eq(playerBlocks.blockedPlayerId, target.playerId)))
    })
    return this.overview(playerId)
  }

  private async lockPair(tx: Transaction, firstId: string, secondId: string): Promise<void> {
    // Relationship commands serialize on profiles, whose runtime grant includes UPDATE.
    // Locking identity rows would require widening the players table's privileges.
    const rows = await tx.select({ id: playerProfiles.playerId }).from(playerProfiles)
      .where(inArray(playerProfiles.playerId, [firstId, secondId])).orderBy(playerProfiles.playerId).for('update')
    if (rows.length !== 2) throw ApiError.notFound('Player not found.')
  }

  private async addFriend(tx: Transaction, playerId: string, targetId: string): Promise<void> {
    const blocked = await tx.select({ blockerPlayerId: playerBlocks.blockerPlayerId }).from(playerBlocks)
      .where(or(and(eq(playerBlocks.blockerPlayerId, playerId), eq(playerBlocks.blockedPlayerId, targetId)), and(eq(playerBlocks.blockerPlayerId, targetId), eq(playerBlocks.blockedPlayerId, playerId)))).limit(1)
    if (blocked.length) throw ApiError.conflict('Friend requests are unavailable for this player.')
    const low = playerId < targetId ? playerId : targetId
    const high = playerId < targetId ? targetId : playerId
    const existingFriendship = await tx.select({ playerLowId: friendships.playerLowId }).from(friendships)
      .where(and(eq(friendships.playerLowId, low), eq(friendships.playerHighId, high))).limit(1)
    if (existingFriendship.length) return
    const pending = await tx.select({ id: friendRequests.id }).from(friendRequests)
      .where(and(eq(friendRequests.status, 'pending'), or(and(eq(friendRequests.fromPlayerId, playerId), eq(friendRequests.toPlayerId, targetId)), and(eq(friendRequests.fromPlayerId, targetId), eq(friendRequests.toPlayerId, playerId))))).limit(1)
    if (pending.length) return
    await tx.insert(friendRequests).values({ fromPlayerId: playerId, toPlayerId: targetId }).onConflictDoNothing()
  }

  private async acceptFriend(tx: Transaction, playerId: string, targetId: string): Promise<void> {
    const [request] = await tx.select().from(friendRequests).where(and(eq(friendRequests.fromPlayerId, targetId), eq(friendRequests.toPlayerId, playerId), eq(friendRequests.status, 'pending'))).for('update').limit(1)
    if (!request) throw ApiError.conflict('There is no incoming friend request to accept.')
    await this.ensureUnblocked(tx, playerId, targetId)
    const low = playerId < targetId ? playerId : targetId
    const high = playerId < targetId ? targetId : playerId
    await tx.insert(friendships).values({ playerLowId: low, playerHighId: high }).onConflictDoNothing()
    await tx.update(friendRequests).set({ status: 'accepted', updatedAt: new Date() }).where(eq(friendRequests.id, request.id))
    await tx.update(friendRequests).set({ status: 'cancelled', updatedAt: new Date() }).where(and(eq(friendRequests.status, 'pending'), or(and(eq(friendRequests.fromPlayerId, playerId), eq(friendRequests.toPlayerId, targetId)), and(eq(friendRequests.fromPlayerId, targetId), eq(friendRequests.toPlayerId, playerId)))))
  }

  private async declineFriend(tx: Transaction, playerId: string, targetId: string): Promise<void> {
    const [request] = await tx.select({ id: friendRequests.id }).from(friendRequests).where(and(eq(friendRequests.fromPlayerId, targetId), eq(friendRequests.toPlayerId, playerId), eq(friendRequests.status, 'pending'))).limit(1)
    if (!request) throw ApiError.conflict('There is no incoming friend request to decline.')
    await tx.update(friendRequests).set({ status: 'declined', updatedAt: new Date() }).where(eq(friendRequests.id, request.id))
  }

  private async removeFriend(tx: Transaction, playerId: string, targetId: string): Promise<void> {
    const low = playerId < targetId ? playerId : targetId
    const high = playerId < targetId ? targetId : playerId
    await tx.delete(friendships).where(and(eq(friendships.playerLowId, low), eq(friendships.playerHighId, high)))
  }

  private async blockPlayer(tx: Transaction, playerId: string, targetId: string): Promise<void> {
    await tx.insert(playerBlocks).values({ blockerPlayerId: playerId, blockedPlayerId: targetId }).onConflictDoNothing()
    const low = playerId < targetId ? playerId : targetId
    const high = playerId < targetId ? targetId : playerId
    await tx.delete(friendships).where(and(eq(friendships.playerLowId, low), eq(friendships.playerHighId, high)))
    await tx.update(friendRequests).set({ status: 'cancelled', updatedAt: new Date() }).where(and(eq(friendRequests.status, 'pending'), or(and(eq(friendRequests.fromPlayerId, playerId), eq(friendRequests.toPlayerId, targetId)), and(eq(friendRequests.fromPlayerId, targetId), eq(friendRequests.toPlayerId, playerId)))))
  }

  private async ensureUnblocked(tx: Transaction, playerId: string, targetId: string): Promise<void> {
    const blocked = await tx.select({ blockerPlayerId: playerBlocks.blockerPlayerId }).from(playerBlocks)
      .where(or(and(eq(playerBlocks.blockerPlayerId, playerId), eq(playerBlocks.blockedPlayerId, targetId)), and(eq(playerBlocks.blockerPlayerId, targetId), eq(playerBlocks.blockedPlayerId, playerId)))).limit(1)
    if (blocked.length) throw ApiError.conflict('Friend requests are unavailable for this player.')
  }

  private async summaries(playerIds: readonly string[]): Promise<readonly { playerId: string; summary: PublicPlayerSummaryV1 }[]> {
    if (!playerIds.length) return []
    const profiles = await this.database.select({ playerId: playerProfiles.playerId, publicId: playerProfiles.publicId,
      displayName: playerProfiles.displayName, joinedAt: players.createdAt, cultivationXp: playerOnboarding.cultivationXp, breedingXp: playerOnboarding.breedingXp, geneticsXp: playerOnboarding.geneticsXp })
      .from(playerProfiles).innerJoin(players, eq(playerProfiles.playerId, players.id))
      .leftJoin(playerOnboarding, eq(playerOnboarding.playerId, playerProfiles.playerId))
      .where(inArray(playerProfiles.playerId, [...playerIds]))
    const [collections, breeding] = await Promise.all([
      this.database.select({ playerId: plantSpecimens.ownerPlayerId, total: count() }).from(plantSpecimens)
        .where(and(inArray(plantSpecimens.ownerPlayerId, [...playerIds]), eq(plantSpecimens.lifecycleStatus, 'owned'))).groupBy(plantSpecimens.ownerPlayerId),
      this.database.select({ playerId: bredSeeds.ownerPlayerId, total: count() }).from(bredSeeds)
        .where(inArray(bredSeeds.ownerPlayerId, [...playerIds])).groupBy(bredSeeds.ownerPlayerId),
    ])
    const collectionCounts = new Map(collections.map((row) => [row.playerId, row.total]))
    const breedingCounts = new Map(breeding.map((row) => [row.playerId, row.total]))
    return profiles.map((row) => ({ playerId: row.playerId, summary: {
      publicId: row.publicId, displayName: row.displayName, joinedAt: row.joinedAt.toISOString(),
      ...(row.cultivationXp === null ? {} : { cultivationLevel: getLevelFromXp(row.cultivationXp), cultivationXp: row.cultivationXp,
        skills: publicSkillsFromXp({ cultivationXp: row.cultivationXp, breedingXp: row.breedingXp ?? 0, geneticsXp: row.geneticsXp ?? 0 }),
        totalLevel: getTotalLevel(publicSkillsFromXp({ cultivationXp: row.cultivationXp, breedingXp: row.breedingXp ?? 0, geneticsXp: row.geneticsXp ?? 0 })) }),
      collectionCount: collectionCounts.get(row.playerId) ?? 0, breedingCount: breedingCounts.get(row.playerId) ?? 0,
    } }))
  }
}
