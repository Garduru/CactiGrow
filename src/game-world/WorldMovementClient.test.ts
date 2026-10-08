import assert from 'node:assert/strict'
import test from 'node:test'
import { WorldMovementClient } from './WorldMovementClient.ts'
import { initialLocation } from '../../shared/world/world.ts'
import { seedMovement } from '../../server/movement/movementRules.ts'
import { WORLD } from '../../shared/world/world.ts'
const player = '00000000-0000-4000-8000-000000000001', location = initialLocation(player)
test('checkpoint sampling coalesces frames and uses 500ms fallback / 15s realtime persistence', async () => {
  let requests = 0
  const client = new WorldMovementClient(location, async c => { requests++; return { ...seedMovement(player, location, WORLD.version, requests).authority, position: c.position, revision: requests } })
  client.sample(location.position, false, 0); await client.flush(0)
  for (let i = 1; i < 500; i++) client.sample({ x: location.position.x + i / 10, y: location.position.y }, false, i)
  assert.equal(requests, 1)
  client.sample({ x: location.position.x + 50, y: location.position.y }, false, 500); await client.flush(500); assert.equal(requests, 2)
  client.sample({ x: location.position.x + 70, y: location.position.y }, true, 1000); assert.equal(requests, 2)
  client.sample({ x: location.position.x + 80, y: location.position.y }, true, 16000); await client.flush(16000); assert.equal(requests, 3)
})
test('rejected checkpoint corrects the client; stale responses and disposed sessions cannot snap it', async () => {
  const authority = seedMovement(player, location, WORLD.version, 1000).authority
  const client = new WorldMovementClient(location, async () => ({ ...authority, accepted: false, lastRejection: 'TOO_FAST', rejections: 1 }))
  const corrections: unknown[] = []; client.subscribeCorrection(p => corrections.push(p)); client.setPosition({ x: 2000, y: 1000 })
  await assert.rejects(client.flush(), /corrected/); assert.equal(corrections.length, 1); assert.equal(client.delta, 0)
  client.receive({ ...authority, accepted: false, lastRejection: 'TOO_FAST', rejections: 1 }); assert.equal(corrections.length, 1, 'a retained socket correction must not cancel movement on every frame')
  client.receive({ ...authority, accepted: true, revision: 3, serverNow: 3000, position: { x: 1000, y: 1000 } })
  client.receive({ ...authority, accepted: false, revision: 1, serverNow: 2000 }); assert.equal(corrections.length, 1)
  client.stop(); client.receive({ ...authority, accepted: false, revision: 4, serverNow: 4000 }); assert.equal(corrections.length, 1)
})
