import assert from 'node:assert/strict'
import test from 'node:test'
import { DEVELOPMENT_GROWTH_DURATION_MS, establishCommoditySeedGenetics, resolveDevelopmentReadyAt, resolvePlantGrowth, rollShiny } from './plantLifecycleRules.ts'

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
test('two-minute prototype growth is available in development and staging but rejected in production', () => {
  const plantedAt = new Date('2026-01-01T00:00:00.000Z')
  assert.equal(resolveDevelopmentReadyAt(plantedAt, 'development').getTime(), plantedAt.getTime() + DEVELOPMENT_GROWTH_DURATION_MS)
  assert.equal(resolveDevelopmentReadyAt(plantedAt, 'staging').getTime(), plantedAt.getTime() + DEVELOPMENT_GROWTH_DURATION_MS)
  assert.throws(() => resolveDevelopmentReadyAt(plantedAt, 'production'))
})

test('production planting uses the existing species schedule without changing persisted or staging schedules', () => {
  const plantedAt = new Date('2026-01-01T00:00:00Z')
  assert.deepEqual(resolvePlantGrowth(plantedAt, 'production', 'echinopsis-pachanoi'), { readyAt: new Date('2026-01-02T00:00:00Z'), growthRuleVersion: 2 })
  assert.equal(resolvePlantGrowth(plantedAt, 'production', 'lophophora-williamsii').readyAt.toISOString(), '2026-01-04T00:00:00.000Z')
  assert.equal(resolvePlantGrowth(plantedAt, 'staging', 'echinopsis-pachanoi').readyAt.getTime(), plantedAt.getTime() + DEVELOPMENT_GROWTH_DURATION_MS)
  assert.throws(() => resolvePlantGrowth(plantedAt, 'production', 'unknown'))
})
