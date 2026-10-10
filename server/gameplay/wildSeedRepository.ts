import { and, eq, inArray } from 'drizzle-orm'
import type { CactiGrowDatabase } from '../db/client/database.ts'
import { cloneLines, wildGeneticSeeds } from '../db/schema/index.ts'
import type { WildSeedLotV1 } from '../../shared/api/wildGeneticsV1.ts'

type Database = CactiGrowDatabase | Parameters<Parameters<CactiGrowDatabase['transaction']>[0]>[0]
export const supportsWildGenetics = (environment: string) => ['staging', 'production', 'test'].includes(environment)
export async function wildSeedTruth(db: Database, cloneIds: string[], enabled: boolean) {
  return enabled && cloneIds.length ? db.select().from(wildGeneticSeeds).where(inArray(wildGeneticSeeds.cloneLineId, cloneIds)) : []
}
export async function projectWildLots(db: Database, playerId: string): Promise<WildSeedLotV1[]> {
  const rows = await db.select({ seed: wildGeneticSeeds, speciesId: cloneLines.speciesId }).from(wildGeneticSeeds)
    .innerJoin(cloneLines, eq(cloneLines.id, wildGeneticSeeds.cloneLineId))
    .where(and(eq(wildGeneticSeeds.ownerPlayerId, playerId), eq(wildGeneticSeeds.status, 'available')))
  const lots = new Map<string, WildSeedLotV1>()
  for (const { seed, speciesId } of rows.sort((a, b) => a.seed.ordinal - b.seed.ordinal)) {
    const lot = lots.get(seed.lotId) ?? { lotId: seed.lotId, speciesId, provenance: seed.provenance, seedIds: [], quantity: 0 }
    lot.seedIds.push(seed.id); lot.quantity++; lots.set(lot.lotId, lot)
  }
  return [...lots.values()]
}
