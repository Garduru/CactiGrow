import assert from 'node:assert/strict'
import test from 'node:test'
import { isExplorationCommandV1, isExplorationDevCommandV1, isExplorationRestoreCommandV1, isExplorationProjectionV1, isExplorationResultV1 } from './explorationV1.ts'
import { DEFAULT_APPEARANCE } from './startingExperienceV1.ts'

const command = { v: 1, commandId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', type: 'harvest', expectedWorldRevision: 3, position: { x: 330, y: 940 }, entityId: 'cross-wild-san-pedro' }
test('exploration commands accept only versioned, bounded endpoints and one authored target', () => {
  assert.equal(isExplorationCommandV1(command), true)
  assert.equal(isExplorationCommandV1({ ...command, type: 'inspect' }), true)
  const landmark = { v: command.v, commandId: command.commandId, type: command.type, expectedWorldRevision: command.expectedWorldRevision, position: command.position }
  assert.equal(isExplorationCommandV1({ ...landmark, type: 'discover-landmark', landmarkId: 'dry-wash' }), true)
  for (const change of [{ commandId: 'bad' }, { v: 2 }, { expectedWorldRevision: -1 }, { entityId: 'not a target' }, { quantity: 10 }, { playerId: command.commandId }, { speciesId: 'echinopsis-pachanoi' }, { position: { x: NaN, y: 1 } }, { position: { x: 0, y: Infinity } }, { position: { x: 1, y: 1, serverTime: 1 } }, { landmarkId: 'cairn' }]) assert.equal(isExplorationCommandV1({ ...command, ...change }), false)
})
test('bounded development reset has no player targeting, reward or whole-account mutation contract', () => {
  const reset = { v: 1, commandId: command.commandId, type: 'reset-cooldowns', expectedRevision: 1 }
  assert.equal(isExplorationDevCommandV1(reset), true); assert.equal(isExplorationDevCommandV1({ ...reset, type: 'reset-landmarks' }), true)
  for (const change of [{ targetPlayerId: command.commandId }, { type: 'reset-player' }, { expectedRevision: -1 }, { quantity: 6 }]) assert.equal(isExplorationDevCommandV1({ ...reset, ...change }), false)
})
test('entry restoration accepts only canonical revision and receipt ID, never reported position or cooldown reset', () => {
  const restore = { v: 1, commandId: command.commandId, expectedWorldRevision: 4 }
  assert.equal(isExplorationRestoreCommandV1(restore), true)
  for (const change of [{ position: command.position }, { expectedWorldRevision: -1 }, { resetCooldowns: true }, { playerId: command.commandId }]) assert.equal(isExplorationRestoreCommandV1({ ...restore, ...change }), false)
})
test('projection validates persistent availability/discovery timestamps and authoritative reward shape', () => {
  const projection = { projectionVersion: 1, serverNow: '2026-10-07T12:00:00.000Z', revision: 4, harvestingXp: 10,
    nodes: [{ entityId: 'cross-wild-san-pedro', areaId: 'cross-path-1', readyAt: '2026-10-07T12:10:00.000Z' }],
    landmarks: [{ landmarkId: 'dry-wash', areaId: 'the-first-basin', discoveredAt: null }], notes: [] }
  const starting = { projectionVersion: 1, revision: 2, compatibilityComplete: true, nameComplete: true, appearance: DEFAULT_APPEARANCE, appearanceComplete: true, spawnTutorialComplete: true, farmTutorialComplete: true, spawnStage: 'complete', farmStage: 'complete', equipment: { tool: 'field-knife', head: null, body: null, accessory: null }, ownedEquipment: ['field-knife'], harvestingXp: 10, tutorialSeedAvailable: false, farmSeedAvailable: false, pot: null, tutorialParentIds: [], offspringSeedId: null }
  assert.equal(isExplorationProjectionV1(projection), true)
  assert.equal(isExplorationResultV1({ projection, starting, reward: { name: 'Wild San Pedro', speciesId: 'echinopsis-pachanoi', quantity: 6, harvestingXp: 10 } }), true)
  assert.equal(isExplorationProjectionV1({ ...projection, serverNow: 'invalid' }), false)
  assert.equal(isExplorationProjectionV1({ ...projection, nodes: [{ ...projection.nodes[0], readyAt: 'bad' }] }), false)
  assert.equal(isExplorationProjectionV1({ ...projection, nodes: Array(101).fill(projection.nodes[0]) }), false)
  assert.equal(isExplorationResultV1({ projection, starting, reward: { name: 'Wild San Pedro', speciesId: 'echinopsis-pachanoi', quantity: 1000, harvestingXp: 10 } }), false)
})
