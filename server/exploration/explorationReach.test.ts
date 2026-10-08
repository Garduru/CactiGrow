import assert from 'node:assert/strict'
import test from 'node:test'
import { validateExplorationReach, EXPLORATION_TIME_TOLERANCE_MS } from './explorationReach.ts'
import type { WorldArea } from '../../shared/world/types.ts'

const now = new Date('2026-10-07T12:00:10.000Z')
const area = (areaId: string, collision: WorldArea['collision'] = []): WorldArea => ({ areaId, identifier: 'Test', zoneId: 'first-basin', displayName: 'Test', areaType: 'path', width: 1000, height: 1000,
  topology: { x: 0, y: 0, width: 200, height: 200 }, travelDestinationId: null, travelDisplayName: null, travelSpawnId: null, spawns: [{ entryId: 'default', x: 100, y: 100 }], exits: [], collision })
test('reach uses existing player radius/clearance and rejects blocked or out-of-world reported endpoints', () => {
  const map = area('reach-ground-test', [{ x: 500, y: 500, width: 100, height: 100 }]), anchor = { position: { x: 100, y: 100 }, at: '2026-10-07T12:00:00.000Z' }
  assert.throws(() => validateExplorationReach(map, { x: 500, y: 500 }, anchor, now), /clear ground/)
  assert.throws(() => validateExplorationReach(map, { x: 420, y: 500 }, anchor, now), /clear ground/, '32-unit navigation clearance is enforced')
  assert.throws(() => validateExplorationReach(map, { x: 10, y: 100 }, anchor, now), /clear ground/)
  assert.ok(validateExplorationReach(map, { x: 600, y: 100 }, anchor, now))
})
test('reach measures canonical shortest obstacle path with server time and bounded jitter, never a client timestamp', () => {
  const map = area('reach-path-test', [{ x: 500, y: 450, width: 100, height: 650 }]), anchor = { position: { x: 100, y: 300 }, at: '2026-10-07T12:00:09.000Z' }
  assert.throws(() => validateExplorationReach(map, { x: 800, y: 300 }, anchor, now), /too fast/)
  assert.ok(validateExplorationReach(map, { x: 800, y: 300 }, { ...anchor, at: '2026-10-07T12:00:00.000Z' }, now))
  assert.throws(() => validateExplorationReach(area('reach-instant-test'), { x: 800, y: 100 }, { position: { x: 100, y: 100 }, at: now.toISOString() }, now), /too fast/)
  assert.equal(EXPLORATION_TIME_TOLERANCE_MS, 350)
})
test('unreachable pockets remain inaccessible despite arbitrarily old entry time', () => {
  const map = area('reach-pocket-test', [{ x: 500, y: 500, width: 100, height: 1000 }])
  assert.throws(() => validateExplorationReach(map, { x: 800, y: 500 }, { position: { x: 200, y: 500 }, at: '2020-01-01T00:00:00.000Z' }, now), /cannot be reached/)
})
