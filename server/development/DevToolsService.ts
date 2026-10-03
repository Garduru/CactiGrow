import { and, eq, sql } from 'drizzle-orm'
import type { CactiGrowDatabase } from '../db/client/database.ts'
import { gameplayCommandReceipts, marketplaceListings, nurseryOccupancies, plantSpecimens, playerGardenSpecimens, playerOnboarding, playerPlantLifecycleVersions, playerSeedStacks } from '../db/schema/index.ts'
import { ApiError } from '../api/errors.ts'
import { isDevCommand, type DevCommand, type DevSpecimenDiagnostics } from '../../shared/api/devToolsV1.ts'
import { addXp } from '../../src/features/progression/progressionModel.ts'
import { SHOP_CATALOG, MAX_ECONOMY_INTEGER } from '../gameplay/shopCatalog.ts'
import { GrowerAlphaService } from '../gameplay/GrowerAlphaService.ts'
import { PlantLifecycleService } from '../gameplay/PlantLifecycleService.ts'
import { getNpcSaleValue } from '../../src/features/marketplace/sellModel.ts'
import type { CollectedPlant } from '../../src/game/gameState.ts'

export class DevToolsService {
  private readonly database: CactiGrowDatabase
  private readonly environment: string
  constructor(database: CactiGrowDatabase, environment: string) { this.database = database; this.environment = environment }

  async execute(playerId: string, command: DevCommand) {
    if (!['development', 'staging'].includes(this.environment)) throw ApiError.notFound('API route not found.')
    if (!isDevCommand(command)) throw ApiError.validation('Invalid development command.')
    const fingerprint = JSON.stringify(Object.entries(command).sort(([a], [b]) => a.localeCompare(b)))
    await this.database.transaction(async tx => {
      // Serialize this player's dev commands, including duplicate receipt requests.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${playerId + ':dev-tools'}, 0))`)
      const [receipt] = await tx.select().from(gameplayCommandReceipts).where(and(eq(gameplayCommandReceipts.playerId, playerId), eq(gameplayCommandReceipts.idempotencyKey, command.commandId)))
      if (receipt) {
        if (receipt.commandType !== 'dev-tools-v1' || receipt.requestFingerprint !== fingerprint) throw new ApiError('IDEMPOTENCY_KEY_REUSED', 409, 'Command ID already used.')
        return
      }
      const now = new Date()
      if (command.type === 'add-xp' || command.type === 'add-currency') {
        const [profile] = await tx.select().from(playerOnboarding).where(eq(playerOnboarding.playerId, playerId)).for('update')
        if (!profile) throw ApiError.notFound('Player progression is unavailable.')
        if (command.type === 'add-xp') {
          const key = ({ cultivation: 'cultivationXp', breeding: 'breedingXp', genetics: 'geneticsXp' } as const)[command.skillId]
          const xp = addXp(profile[key], command.amount)
          if (xp === null) throw ApiError.validation('Invalid XP amount.')
          await tx.update(playerOnboarding).set({ [key]: xp, version: profile.version + 1 }).where(eq(playerOnboarding.playerId, playerId))
        } else {
          const balance = profile.tokenBalance + command.amount
          if (balance > MAX_ECONOMY_INTEGER) throw ApiError.validation('Currency balance exceeds storage capacity.')
          await tx.update(playerOnboarding).set({ tokenBalance: balance, version: profile.version + 1 }).where(eq(playerOnboarding.playerId, playerId))
        }
      } else if (command.type === 'adjust-seeds') {
        if (!SHOP_CATALOG.some(item => item.speciesId === command.speciesId)) throw ApiError.validation('Unsupported seed species.')
        // Insert the missing zero stack first so concurrent Shop/planting locks use the same row.
        await tx.insert(playerSeedStacks).values({ playerId, speciesId: command.speciesId, quantity: 0 }).onConflictDoNothing()
        const [stack] = await tx.select().from(playerSeedStacks).where(and(eq(playerSeedStacks.playerId, playerId), eq(playerSeedStacks.speciesId, command.speciesId))).for('update')
        const quantity = stack.quantity + command.amount
        if (quantity < 0 || quantity > MAX_ECONOMY_INTEGER) throw ApiError.validation('Seed adjustment exceeds the available stack or storage capacity.')
        await tx.update(playerSeedStacks).set({ quantity, version: stack.version + 1, updatedAt: now }).where(and(eq(playerSeedStacks.playerId, playerId), eq(playerSeedStacks.speciesId, command.speciesId)))
      } else {
        // Match normal collection's occupancy -> specimen lock order.
        const [occupancy] = await tx.select().from(nurseryOccupancies).where(and(eq(nurseryOccupancies.playerId, playerId), eq(nurseryOccupancies.specimenId, command.specimenId))).for('update')
        if (!occupancy) throw ApiError.notFound('Owned Nursery occupancy not found.')
        const [specimen] = await tx.select().from(plantSpecimens).where(and(eq(plantSpecimens.id, command.specimenId), eq(plantSpecimens.ownerPlayerId, playerId))).for('update')
        if (!specimen || specimen.lifecycleStatus !== 'growing') throw ApiError.notFound('Owned growing specimen not found.')
        const floor = occupancy.plantedAt.getTime() + 1
        const target = command.minutes === 'complete' ? now.getTime() : occupancy.readyAt.getTime() - command.minutes * 60_000
        const readyAt = new Date(Math.max(floor, Math.min(occupancy.readyAt.getTime(), target)))
        // Preserve IDs, genetics, plantedAt and rule constants. Normal collection remains authoritative.
        await tx.update(nurseryOccupancies).set({ readyAt, version: occupancy.version + 1, updatedAt: now }).where(and(eq(nurseryOccupancies.playerId, playerId), eq(nurseryOccupancies.slotId, occupancy.slotId)))
      }
      if (command.type === 'adjust-seeds' || command.type === 'advance-growth') {
        await tx.insert(playerPlantLifecycleVersions).values({ playerId, version: 1, updatedAt: now }).onConflictDoUpdate({ target: playerPlantLifecycleVersions.playerId, set: { version: sql`${playerPlantLifecycleVersions.version} + 1`, updatedAt: now } })
      }
      await tx.insert(gameplayCommandReceipts).values({ playerId, idempotencyKey: command.commandId, commandType: 'dev-tools-v1', requestFingerprint: fingerprint, status: 'completed', responsePayload: { commandId: command.commandId }, completedAt: now })
    })
    // Replays return fresh authoritative projections without repeating the adjustment.
    const [grower, lifecycle] = await Promise.all([new GrowerAlphaService(this.database).project(playerId), new PlantLifecycleService(this.database, { environment: this.environment }).getProjectionV3(playerId)])
    return { commandId: command.commandId, grower, lifecycle }
  }

  async specimen(playerId: string, specimenId: string): Promise<DevSpecimenDiagnostics> {
    const lifecycle = await new PlantLifecycleService(this.database, { environment: this.environment }).getProjectionV3(playerId)
    const specimen = lifecycle.ownedSpecimens.find(p => p.specimenId === specimenId) ?? lifecycle.nursery.slots.flatMap(s => s.occupancy ? [s.occupancy.specimen] : []).find(p => p.specimenId === specimenId)
    if (!specimen) throw ApiError.notFound('Owned specimen not found.')
    const [[metadata], [listing]] = await Promise.all([
      this.database.select().from(playerGardenSpecimens).where(and(eq(playerGardenSpecimens.playerId, playerId), eq(playerGardenSpecimens.specimenId, specimenId))),
      this.database.select().from(marketplaceListings).where(and(eq(marketplaceListings.specimenId, specimenId), eq(marketplaceListings.sellerPlayerId, playerId), eq(marketplaceListings.status, 'active'))),
    ])
    const plant: CollectedPlant = { id: specimenId, ownerId: playerId, speciesId: specimen.speciesId, cloneLineId: specimen.cloneLineId, stage: 'mature', plantedAt: specimen.plantedAt, lastUpdatedAt: specimen.plantedAt, collectedAt: specimen.collectedAt ?? specimen.plantedAt, genetics: specimen.genetics, geneticFeatures: specimen.geneticFeatures, specialVariants: specimen.specialVariants, isHybrid: specimen.isHybrid, isHarvestable: false, isListedForSale: !!listing }
    const npcValue = specimen.lifecycleStatus === 'owned' ? getNpcSaleValue(plant) : null
    const reason = specimen.lifecycleStatus !== 'owned' ? 'Collect the mature specimen first.' : metadata?.favorite ? 'Favorite protection.' : listing ? 'Active Marketplace listing.' : npcValue === null ? 'No sale value.' : 'Eligible.'
    const eligible = reason === 'Eligible.'
    return { specimenId, npcValue, npcSaleEligible: eligible, listingEligible: eligible, reason, favorite: metadata?.favorite ?? false, activeListingId: listing?.id ?? null }
  }
}
