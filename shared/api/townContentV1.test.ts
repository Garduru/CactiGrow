import assert from 'node:assert/strict'
import test from 'node:test'
import { TOWN_NPC_ENTITY_IDS, isTownContentCommandV1, isTownContentProjectionV1, isTownContentResultV1 } from './townContentV1.ts'

const command = { v: 1, commandId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', type: 'talk', entityId: TOWN_NPC_ENTITY_IDS[0], expectedWorldRevision: 4, position: { x: 960, y: 1215 } }
test('Town conversations accept only authored NPCs and actual bounded interaction intent', () => {
  for (const entityId of TOWN_NPC_ENTITY_IDS) assert.equal(isTownContentCommandV1({ ...command, entityId }), true)
  for (const change of [{ v: 2 }, { type: 'mark-met' }, { entityId: 'town-community-board' }, { entityId: 'mara-guide' }, { commandId: 'fake' }, { expectedWorldRevision: -1 }, { playerId: command.commandId }, { firstMetAt: '2026-10-08' }, { reward: 25 }, { position: { x: 960, y: 1215, serverNow: 0 } }, { position: { x: NaN, y: 1215 } }]) assert.equal(isTownContentCommandV1({ ...command, ...change }), false)
})
test('Town projection has three bounded first-contact notes and existing Town discovery date', () => {
  const projection = { projectionVersion: 1, revision: 0, townDiscoveredAt: null, contacts: TOWN_NPC_ENTITY_IDS.map(entityId => ({ entityId, firstMetAt: null })) }
  assert.equal(isTownContentProjectionV1(projection), true); assert.equal(isTownContentResultV1({ projection }), true)
  assert.equal(isTownContentResultV1({ projection, firstContact: true }), true)
  assert.equal(isTownContentProjectionV1({ ...projection, contacts: projection.contacts.slice(1) }), false)
  assert.equal(isTownContentProjectionV1({ ...projection, contacts: [...projection.contacts].reverse() }), false)
  assert.equal(isTownContentProjectionV1({ ...projection, townDiscoveredAt: 'fake-date' }), false)
  assert.equal(isTownContentResultV1({ projection, firstContact: 'yes' }), false)
})
