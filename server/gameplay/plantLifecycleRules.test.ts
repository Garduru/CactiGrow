import assert from 'node:assert/strict'
import test from 'node:test'
import { DEVELOPMENT_GROWTH_DURATION_MS, establishCommoditySeedGenetics, resolveDevelopmentReadyAt, rollShiny } from './plantLifecycleRules.ts'

test('commodity seed establishment uses the locked baseline without new genes', () => {
  assert.deepEqual(establishCommoditySeedGenetics('echinopsis-pachanoi'), { vigor: 50, growthSpeed: 50, size: 50, flowering: 50, mutationChance: 1 })
  assert.equal(establishCommoditySeedGenetics('unknown'), null)
})
test('Shiny succeeds for exactly one low twelve-bit outcome', () => {
  let successes = 0
  for (let value = 0; value < 4096; value += 1) if (rollShiny(() => value)) successes += 1
  assert.equal(successes, 1)
  assert.equal(rollShiny(() => 0), true)
  assert.equal(rollShiny(() => 4096), true)
  assert.equal(rollShiny(() => 1), false)
})
test('development growth is isolated and rejected in production', () => {
  const plantedAt = new Date('2026-01-01T00:00:00.000Z')
  assert.equal(resolveDevelopmentReadyAt(plantedAt, 'development').getTime(), plantedAt.getTime() + DEVELOPMENT_GROWTH_DURATION_MS)
  assert.throws(() => resolveDevelopmentReadyAt(plantedAt, 'production'))
})
