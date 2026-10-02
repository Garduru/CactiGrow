import assert from 'node:assert/strict'
import test from 'node:test'
import { createGrowerCommandRunner } from '../../app/growerCommandRunner.ts'
import type { GrowerAlphaCommandInputV1, GrowerAlphaCommandV1, GrowerAlphaProjectionV1 } from '../../../shared/api/growerAlphaV1.ts'

for (const input of [
  { type: 'buy-shop-seeds', itemId: 'san-pedro-seed', quantity: 2 },
  { type: 'buy-marketplace-listing', listingId: '00000000-0000-4000-8000-000000000001' },
] satisfies GrowerAlphaCommandInputV1[]) {
  test(`${input.type}: ambiguous response retries once with the same receipt and reconciles current balance`, async () => {
    const commands: GrowerAlphaCommandV1[] = []
    const receipt = { player: { tokenBalance: 100 } } as GrowerAlphaProjectionV1
    const current = { player: { tokenBalance: 75 } } as GrowerAlphaProjectionV1
    let applied: GrowerAlphaProjectionV1 | undefined
    let invalidations = 0
    const run = createGrowerCommandRunner({
      async send(command) { commands.push(command); if (commands.length === 1) throw new Error('Response lost after commit'); return receipt },
      read: async () => current, apply: (p) => { applied = p }, invalidateReads() {},
      reconcileFailure: async () => {}, saleSettled: () => { invalidations++ }, createId: () => crypto.randomUUID(),
    })
    await assert.rejects(run(input))
    await run(input)
    assert.deepEqual(commands[0], commands[1])
    assert.equal(applied, current)
    assert.equal(invalidations, 2)
  })
}

test('a definitive insufficient-funds response permits a new receipt after the player earns currency', async () => {
  const ids: string[] = []
  const run = createGrowerCommandRunner({
    async send(command) { ids.push(command.commandId); if (ids.length === 1) throw Object.assign(new Error('Not enough currency'), { status: 409 }); return {} as GrowerAlphaProjectionV1 },
    read: async () => ({} as GrowerAlphaProjectionV1), apply() {}, invalidateReads() {},
    reconcileFailure: async () => {}, saleSettled() {}, createId: () => crypto.randomUUID(),
  })
  const input = { type: 'buy-shop-seeds' as const, itemId: 'san-pedro-seed', quantity: 1 }
  await assert.rejects(run(input))
  await run(input)
  assert.notEqual(ids[0], ids[1])
})
