import assert from 'node:assert/strict'
import test from 'node:test'
import { alphaGrowthDurationMs, shortenLegacyGrowth, DEVELOPMENT_GROWTH_DURATION_MS, establishCommoditySeedGenetics, resolveDevelopmentReadyAt, resolvePlantGrowth, rollShiny } from './plantLifecycleRules.ts'

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

test('production alpha schedule maps current species to 5 and 15 minutes and leaves staging unchanged', () => {
  const plantedAt = new Date('2026-01-01T00:00:00Z')
  assert.deepEqual(resolvePlantGrowth(plantedAt, 'production', 'echinopsis-pachanoi'), { readyAt: new Date('2026-01-01T00:05:00Z'), growthRuleVersion: 3 })
  assert.equal(resolvePlantGrowth(plantedAt, 'production', 'lophophora-williamsii').readyAt.toISOString(), '2026-01-01T00:15:00.000Z')
  assert.equal(resolvePlantGrowth(plantedAt, 'staging', 'echinopsis-pachanoi').readyAt.getTime(), plantedAt.getTime() + DEVELOPMENT_GROWTH_DURATION_MS)
  assert.throws(() => resolvePlantGrowth(plantedAt, 'production', 'unknown'))
})


test('alpha duration interpolates normal species and is bounded for new catalog entries', () => {
  assert.equal(alphaGrowthDurationMs(48), 10 * 60_000)
  assert.equal(alphaGrowthDurationMs(1), 5 * 60_000)
  assert.equal(alphaGrowthDurationMs(1000), 15 * 60_000)
  assert.throws(() => alphaGrowthDurationMs(NaN))
})

test('legacy shortening preserves original planting time, never delays maturity, and offline time is not restarted', () => {
  const plantedAt = new Date('2026-01-01T00:00:00Z')
  const previousReadyAt = new Date('2026-01-02T00:00:00Z')
  const readyAt = shortenLegacyGrowth(plantedAt, previousReadyAt, 'echinopsis-pachanoi')
  assert.equal(readyAt.toISOString(), '2026-01-01T00:05:00.000Z')
  assert.equal(plantedAt.toISOString(), '2026-01-01T00:00:00.000Z')
  assert.equal(previousReadyAt.toISOString(), '2026-01-02T00:00:00.000Z')
  const reopenedAt = new Date('2026-01-01T00:04:00Z')
  assert.equal(readyAt.getTime() - reopenedAt.getTime(), 60_000)
  assert.ok(new Date('2026-01-01T00:06:00Z') >= readyAt)
  assert.equal(shortenLegacyGrowth(plantedAt, readyAt, 'echinopsis-pachanoi').getTime(), readyAt.getTime())
  const alreadyFaster = new Date('2026-01-01T00:02:00Z')
  assert.equal(shortenLegacyGrowth(plantedAt, alreadyFaster, 'echinopsis-pachanoi').getTime(), alreadyFaster.getTime())
})
