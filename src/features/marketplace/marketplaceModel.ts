import type { CollectedPlant, GameState } from '../../game/gameState'
import type { MarketplaceListing } from '../../types/marketplace'

export const MAX_LISTING_PRICE = 1_000_000

export function isValidListingPrice(price: number): boolean {
  return Number.isSafeInteger(price) && price > 0 && price <= MAX_LISTING_PRICE
}

export function getListingForPlant(
  listings: MarketplaceListing[],
  plantId: string,
): MarketplaceListing | undefined {
  return listings.find((listing) => listing.plantId === plantId && listing.status === 'active')
}

export function getActiveListings(listings: MarketplaceListing[]): MarketplaceListing[] {
  return listings.filter((listing) => listing.status === 'active')
}

export function canListPlant(state: GameState, plantId: string, price: number): boolean {
  const plant = state.ownedPlants.find((specimen) => specimen.id === plantId)
  return Boolean(
    plant
    && !plant.isListedForSale
    && !getListingForPlant(state.marketplaceListings, plantId)
    && isValidListingPrice(price),
  )
}

export function createMarketplaceListing(
  plant: CollectedPlant,
  sellerId: string,
  askingPrice: number,
  now: number,
  createId: () => string = () => crypto.randomUUID(),
): MarketplaceListing | null {
  if (plant.isListedForSale || !isValidListingPrice(askingPrice)) return null

  return {
    id: createId(),
    sellerId,
    plantId: plant.id,
    askingPrice,
    createdAt: new Date(now).toISOString(),
    status: 'active',
  }
}

export function canCancelListing(state: GameState, listingId: string): boolean {
  const listing = state.marketplaceListings.find((entry) => entry.id === listingId)
  return Boolean(listing && listing.status === 'active' && listing.sellerId === state.player.id)
}
