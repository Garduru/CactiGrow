import { and, eq, inArray, sql } from 'drizzle-orm'
import type { CactiGrowDatabase } from '../db/client/database.ts'
import { marketplaceListings, plantSpecimens, playerOnboarding, playerSeedStacks, playerPlantLifecycleVersions, playerGardenDisplays, playerGardenSpecimens } from '../db/schema/index.ts'
import { ApiError } from '../api/errors.ts'
import { MAX_ECONOMY_INTEGER, MAX_SHOP_QUANTITY, SHOP_CATALOG } from './shopCatalog.ts'
import { assertSpecimenUnprotected } from './specimenCommerceEligibility.ts'

type Transaction = Parameters<Parameters<CactiGrowDatabase['transaction']>[0]>[0]
const conflict = (message: string) => new ApiError('CONFLICT', 409, message)

async function bumpInventory(tx: Transaction, playerId: string, now: Date) {
  await tx.insert(playerPlantLifecycleVersions).values({ playerId, version: 1, updatedAt: now }).onConflictDoUpdate({ target: playerPlantLifecycleVersions.playerId, set: { version: sql`${playerPlantLifecycleVersions.version} + 1`, updatedAt: now } })
}

export async function buyShopSeeds(tx: Transaction, playerId: string, itemId: string, quantity: number, now: Date) {
  const item = SHOP_CATALOG.find((entry) => entry.id === itemId)
  if (!item || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_SHOP_QUANTITY) throw new ApiError('INVALID_COMMAND', 400, 'Choose a valid shop item and quantity from 1 to 100.')
  // Match planting's seed-stack -> balance lock order.
  await tx.insert(playerSeedStacks).values({ playerId, speciesId: item.speciesId, quantity: 0 }).onConflictDoNothing()
  const [stack] = await tx.select().from(playerSeedStacks).where(and(eq(playerSeedStacks.playerId, playerId), eq(playerSeedStacks.speciesId, item.speciesId))).for('update').limit(1)
  const [profile] = await tx.select().from(playerOnboarding).where(eq(playerOnboarding.playerId, playerId)).for('update').limit(1)
  const cost = item.price * quantity
  if (!profile || profile.tokenBalance < cost) throw conflict('Not enough currency for this purchase.')
  if (!stack || stack.quantity > MAX_ECONOMY_INTEGER - quantity) throw conflict('Your seed stack cannot hold this quantity.')
  await tx.update(playerSeedStacks).set({ quantity: stack.quantity + quantity, version: stack.version + 1, updatedAt: now }).where(and(eq(playerSeedStacks.playerId, playerId), eq(playerSeedStacks.speciesId, item.speciesId)))
  await tx.update(playerOnboarding).set({ tokenBalance: profile.tokenBalance - cost, version: profile.version + 1 }).where(eq(playerOnboarding.playerId, playerId))
  await bumpInventory(tx, playerId, now)
}

export async function buyMarketplaceListing(tx: Transaction, buyerId: string, listingId: string, now: Date) {
  const [reference] = await tx.select().from(marketplaceListings).where(eq(marketplaceListings.id, listingId)).limit(1)
  if (!reference) throw conflict('This listing is no longer available. Refresh the Marketplace.')
  // Specimen first: listing creation, NPC sale and breeding already lock it first.
  const [specimen] = await tx.select().from(plantSpecimens).where(eq(plantSpecimens.id, reference.specimenId)).for('update').limit(1)
  const [listing] = await tx.select().from(marketplaceListings).where(eq(marketplaceListings.id, listingId)).for('update').limit(1)
  if (!listing || listing.status !== 'active') throw conflict('This listing has already sold or was cancelled. Refresh the Marketplace.')
  if (listing.sellerPlayerId === buyerId) throw conflict('You cannot buy your own listing.')
  if (!specimen || specimen.lifecycleStatus !== 'owned' || specimen.ownerPlayerId !== listing.sellerPlayerId) throw conflict('This specimen is no longer available from this seller.')
  await assertSpecimenUnprotected(tx, listing.sellerPlayerId, specimen.id)
  // Deterministic balance locks also serialize buyers competing across listings.
  const profiles = await tx.select().from(playerOnboarding).where(inArray(playerOnboarding.playerId, [buyerId, listing.sellerPlayerId])).orderBy(playerOnboarding.playerId).for('update')
  const buyer = profiles.find((row) => row.playerId === buyerId)
  const seller = profiles.find((row) => row.playerId === listing.sellerPlayerId)
  if (!buyer || buyer.tokenBalance < listing.askingPrice) throw conflict('Not enough currency for this listing.')
  if (!seller || seller.tokenBalance > MAX_ECONOMY_INTEGER - listing.askingPrice) throw conflict('The seller cannot receive this payment.')
  await tx.update(playerOnboarding).set({ tokenBalance: buyer.tokenBalance - listing.askingPrice, version: buyer.version + 1 }).where(eq(playerOnboarding.playerId, buyerId))
  await tx.update(playerOnboarding).set({ tokenBalance: seller.tokenBalance + listing.askingPrice, version: seller.version + 1 }).where(eq(playerOnboarding.playerId, seller.playerId))
  await tx.delete(playerGardenDisplays).where(and(eq(playerGardenDisplays.playerId, seller.playerId), eq(playerGardenDisplays.specimenId, specimen.id)))
  await tx.delete(playerGardenSpecimens).where(and(eq(playerGardenSpecimens.playerId, seller.playerId), eq(playerGardenSpecimens.specimenId, specimen.id)))
  await tx.update(plantSpecimens).set({ ownerPlayerId: buyerId, version: specimen.version + 1, updatedAt: now }).where(eq(plantSpecimens.id, specimen.id))
  await tx.update(marketplaceListings).set({ status: 'sold', buyerPlayerId: buyerId, completedAt: now, version: listing.version + 1 }).where(eq(marketplaceListings.id, listingId))
  for (const id of [buyerId, seller.playerId].sort()) await bumpInventory(tx, id, now)
}
