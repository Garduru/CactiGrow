import assert from 'node:assert/strict'
import test from 'node:test'
import { getTableName } from 'drizzle-orm'
import type { CactiGrowDatabase } from '../db/client/database.ts'
import { GardenService } from './GardenService.ts'

// Query-shape regression, not a substitute for PostgreSQL concurrency testing.
for (const status of ['owned', 'sold']) {
  test(`Garden assignment locks the specimen before checking ${status} lifecycle`, async () => {
    const operations: string[] = []
    const database = {
      select() {
        let table = ''
        const query = {
          from(value: Parameters<typeof getTableName>[0]) { table = getTableName(value); return query },
          where() { return query }, limit() { return query },
          for(mode: string) { operations.push(`lock:${table}:${mode}`); return query },
          then(resolve: (rows: object[]) => unknown) {
            if (table === 'plant_specimens') {
              assert.ok(operations.includes('lock:plant_specimens:update'))
              return Promise.resolve([{ id: 'plant', lifecycleStatus: status }]).then(resolve)
            }
            return Promise.resolve([]).then(resolve)
          },
        }
        return query
      },
      insert(table: Parameters<typeof getTableName>[0]) { return write(table) },
      delete(table: Parameters<typeof getTableName>[0]) { return write(table) },
      update(table: Parameters<typeof getTableName>[0]) { return write(table) },
      async transaction<T>(operation: (tx: unknown) => Promise<T>) { return operation(database) },
    }
    function write(table: Parameters<typeof getTableName>[0]) {
      const name = getTableName(table)
      if (name === 'player_garden_displays') {
        assert.ok(operations.includes('lock:plant_specimens:update'))
        operations.push('write-display')
      }
      const query = {
        values() { return query }, set() { return query }, where() { return query },
        onConflictDoUpdate() { return query }, onConflictDoNothing() { return query },
      }
      return query
    }
    const action = new GardenService(database as unknown as CactiGrowDatabase).execute('player', {
      type: 'assign-display', commandId: crypto.randomUUID(), specimenId: 'plant', slotId: 'garden-display-back-left',
    })
    if (status === 'sold') {
      await assert.rejects(action, /collected specimen was not found/)
      assert.ok(!operations.includes('write-display'))
    } else {
      await action
      assert.ok(operations.includes('write-display'))
    }
  })
}
