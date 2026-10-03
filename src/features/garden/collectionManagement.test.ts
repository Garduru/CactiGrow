import assert from 'node:assert/strict'
import test from 'node:test'
import type { CollectedPlant } from '../../game/gameState.ts'
import { DEFAULT_COLLECTION_FILTERS as defaults, canUseBulkResearch, isEligibleForBreeding, isProtectedFromTransfer, manageCollection, researchStatus, reviewResearchBatch } from './collectionManagement.ts'
import { analyzeCloneLine, createGeneticsResearchState, observeCloneLine, projectGeneticKnowledge } from '../research/researchModel.ts'
import { createGrowerCommandRunner } from '../../app/growerCommandRunner.ts'
import type { GrowerAlphaCommandV1, GrowerAlphaProjectionV1 } from '../../../shared/api/growerAlphaV1.ts'

const plant = (id: string, speciesId = 'echinopsis-pachanoi'): CollectedPlant => ({ id, speciesId, ownerId: 'owner', cloneLineId: id, stage: 'mature', plantedAt: '2026-01-01T00:00:00Z', lastUpdatedAt: '2026-01-01T00:00:00Z', collectedAt: `2026-01-0${id === 'a' ? 1 : 2}T00:00:00Z`, genetics: { vigor: 50, growthSpeed: 50, size: 50, flowering: 50, mutationChance: 50 }, geneticFeatures: [], specialVariants: [], isHarvestable: false, isListedForSale: false })
const plants = [plant('a'), plant('b'), plant('c', 'lophophora-williamsii')]
const organization = { a: { specimenId: 'a', favorite: true, tags: ['Keeper'] } }
const research = observeCloneLine(createGeneticsResearchState(), plants[0], Date.now()).research

test('combined Favorites/species, research/species, search and stable sorting use visible identity', () => {
  const run = (filters = defaults, sort: Parameters<typeof manageCollection>[5] = 'newest') => manageCollection(plants, organization, research, 1, filters, sort).map((p) => p.id)
  assert.deepEqual(run({ ...defaults, favorite: true, species: 'echinopsis-pachanoi' }), ['a'])
  assert.deepEqual(run({ ...defaults, research: 'unresearched', species: 'echinopsis-pachanoi' }), ['b'])
  assert.deepEqual(run({ ...defaults, research: 'researched' }), ['a'])
  assert.deepEqual(run({ ...defaults, search: 'Peyote' }), ['c'])
  assert.deepEqual(run({ ...defaults, search: 'Keeper' }), ['a'])
  assert.deepEqual(run({ ...defaults, search: 'vigor' }), [])
  assert.equal(run(defaults, 'favorites')[0], 'a')
  assert.equal(run(defaults, 'oldest')[0], 'a')
  assert.deepEqual(run({ ...defaults, research: 'available' }), ['b', 'c'])
  assert.deepEqual(run({ ...defaults, research: 'complete' }), [])
})

test('research review deduplicates clone lines and respects maturity, complete state and existing level milestones', () => {
  const twin = { ...plants[0], id: 'twin' }
  const immature = { ...plants[2], stage: 'seedling' as const }
  const review = reviewResearchBatch([plants[0], plants[1], twin, immature], research, 1)
  assert.deepEqual(review.eligible.map((p) => p.id), ['b'])
  assert.equal(review.skipped, 3)
  assert.match(researchStatus(research.records.a), /Observed/)
  assert.equal(researchStatus(undefined), 'Unresearched')
  assert.equal(reviewResearchBatch([plants[0]], research, 10).eligible.length, 1)
  let state = research
  for (let i = 0; i < 5; i++) state = analyzeCloneLine(state, plants[0], 99, Date.now()).research
  assert.equal(researchStatus(state.records.a), 'Research complete')
  assert.equal(reviewResearchBatch([plants[0]], state, 99).eligible.length, 0)
})

test('Favorite protects transfer without preventing breeding and bulk uses the existing upgrade', () => {
  assert.equal(isProtectedFromTransfer(organization.a), true)
  assert.equal(isEligibleForBreeding(plants[0]), true)
  assert.equal(isEligibleForBreeding({ ...plants[0], isListedForSale: true }), false)
  assert.equal(canUseBulkResearch({ buildings: { garden: { level: 1 } } }), false)
  assert.equal(canUseBulkResearch({ buildings: { garden: { level: 2 } } }), true)
})

test('knowledge retains hidden carriers until both level and research milestone permit them', () => {
  const hidden = { ...plants[0], geneticFeatures: [{ featureId: 'variegation', expressed: false, expressionStrength: 0, genotype: { kind: 'presence' as const, state: 'carrier' as const }, stability: 'stable' as const, origin: 'inherited' as const }] }
  assert.equal(projectGeneticKnowledge(hidden, undefined, 99).quantitativeGenetics, undefined)
  assert.deepEqual(projectGeneticKnowledge(hidden, research.records.a, 99).carrierFeatures, [])
  const record = { ...research.records.a, knownCarrierFeatureIds: ['variegation'], completedResearchMilestones: [...research.records.a.completedResearchMilestones, 'carrier-detection' as const] }
  assert.deepEqual(projectGeneticKnowledge(hidden, record, 29).carrierFeatures, [])
  assert.equal(projectGeneticKnowledge(hidden, record, 30).carrierFeatures.length, 1)
})

test('1000 plants filter without mutating source identity or selection inputs', () => {
  const large = Array.from({ length: 1000 }, (_, i) => ({ ...plants[i % 3], id: `specimen-${i}` }))
  const originalIds = large.map((p) => p.id)
  const selected = new Set(['specimen-1', 'specimen-900'])
  const filtered = manageCollection(large, {}, research, 1, { ...defaults, species: 'echinopsis-pachanoi' }, 'name')
  assert.equal(filtered.length, 667)
  assert.deepEqual(large.map((p) => p.id), originalIds)
  assert.deepEqual([...selected], ['specimen-1', 'specimen-900'])
})

test('lost batch response retries the same receipt, retaining batch summary while applying fresh research', async () => {
  const commands: GrowerAlphaCommandV1[] = []
  const receipt = { researchBatch: { succeeded: ['a'], skipped: [] } } as unknown as GrowerAlphaProjectionV1
  const current = { player: { tokenBalance: 200 }, research } as GrowerAlphaProjectionV1
  let applied: GrowerAlphaProjectionV1 | undefined
  let invalidations = 0
  const run = createGrowerCommandRunner({
    async send(command) { commands.push(command); if (commands.length === 1) throw new Error('Lost response'); return receipt },
    read: async () => current, apply: (p) => { applied = p }, invalidateReads() {}, reconcileFailure: async () => {}, saleSettled: () => { invalidations++ }, createId: () => crypto.randomUUID(),
  })
  const input = { type: 'research-specimens' as const, specimenIds: ['a'] }
  await assert.rejects(run(input)); await run(input)
  assert.deepEqual(commands[0], commands[1])
  assert.equal(applied?.research, research)
  assert.equal(applied?.researchBatch, receipt.researchBatch)
  assert.equal(invalidations, 0)
})
