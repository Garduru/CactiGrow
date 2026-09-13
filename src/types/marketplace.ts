export type MarketplaceListingStatus = 'active' | 'cancelled'

export interface MarketplaceListing {
  id: string
  sellerId: string
  plantId: string
  askingPrice: number
  createdAt: string
  status: MarketplaceListingStatus
  cancelledAt?: string
}
