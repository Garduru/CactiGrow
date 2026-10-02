import { and, desc, eq, inArray } from 'drizzle-orm'
import type { CactiGrowDatabase } from '../db/client/database.ts'
import { marketplaceListings, plantSpecimens, cloneLines, geneticProfiles, bredSeeds, cloneLineVariants, playerProfiles, playerGrowerState, playerOnboarding } from '../db/schema/index.ts'
import type { MarketplaceV1, PublicListingV1 } from '../../shared/api/commerceV1.ts'
import type { Plant } from '../../src/types/plant.ts'
import { projectGeneticKnowledge } from '../../src/features/research/researchModel.ts'
import { getLevelFromXp } from '../../src/features/progression/progressionModel.ts'
import { createPlantVisualDescriptor } from '../../src/features/plants/plantVisualModel.ts'

export class MarketplaceService {
  private readonly database: CactiGrowDatabase
  constructor(database: CactiGrowDatabase) { this.database = database }
  async browse(viewerId: string, own = false, offset = 0): Promise<MarketplaceV1> {
    const rows = await this.database.select({ listing: marketplaceListings, specimen: plantSpecimens, line: cloneLines, genes: geneticProfiles, seller: { publicId: playerProfiles.publicId, displayName: playerProfiles.displayName } })
      .from(marketplaceListings).innerJoin(plantSpecimens, eq(plantSpecimens.id, marketplaceListings.specimenId))
      .innerJoin(cloneLines, eq(cloneLines.id, plantSpecimens.cloneLineId)).innerJoin(geneticProfiles, eq(geneticProfiles.cloneLineId, cloneLines.id))
      .innerJoin(playerProfiles, eq(playerProfiles.playerId, marketplaceListings.sellerPlayerId))
      .where(own ? eq(marketplaceListings.sellerPlayerId, viewerId) : and(eq(marketplaceListings.status, 'active'), eq(plantSpecimens.ownerPlayerId, marketplaceListings.sellerPlayerId), eq(plantSpecimens.lifecycleStatus, 'owned')))
      .orderBy(desc(marketplaceListings.createdAt), marketplaceListings.id).limit(51).offset(offset)
    const selected = rows.slice(0, 50)
    const ids = [...new Set(selected.map((row) => row.line.id))]
    const [seeds, variants, [state], [profile]] = await Promise.all([
      ids.length ? this.database.select().from(bredSeeds).where(inArray(bredSeeds.cloneLineId, ids)) : [],
      ids.length ? this.database.select().from(cloneLineVariants).where(inArray(cloneLineVariants.cloneLineId, ids)) : [],
      this.database.select().from(playerGrowerState).where(eq(playerGrowerState.playerId, viewerId)).limit(1),
      this.database.select().from(playerOnboarding).where(eq(playerOnboarding.playerId, viewerId)).limit(1),
    ])
    return { projectionVersion: 1, hasMore: rows.length > 50, listings: selected.map(({ listing, specimen, line, genes, seller }): PublicListingV1 => {
      const seed = seeds.find((row) => row.cloneLineId === line.id)
      const plant: Plant = { id: specimen.id, ownerId: specimen.ownerPlayerId, speciesId: line.speciesId, cloneLineId: line.id, stage: 'mature', plantedAt: specimen.plantedAt.toISOString(), lastUpdatedAt: specimen.updatedAt.toISOString(), genetics: { vigor: genes.vigor, growthSpeed: genes.growthSpeed, size: genes.size, flowering: genes.flowering, mutationChance: genes.mutationChance }, geneticFeatures: seed?.geneticFeatures ?? [], specialVariants: variants.filter((v) => v.cloneLineId === line.id && v.variantId === 'shiny').map((v) => ({ variantId: 'shiny', origin: 'random', establishedAt: v.establishedAt.toISOString() })), isHybrid: seed?.isHybrid ?? false, isHarvestable: false, isListedForSale: listing.status === 'active' }
      return { id: listing.id, specimenId: specimen.id, speciesId: line.speciesId, price: listing.askingPrice, createdAt: listing.createdAt.toISOString(), status: listing.status as PublicListingV1['status'], own: listing.sellerPlayerId === viewerId, seller,
        visual: createPlantVisualDescriptor(plant), knowledge: projectGeneticKnowledge(plant, state?.research.records[line.id], getLevelFromXp(profile?.geneticsXp ?? 0)) }
    }) }
  }
}
