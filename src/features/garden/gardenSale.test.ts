import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test, { after, before } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer, type ViteDevServer } from 'vite'
import { sellSelectedSpecimens } from './sellSelectedSpecimens.ts'
import { createGrowerCommandRunner } from '../../app/growerCommandRunner.ts'
import type { GrowerAlphaCommandV1, GrowerAlphaProjectionV1 } from '../../../shared/api/growerAlphaV1.ts'

test('selected IDs reach the sale action sequentially and duplicates execute only once', async () => {
  const called: string[] = []
  let active = 0
  const result = await sellSelectedSpecimens(['A', 'B', 'A', 'C'], async (id) => {
    assert.equal(active++, 0)
    called.push(id)
    await Promise.resolve()
    active--
    return true
  })
  assert.deepEqual(called, ['A', 'B', 'C'])
  assert.deepEqual([...result.sold], called)
  assert.equal(result.failed.size + result.unconfirmed.size, 0)
})

test('A/B/D successes survive C rejection and only C remains unsuccessful', async () => {
  const result = await sellSelectedSpecimens(['A', 'B', 'C', 'D'], async (id) => id !== 'C')
  assert.deepEqual([...result.sold], ['A', 'B', 'D'])
  assert.deepEqual([...result.failed], ['C'])
  assert.equal(result.unconfirmed.size, 0)
})

test('a thrown server/network error does not strand the batch or skip D', async () => {
  const result = await sellSelectedSpecimens(['A', 'B', 'C', 'D'], async (id) => {
    if (id === 'C') throw new Error('Response lost after a possible commit')
    return true
  })
  assert.deepEqual([...result.sold], ['A', 'B', 'D'])
  assert.deepEqual([...result.unconfirmed], ['C'])
  assert.equal(result.failed.size, 0)
})

function projection(tokens: number): GrowerAlphaProjectionV1 {
  return { player: { tokenBalance: tokens } } as GrowerAlphaProjectionV1
}

test('ambiguous sale retry reuses its receipt ID and applies fresh state, not the old receipt', async () => {
  const commands: GrowerAlphaCommandV1[] = []
  const applied: number[] = []
  let settled = 0
  let reconciled = 0
  let rewards = 0
  const receipts = new Map<string, GrowerAlphaProjectionV1>()
  const run = createGrowerCommandRunner({
    async send(command) {
      commands.push(command)
      if (receipts.has(command.commandId)) return receipts.get(command.commandId)!
      rewards++
      receipts.set(command.commandId, projection(10))
      throw new Error('Lost response')
    },
    read: async () => projection(30), // another successful sale has since added 20
    apply: (value) => applied.push(value.player.tokenBalance),
    invalidateReads() {}, reconcileFailure: async () => { reconciled++ },
    saleSettled: () => { settled++ }, createId: () => crypto.randomUUID(),
  })
  await assert.rejects(run({ type: 'sell-specimen-to-npc', specimenId: 'A' }))
  await run({ type: 'sell-specimen-to-npc', specimenId: 'A' })
  assert.deepEqual(commands[0], commands[1])
  assert.equal(rewards, 1)
  assert.equal(reconciled, 1)
  assert.equal(settled, 2, 'ownership/display invalidation also runs on ambiguous failure')
  assert.deepEqual(applied, [30])
})

test('concurrent mutation callers are serialized through response application', async () => {
  const order: string[] = []
  let release!: () => void
  const blocked = new Promise<void>((resolve) => { release = resolve })
  const run = createGrowerCommandRunner({
    async send(command) {
      assert.equal(command.type, 'sell-specimen-to-npc')
      const id = (command as Extract<GrowerAlphaCommandV1, { type: 'sell-specimen-to-npc' }>).specimenId
      order.push(id)
      if (id === 'A') await blocked
      return projection(id === 'A' ? 10 : 30)
    },
    read: async () => projection(30), apply: (value) => { order.push(String(value.player.tokenBalance)) },
    invalidateReads() {}, reconcileFailure: async () => {}, saleSettled() {}, createId: () => crypto.randomUUID(),
  })
  const first = run({ type: 'sell-specimen-to-npc', specimenId: 'A' })
  const second = run({ type: 'sell-specimen-to-npc', specimenId: 'B' })
  await Promise.resolve()
  assert.deepEqual(order, ['A'])
  release()
  await Promise.all([first, second])
  assert.deepEqual(order, ['A', '10', 'B', '30'])
})

let vite: ViteDevServer
before(async () => { vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' }) })
after(async () => { await vite?.close() })

test('the real demo-mature reducer sale removes ownership and grants the shared reward exactly once', async () => {
  const { createInitialGameState, gameStateReducer } = await vite.ssrLoadModule('/src/game/gameState.ts') as typeof import('../../game/gameState.ts')
  const { getNpcSaleValue } = await vite.ssrLoadModule('/src/features/marketplace/sellModel.ts') as typeof import('../marketplace/sellModel.ts')
  const now = Date.now()
  const collected = gameStateReducer(createInitialGameState(now), { type: 'plant/collected', slotId: 'slot-3', now })
  const plant = collected.ownedPlants.find((entry) => entry.id === 'demo-mature')!
  assert.ok(plant)
  const value = getNpcSaleValue(plant)!
  const action = { type: 'plant/sold-to-npc' as const, plantId: plant.id, expectedValue: value, now }
  const sold = gameStateReducer(collected, action)
  assert.equal(sold.player.tokens, collected.player.tokens + value)
  assert.equal(sold.ownedPlants.some((entry) => entry.id === plant.id), false)
  assert.equal(gameStateReducer(sold, action), sold)
})

test('confirmation renders the actual selection and its Close button is not styled as a backdrop', async () => {
  const { MultiSellDialog } = await vite.ssrLoadModule('/src/features/garden/MultiSellDialog.tsx') as typeof import('./MultiSellDialog.tsx')
  const { createInitialGameState, gameStateReducer } = await vite.ssrLoadModule('/src/game/gameState.ts') as typeof import('../../game/gameState.ts')
  const now = Date.now()
  const collected = gameStateReducer(createInitialGameState(now), { type: 'plant/collected', slotId: 'slot-3', now })
  let sales = 0
  const html = renderToStaticMarkup(createElement(MultiSellDialog, {
    ownedPlants: collected.ownedPlants, selectedSpecimenIds: new Set(['demo-mature']),
    onClose() {}, onSold() {}, onSellPlant: async () => { sales++; return true },
  }))
  assert.match(html, /Sell 1 specimen/)
  assert.match(html, /Confirm sale/)
  assert.match(html, /Cancel/)
  assert.match(html, /Estimated total/)
  assert.equal(sales, 0, 'opening confirmation must not sell')
  const css = await readFile(new URL('../../styles/game.css', import.meta.url), 'utf8')
  // Regression for the actual pointer-interception defect; this is not a browser hit-test.
  assert.match(css, /\.multi-sell-overlay\s*>\s*button\[type='button'\]\[aria-label\]\s*\{/)
  assert.doesNotMatch(css, /\.multi-sell-overlay\s+button\[type='button'\]\[aria-label\]\s*\{/)
  assert.match(css, /\.garden-specimen__select\s*\{[^}]*position:\s*relative/)
})

test('empty confirmation cannot submit a zero-specimen sale', async () => {
  const { MultiSellDialog } = await vite.ssrLoadModule('/src/features/garden/MultiSellDialog.tsx') as typeof import('./MultiSellDialog.tsx')
  const html = renderToStaticMarkup(createElement(MultiSellDialog, {
    ownedPlants: [], selectedSpecimenIds: new Set(['stale']), onClose() {}, onSold() {}, onSellPlant: async () => true,
  }))
  assert.match(html, /disabled=""[^>]*>Confirm sale/)
})
