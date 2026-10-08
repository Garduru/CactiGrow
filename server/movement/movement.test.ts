import assert from 'node:assert/strict'
import test from 'node:test'
import { seedMovement, checkpointMovement, movementNavigation } from './movementRules.ts'
import { MovementOwner } from './MovementOwner.ts'
import { requireProximity, requireRegion, requireBuilding } from './interactionProximity.ts'
import { WORLD, findArea, runtimeAreaId } from '../../shared/world/world.ts'
import type { WorldLocation } from '../../shared/world/types.ts'
import { PLAYER_MOVEMENT_SPEED } from '../../shared/world/movement.ts'
import { isMovementCheckpointV1, isMovementAuthorityV1 } from '../../shared/api/movementV1.ts'
import { isServerMessageV1 } from '../../shared/realtime/protocolV1.ts'
import { NavigationMap } from '../../src/game-world/navigation/NavigationMap.ts'
const player = '00000000-0000-4000-8000-000000000001', other = '00000000-0000-4000-8000-000000000002'
function location(areaId = 'player-farm', position = { x: 1500, y: 1500 }, revision = 1): WorldLocation {
  const area = findArea(areaId)!
  return { projectionVersion: 1, revision, areaId, runtimeAreaId: runtimeAreaId(area, player), zoneId: area.zoneId, entryId: area.spawns[0].entryId, position, discoveredAreaIds: [areaId], discoveredTravelDestinationIds: [] }
}
for (const input of ['keyboard', 'world click', 'minimap']) test(`${input}: normal sustained walking at the actual follower speed is accepted`, () => {
  let state = seedMovement(player, location(), WORLD.version, 10_000)
  for (let step = 1; step <= 30; step++) {
    state = checkpointMovement(state, state.authority.runtimeAreaId, { x: 1500 + step * PLAYER_MOVEMENT_SPEED * .1, y: 1500 }, 10_000 + step * 100)
    assert.equal(state.authority.accepted, true)
  }
})
test('instant opposite-side teleport is rejected even after long idle; accepted state is preserved', () => {
  const state = seedMovement(player, location(), WORLD.version, 1000)
  const result = checkpointMovement(state, state.authority.runtimeAreaId, { x: 2600, y: 1500 }, 100_000)
  assert.equal(result.authority.lastRejection, 'TOO_FAST'); assert.deepEqual(result.authority.position, state.authority.position)
  assert.equal(result.creditAt, state.creditAt); assert.equal(result.authority.revision, 0)
})
test('out-of-bounds and nonfinite positions cannot poison authority', () => {
  const state = seedMovement(player, location(), WORLD.version, 1000)
  for (const point of [{ x: -1, y: 100 }, { x: 4000, y: 100 }, { x: NaN, y: 100 }]) {
    const r = checkpointMovement(state, state.authority.runtimeAreaId, point, 2000)
    assert.equal(r.authority.lastRejection, 'OUT_OF_BOUNDS'); assert.deepEqual(r.authority.position, state.authority.position)
  }
})
test('blocked geometry and short wall crossings are rejected using preserved Farm bodies', () => {
  const state = seedMovement(player, location('player-farm', { x: 380, y: 500 }), WORLD.version, 1000)
  assert.equal(checkpointMovement(state, state.authority.runtimeAreaId, { x: 665, y: 382.5 }, 2000).authority.lastRejection, 'BLOCKED_POSITION')
  assert.equal(checkpointMovement(state, state.authority.runtimeAreaId, { x: 960, y: 500 }, 2000).authority.lastRejection, 'TOO_FAST')
})
test('latency and dropped samples have bounded tolerance', () => {
  const s = seedMovement(player, location(), WORLD.version, 1000)
  assert.equal(checkpointMovement(s, s.authority.runtimeAreaId, { x: 1600, y: 1500 }, 1100).authority.accepted, true)
  assert.equal(checkpointMovement(s, s.authority.runtimeAreaId, { x: 1870, y: 1500 }, 2500).authority.accepted, true)
})
test('latency credit is consumed rather than refreshed by every checkpoint', () => {
  let s = seedMovement(player, location(), WORLD.version, 1000)
  for (let i = 1; i <= 4; i++) s = checkpointMovement(s, s.authority.runtimeAreaId, { x: s.authority.position.x + 50, y: 1500 }, 1000 + i * 100)
  assert.equal(s.authority.accepted, false); assert.equal(s.authority.lastRejection, 'TOO_FAST')
})
test('keyboard contact with the physics edge is accepted without requiring click-route margin', () => {
  const s = seedMovement(player, location('player-farm', { x: 1000, y: 500 }), WORLD.version, 1000)
  const r = checkpointMovement(s, s.authority.runtimeAreaId, { x: 962, y: 450 }, 1500)
  assert.equal(r.authority.accepted, true)
})
test('a coordinate packet cannot change Area or private Farm owner', () => {
  const s = seedMovement(player, location(), WORLD.version, 1000)
  for (const runtime of ['town', `farm-${other}`]) assert.equal(checkpointMovement(s, runtime, { x: 1500, y: 1500 }, 2000).authority.lastRejection, 'AREA_CHANGED')
  assert.equal(checkpointMovement(s, s.authority.runtimeAreaId, s.authority.position, 2000, 2).authority.lastRejection, 'AREA_CHANGED')
})
test('durable owner restores accepted position and resets on trusted authored transition or canonical fallback', () => {
  let saved: unknown, now = 1000
  const storage = { get: () => saved, put: (s: unknown) => { saved = structuredClone(s) } }
  let owner = new MovementOwner(storage, () => now)
  owner.execute(player, { type: 'seed', location: location() }); now = 1500
  const accepted = owner.execute(player, { type: 'move', runtimeAreaId: `farm-${player}`, position: { x: 1600, y: 1500 } })
  owner = new MovementOwner(storage, () => now)
  assert.deepEqual(owner.execute(player, { type: 'seed', location: location() }).position, accepted.position)
  const town = location('town-p1', { x: 1100, y: 1280 }, 2)
  assert.deepEqual(owner.execute(player, { type: 'seed', location: town }).position, town.position)
  assert.throws(() => owner.execute(player, { type: 'seed', location: location() }), /Stale/)
  assert.equal(owner.execute(player, { type: 'move', runtimeAreaId: `farm-${player}`, position: accepted.position }).lastRejection, 'AREA_CHANGED')
  assert.deepEqual(owner.execute(player, { type: 'seed', location: location('player-farm', { x: 1500, y: 1500 }, 2) }).position, { x: 1500, y: 1500 })
})
test('nearby NPC and resource accepted; remote NPC/resource rejected from accepted position', () => {
  const area = findArea('town-p1')!, npc = area.interactables!.find(e => e.kind === 'npc')!
  const near = seedMovement(player, location('town-p1', { x: npc.x, y: npc.y + 60 }), WORLD.version, 1000).authority
  assert.doesNotThrow(() => requireProximity(near, area, npc, 96))
  assert.throws(() => requireProximity(seedMovement(player, location('town-p1', { x: 1100, y: 1280 }), WORLD.version, 1000).authority, area, npc, 96), /Approach/)
  const cross = findArea('cross-path-1')!, node = cross.interactables!.find(e => e.resourceType)!
  const resource = seedMovement(player, location(cross.areaId, { x: node.x, y: node.y + 50 }), WORLD.version, 1000).authority
  assert.doesNotThrow(() => requireProximity(resource, cross, node, 96))
  assert.throws(() => requireProximity(seedMovement(player, location(cross.areaId, cross.spawns[0]), WORLD.version, 1000).authority, cross, node, 96), /Approach/)
})
test('landmarks and authored exits require server presence inside the actual region', () => {
  const area = WORLD.areas.find(a => a.landmarks?.length)!, region = area.landmarks![0]
  const near = seedMovement(player, location(area.areaId, region), WORLD.version, 1000).authority
  assert.doesNotThrow(() => requireRegion(near, area, region))
  assert.throws(() => requireRegion({ ...near, position: { x: region.x + region.width, y: region.y } }, area, region), /Reach/)
  const exit = area.exits[0]
  assert.throws(() => requireRegion({ ...near, position: { x: exit.x + exit.width, y: exit.y } }, area, exit), /Reach/)
})
test('Farm buildings and Town entrances require accepted proximity', () => {
  const farm = findArea('player-farm')!, authority = seedMovement(player, location('player-farm', { x: 1500, y: 870 }), WORLD.version, 1000).authority
  assert.doesNotThrow(() => requireBuilding(authority, farm, 'home'))
  assert.throws(() => requireBuilding(authority, farm, 'lab'), /Approach/)
  const town = findArea('town-p1')!, atShop = seedMovement(player, location(town.areaId, { x: 650, y: 560 }), WORLD.version, 1000).authority
  assert.doesNotThrow(() => requireBuilding(atShop, town, 'shop')); assert.throws(() => requireBuilding(atShop, town, 'market'), /Approach/)
})
test('all authored spawns have a safe physical arrival and navigation uses canonical bodies', () => {
  for (const area of WORLD.areas) for (const spawn of area.spawns) {
    const map = movementNavigation(runtimeAreaId(area, player)), path = map.route(spawn, spawn)
    assert.ok(path && Math.hypot(path.at(-1)!.x - spawn.x, path.at(-1)!.y - spawn.y) <= 6, `${area.areaId}/${spawn.entryId}`)
  }
})
test('movement DTOs and private socket corrections reject malformed authority', () => {
  const a = seedMovement(player, location(), WORLD.version, 1000).authority
  assert.ok(isMovementAuthorityV1(a)); assert.ok(isServerMessageV1({ v: 1, eventSequence: 0, type: 'movement-authority', authority: a }))
  assert.equal(isMovementAuthorityV1({ ...a, position: { x: NaN, y: 1 } }), false)
  assert.equal(isMovementCheckpointV1({ v: 1, expectedWorldRevision: 1, runtimeAreaId: `farm-${player}`, position: a.position, speed: 99999 }), false)
})

test('deferred graph preserves collision, sight and exact detour routes without eager graph work on reads', () => {
  const obstacles = [{ x: 250, y: 250, width: 100, height: 200 }]
  const eager = new NavigationMap(500, 500, obstacles), deferred = new NavigationMap(500, 500, obstacles, 27, 5, true)
  for (const point of [{ x: 150, y: 250 }, { x: 250, y: 250 }, { x: 400, y: 300 }]) assert.equal(deferred.walkable(point), eager.walkable(point))
  assert.equal(deferred.visible({ x: 100, y: 250 }, { x: 400, y: 250 }), false)
  assert.deepEqual(deferred.route({ x: 100, y: 250 }, { x: 400, y: 250 }), eager.route({ x: 100, y: 250 }, { x: 400, y: 250 }))
  assert.deepEqual(deferred.nodes, eager.nodes)
})
