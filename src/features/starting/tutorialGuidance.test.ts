import assert from 'node:assert/strict'
import test from 'node:test'
import { initialStartingState } from '../../../server/starting/startingState.ts'
import { resolveTutorialGuidance, tutorialPlantRole } from './tutorialGuidance.ts'
const fresh = () => ({ ...initialStartingState(false), appearanceComplete: true })
const context = { path: '/world', areaId: 'player-farm', inventoryOpen: false, available: new Set<string>() }
test('backpack guidance hands off to real equipment and then harvest', () => {
  const s = { ...fresh(), spawnStage: 'equip-tool' as const }
  assert.equal(resolveTutorialGuidance(s, context).target, 'inventory')
  assert.equal(resolveTutorialGuidance(s, { ...context, inventoryOpen: true }).target, 'equip-tool')
  assert.equal(resolveTutorialGuidance({ ...s, spawnStage: 'harvest-cactus' }, context).target, 'entity:first-san-pedro')
})
test('Farm buildings hand off to real interior controls', () => {
  const s = { ...fresh(), spawnTutorialComplete: true, farmStage: 'nursery' as const }
  assert.equal(resolveTutorialGuidance(s, context).target, 'building:nursery')
  assert.equal(resolveTutorialGuidance(s, { ...context, path: '/nursery' }).target, 'nursery-plant')
  assert.equal(resolveTutorialGuidance({ ...s, farmStage: 'lab' }, context).target, 'building:lab')
  assert.equal(resolveTutorialGuidance({ ...s, farmStage: 'lab' }, { ...context, path: '/lab' }).target, null)
})
test('Garden research follows Details, Study Genetics, real observation without navigation shortcuts', () => {
  const s = { ...fresh(), spawnTutorialComplete: true, farmStage: 'research' as const, tutorialParentIds: ['first', 'partner'] }
  const c = { ...context, path: '/garden' }
  for (const key of ['details:first', 'study:first', 'observe:first']) {
    const g = resolveTutorialGuidance(s, { ...c, available: new Set([key]) })
    assert.equal(g.target, key); assert.ok(!g.instruction.includes('Open Garden')); assert.ok(!g.instruction.includes('first,'))
  }
  assert.equal(tutorialPlantRole(s, 'first'), 'Your first San Pedro')
  assert.equal(tutorialPlantRole(s, 'partner'), 'Practice partner')
})
test('guided breeding advances through partner and confirmation; completed and compatible players have no highlights', () => {
  const s = { ...fresh(), spawnTutorialComplete: true, farmStage: 'breeding' as const, tutorialParentIds: ['first', 'partner'] }
  const c = { ...context, path: '/garden' }
  for (const key of ['details:first', 'breed:first', 'partner:partner', 'confirm-breeding']) assert.equal(resolveTutorialGuidance(s, { ...c, available: new Set([key]) }).target, key)
  assert.deepEqual(resolveTutorialGuidance({ ...s, farmTutorialComplete: true }, c), { target: null, instruction: '' })
  assert.equal(resolveTutorialGuidance(initialStartingState(true), context).target, null)
})
