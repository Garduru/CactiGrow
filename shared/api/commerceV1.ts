import type { GeneticKnowledgeProjection } from '../../src/features/research/researchModel.ts'
import type { PlantVisualDescriptor } from '../../src/types/plantVisual.ts'

export interface ShopCatalogV1 { projectionVersion: 1; items: { id: string; speciesId: string; name: string; description: string; price: number }[]; maxQuantity: number }
export interface PublicListingV1 {
  id: string; specimenId: string; speciesId: string; price: number; createdAt: string
  status: 'active' | 'sold' | 'cancelled'; own: boolean
  seller: { publicId: string; displayName: string }
  visual: PlantVisualDescriptor
  knowledge: GeneticKnowledgeProjection
}
export interface MarketplaceV1 { projectionVersion: 1; listings: PublicListingV1[]; hasMore: boolean }
export function isShopCatalogV1(value: unknown): value is ShopCatalogV1 {
  if (!value || typeof value !== 'object') return false
  const v = value as ShopCatalogV1
  return v.projectionVersion === 1 && Number.isInteger(v.maxQuantity) && v.maxQuantity > 0 && Array.isArray(v.items) && v.items.every((i) => typeof i.id === 'string' && typeof i.speciesId === 'string' && typeof i.name === 'string' && typeof i.description === 'string' && Number.isSafeInteger(i.price) && i.price > 0)
}
export function isMarketplaceV1(value: unknown): value is MarketplaceV1 {
  if (!value || typeof value !== 'object') return false
  const v = value as MarketplaceV1
  return v.projectionVersion === 1 && typeof v.hasMore === 'boolean' && Array.isArray(v.listings) && v.listings.length <= 50 && v.listings.every((l) =>
    typeof l.id === 'string' && typeof l.specimenId === 'string' && typeof l.speciesId === 'string' && typeof l.createdAt === 'string'
    && Number.isSafeInteger(l.price) && l.price > 0 && ['active', 'sold', 'cancelled'].includes(l.status) && typeof l.own === 'boolean'
    && typeof l.seller?.publicId === 'string' && typeof l.seller.displayName === 'string'
    && typeof l.visual?.specimenId === 'string' && typeof l.knowledge?.depthLabel === 'string'
    && Array.isArray(l.knowledge.visibleFeatures) && Array.isArray(l.knowledge.carrierFeatures))
}
