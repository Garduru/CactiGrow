import assert from 'node:assert/strict'
import test from 'node:test'
import { getTableName } from 'drizzle-orm'
import type { CactiGrowDatabase } from '../db/client/database.ts'
import { PlantLifecycleService } from './PlantLifecycleService.ts'
import { createPropertyState } from '../../src/features/property/propertyModel.ts'
import { createAchievementProgress } from '../../src/features/achievements/achievementsModel.ts'

test('untreated bred seed plants with read-only established genetics and the seed lock', async () => {
  const now = new Date('2026-09-22T12:00:00Z')
  const seedId = '10000000-0000-4000-8000-000000000001'
  const cloneLineId = '20000000-0000-4000-8000-000000000002'
  const specimenId = '30000000-0000-4000-8000-000000000003'
  const key = '40000000-0000-4000-8000-000000000004'
  const genetics = { vigor: 61, growthSpeed: 52, size: 43, flowering: 34, mutationChance: 2 }
  const seed = { id: seedId, cloneLineId, status: 'available', geneticFeatures: [], parent1SpecimenId: 'parent-1', parent2SpecimenId: 'parent-2', parent1SpeciesId: 'echinopsis-pachanoi', parent2SpeciesId: 'echinopsis-pachanoi', isHybrid: false }
  const rows: Record<string, object[]> = {
    gameplay_command_receipts: [], bred_seeds: [seed], nursery_occupancies: [],
    clone_lines: [{ id: cloneLineId, speciesId: 'echinopsis-pachanoi', geneticRepresentationVersion: 1, visualDerivationVersion: 1 }],
    genetic_profiles: [{ cloneLineId, ...genetics }], clone_line_variants: [], bred_seed_treatments: [],
    player_grower_state: [{ property: createPropertyState(now.getTime()), version: 1, discoveries: {}, journalStats: { shinyCloneLineIds: [] }, achievements: createAchievementProgress() }],
    player_onboarding: [{ cultivationXp: 0, breedingXp: 0, geneticsXp: 0 }], player_grower_events: [],
  }
  const locks: string[] = []
  const writes: Array<{ table: string; value: unknown }> = []
  const database = {
    select() {
      let table = ''
      const query = {
        from(value: Parameters<typeof getTableName>[0]) { table = getTableName(value); return query },
        where() { return query }, limit() { return query },
        for() {
          // Model the deployed SELECT/INSERT-only genetics privilege boundary.
          if (table === 'genetic_profiles') throw new Error('permission denied for table genetic_profiles')
          locks.push(table); return query
        },
        then(resolve: (value: object[]) => unknown) { return Promise.resolve(rows[table] ?? []).then(resolve) },
      }
      return query
    },
    insert(table: Parameters<typeof getTableName>[0]) { return mutation(table) },
    update(table: Parameters<typeof getTableName>[0]) { return mutation(table) },
    async transaction<T>(operation: (tx: unknown) => Promise<T>) { return operation(database) },
  }
  function mutation(table: Parameters<typeof getTableName>[0]) {
    const name = getTableName(table)
    assert.notEqual(name, 'genetic_profiles', 'untreated planting must not rewrite genetics')
    const query = {
      values(value: unknown) { writes.push({ table: name, value }); return query },
      set(value: unknown) { writes.push({ table: name, value }); return query },
      where() { return query }, onConflictDoUpdate() { return query },
      returning() { return Promise.resolve([{ version: 2 }]) },
    }
    return query
  }
  const service = new PlantLifecycleService(database as unknown as CactiGrowDatabase, {
    environment: 'staging', now: () => now, createId: () => specimenId,
    randomUint16: () => { throw new Error('Bred-seed genetics must not reroll') },
  })
  const result = await service.plantBredSeedV3('player', key, { slotId: 'slot-1', seedId })
  assert.ok(locks.includes('bred_seeds'))
  assert.equal(result.slot.occupancy?.specimen.cloneLineId, cloneLineId)
  assert.deepEqual(result.slot.occupancy?.specimen.genetics, genetics)
  assert.equal(result.slot.occupancy?.specimen.specimenId, specimenId)
  assert.equal(result.seedId, seedId)
  assert.ok(writes.some((write) => write.table === 'nursery_occupancies'))
  assert.ok(writes.some((write) => write.table === 'bred_seeds'))
})
