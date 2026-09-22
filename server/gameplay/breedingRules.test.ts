import assert from 'node:assert/strict'
import test from 'node:test'
import { canBreed, createBredSeed } from '../../src/features/breeding/breedingModel.ts'
import type { Plant } from '../../src/types/plant.ts'

function mature(id: string, speciesId: string): Plant {
  return { id, ownerId: 'player-a', speciesId, cloneLineId: `${id}-clone`, stage: 'mature', plantedAt: '2026-01-01T00:00:00.000Z', lastUpdatedAt: '2026-01-02T00:00:00.000Z', genetics: { vigor: 50, growthSpeed: 50, size: 50, flowering: 50, mutationChance: 1 }, geneticFeatures: [], specialVariants: [], isHarvestable: false, isListedForSale: false }
}

test('shared breeding rules accept same-genus parents and reject self, growing, listed, or cross-genus parents', () => {
  const sanPedroA = mature('a', 'echinopsis-pachanoi')
  const sanPedroB = mature('b', 'echinopsis-pachanoi')
  const peyoteA = mature('c', 'lophophora-williamsii')
  const peyoteB = mature('d', 'lophophora-williamsii')
  assert.equal(canBreed(sanPedroA, sanPedroB), true)
  assert.equal(canBreed(peyoteA, peyoteB), true)
  assert.equal(canBreed(sanPedroA, peyoteA), false)
  assert.equal(canBreed(sanPedroA, sanPedroA), false)
  assert.equal(canBreed(sanPedroA, { ...sanPedroB, stage: 'juvenile' }), false)
  assert.equal(canBreed(sanPedroA, { ...sanPedroB, isListedForSale: true }), false)
})

test('offspring identity and inherited outcomes resolve once without mutating parents', () => {
  const first = mature('a', 'echinopsis-pachanoi')
  const second = mature('b', 'echinopsis-pachanoi')
  const parentsBefore = structuredClone([first, second])
  let next = 0
  const createId = () => `identity-${++next}`
  const offspring = createBredSeed(first, second, Date.parse('2026-01-03T00:00:00.000Z'), () => 0.5, createId, createId)
  assert.ok(offspring)
  assert.notEqual(offspring.id, offspring.cloneLineId)
  assert.deepEqual(offspring.parentPlantIds, [first.id, second.id])
  assert.deepEqual(offspring.parentSpeciesIds, [first.speciesId, second.speciesId])
  assert.deepEqual([first, second], parentsBefore)
  const repeat = createBredSeed(first, second, Date.parse('2026-01-04T00:00:00.000Z'), () => 0.5, createId, createId)
  assert.ok(repeat)
  assert.notEqual(repeat.id, offspring.id)
  assert.notEqual(repeat.cloneLineId, offspring.cloneLineId)
  assert.deepEqual([first, second], parentsBefore)
})
