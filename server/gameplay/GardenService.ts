import { and, eq } from 'drizzle-orm'
import type { CactiGrowDatabase } from '../db/client/database.ts'
import { gameplayCommandReceipts, marketplaceListings, plantSpecimens, playerGardenDisplays, playerGardenSpecimens, playerGrowerEvents, playerGrowerState } from '../db/schema/index.ts'
import type { GardenCommandV1, GardenProjectionV1 } from '../../shared/api/gardenV1.ts'
import { createGardenDisplayAssignments } from '../../src/features/garden/gardenDisplayModel.ts'
import { addGardenTag, normalizeGardenTag, removeGardenTag, setGardenFavorite } from '../../src/features/garden/gardenOrganizationModel.ts'
import { ApiError } from '../api/errors.ts'

type Transaction = Parameters<Parameters<CactiGrowDatabase['transaction']>[0]>[0]

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(',')}}`
  return JSON.stringify(value)
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

export class GardenService {
  private readonly database: CactiGrowDatabase

  constructor(database: CactiGrowDatabase) {
    this.database = database
  }
  async project(playerId: string): Promise<GardenProjectionV1> {
    return this.projectWith(this.database, playerId)
  }
  private async projectWith(database: CactiGrowDatabase | Transaction, playerId: string): Promise<GardenProjectionV1> {
    const [metadata, displays] = await Promise.all([
      database.select().from(playerGardenSpecimens).where(eq(playerGardenSpecimens.playerId, playerId)),
      database.select().from(playerGardenDisplays).where(eq(playerGardenDisplays.playerId, playerId)),
    ])
    const organization = Object.fromEntries(metadata.map((row) => [row.specimenId, { specimenId: row.specimenId, favorite: row.favorite, tags: row.tags }]))
    const displayAssignments = createGardenDisplayAssignments()
    for (const row of displays) displayAssignments[row.slotId as keyof typeof displayAssignments] = row.specimenId
    return { projectionVersion: 1, organization, displayAssignments }
  }
  async execute(playerId: string, command: GardenCommandV1): Promise<GardenProjectionV1> {
    const commandType = `garden-v1:${command.type}`
    const fingerprint = `${commandType}:${canonicalJson(command)}`
    const [existing] = await this.database.select().from(gameplayCommandReceipts).where(and(eq(gameplayCommandReceipts.playerId, playerId), eq(gameplayCommandReceipts.idempotencyKey, command.commandId))).limit(1)
    if (existing) {
      if (existing.commandType !== commandType || existing.requestFingerprint !== fingerprint) throw new ApiError('IDEMPOTENCY_KEY_REUSED', 409, 'The command ID was already used for another request.')
      if (existing.status === 'completed') return existing.responsePayload as GardenProjectionV1
    }
    try {
      return await this.database.transaction(async (tx) => {
        await tx.insert(gameplayCommandReceipts).values({ playerId, idempotencyKey: command.commandId, commandType, requestFingerprint: fingerprint, status: 'processing' })
        if (command.type === 'clear-display') {
          await tx.delete(playerGardenDisplays).where(and(eq(playerGardenDisplays.playerId, playerId), eq(playerGardenDisplays.slotId, command.slotId)))
        } else {
          const [specimen] = await tx.select().from(plantSpecimens).where(and(eq(plantSpecimens.ownerPlayerId, playerId), eq(plantSpecimens.id, command.specimenId))).for('update').limit(1)
          if (!specimen || specimen.lifecycleStatus !== 'owned') throw new ApiError('SPECIMEN_NOT_FOUND', 404, 'The collected specimen was not found.')
          if (command.type === 'assign-display') {
            await tx.delete(playerGardenDisplays).where(and(eq(playerGardenDisplays.playerId, playerId), eq(playerGardenDisplays.specimenId, command.specimenId)))
            await tx.insert(playerGardenDisplays).values({ playerId, slotId: command.slotId, specimenId: command.specimenId }).onConflictDoUpdate({ target: [playerGardenDisplays.playerId, playerGardenDisplays.slotId], set: { specimenId: command.specimenId, updatedAt: new Date() } })
            await tx.insert(playerGrowerEvents).values({ id: crypto.randomUUID(), playerId, eventType: 'specimen-displayed', sourceCommandId: command.commandId, occurredAt: new Date(), payload: { specimenId: command.specimenId, slotId: command.slotId } }).onConflictDoNothing()
          } else {
            const [grower] = await tx.select().from(playerGrowerState).where(eq(playerGrowerState.playerId, playerId)).limit(1)
            if (command.type !== 'favorite' && (!grower || grower.property.buildings.garden.level < 2)) throw new ApiError('FORBIDDEN', 403, 'Organized Beds is required for tags.')
            if (command.type === 'favorite' && command.favorite) {
              const [active] = await tx.select({ id: marketplaceListings.id }).from(marketplaceListings).where(and(eq(marketplaceListings.specimenId, specimen.id), eq(marketplaceListings.status, 'active'))).limit(1)
              if (active) throw new ApiError('CONFLICT', 409, 'Cancel the Marketplace listing before favoriting this plant.')
            }
            const [row] = await tx.select().from(playerGardenSpecimens).where(and(eq(playerGardenSpecimens.playerId, playerId), eq(playerGardenSpecimens.specimenId, command.specimenId))).limit(1)
            const current = row ? { [row.specimenId]: { specimenId: row.specimenId, favorite: row.favorite, tags: row.tags } } : {}
            const next = command.type === 'favorite' ? setGardenFavorite(current, command.specimenId, command.favorite)
              : command.type === 'add-tag' ? addGardenTag(current, command.specimenId, command.tag)
                : removeGardenTag(current, command.specimenId, normalizeGardenTag(command.tag))
            const value = next[command.specimenId]
            if (!value) await tx.delete(playerGardenSpecimens).where(and(eq(playerGardenSpecimens.playerId, playerId), eq(playerGardenSpecimens.specimenId, command.specimenId)))
            else await tx.insert(playerGardenSpecimens).values({ playerId, specimenId: command.specimenId, favorite: value.favorite, tags: value.tags }).onConflictDoUpdate({ target: [playerGardenSpecimens.playerId, playerGardenSpecimens.specimenId], set: { favorite: value.favorite, tags: value.tags, updatedAt: new Date() } })
          }
        }
        const result = await this.projectWith(tx, playerId)
        await tx.update(gameplayCommandReceipts).set({ status: 'completed', responsePayload: result, completedAt: new Date() }).where(and(eq(gameplayCommandReceipts.playerId, playerId), eq(gameplayCommandReceipts.idempotencyKey, command.commandId)))
        return result
      })
    } catch (error) {
      if (databaseErrorCode(error) === '23505') {
        const [receipt] = await this.database.select().from(gameplayCommandReceipts).where(and(eq(gameplayCommandReceipts.playerId, playerId), eq(gameplayCommandReceipts.idempotencyKey, command.commandId))).limit(1)
        if (receipt?.status === 'completed' && receipt.commandType === commandType && receipt.requestFingerprint === fingerprint) return receipt.responsePayload as GardenProjectionV1
        throw new ApiError('CONFLICT', 409, 'The Garden changed concurrently. Refresh and try again.')
      }
      throw error
    }
  }
}
