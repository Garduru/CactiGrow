import assert from 'node:assert/strict'
import test from 'node:test'
import { TOWN_BOUNDARY_COLLIDERS, TOWN_ROAD_POST_COLLIDERS, TOWN_BUILDING_COLLIDERS, TOWN_COLLIDERS, TOWN_LOCATION_LAYOUT, TOWN_WORLD_WIDTH, TOWN_WORLD_HEIGHT } from './townGeometry.ts'
import { NavigationMap } from '../../src/game-world/navigation/NavigationMap.ts'
import { findArea } from './world.ts'
import { TOWN_NPC_ENTITY_IDS } from '../api/townContentV1.ts'

test('shared Town geometry preserves all ten accepted runtime rectangles and building approaches', () => {
  assert.equal(TOWN_WORLD_WIDTH, 2200); assert.equal(TOWN_WORLD_HEIGHT, 1500)
  assert.deepEqual(TOWN_BOUNDARY_COLLIDERS, [{ x: 1100, y: 58, width: 2080, height: 30 }, { x: 68, y: 750, width: 30, height: 1400 }, { x: 2132, y: 750, width: 30, height: 1400 }, { x: 475, y: 1442, width: 820, height: 30 }, { x: 1725, y: 1442, width: 820, height: 30 }])
  assert.deepEqual(TOWN_BUILDING_COLLIDERS, [{ x: 649, y: 336, width: 460, height: 261 }, { x: 1511, y: 365, width: 666, height: 205 }, { x: 1510, y: 243, width: 312, height: 60 }])
  assert.deepEqual(TOWN_ROAD_POST_COLLIDERS, [{ x: 965, y: 1420, width: 24, height: 118 }, { x: 1235, y: 1420, width: 24, height: 118 }])
  assert.equal(TOWN_COLLIDERS.length, 10)
  assert.deepEqual(TOWN_LOCATION_LAYOUT.map(l => [l.id, l.interactionX, l.interactionY, l.interactionRadius, l.approachX, l.approachY]), [['shop', 650, 505, 105, 650, 560], ['market', 1510, 468, 213, 1510, 590], ['farm', 1100, 1370, 130, 1100, 1300]])
})
test('all authored Town NPC approaches are clear and reachable through preserved buildings/posts from every entry', () => {
  const town = findArea('town-p1')!, navigation = new NavigationMap(town.width, town.height, TOWN_COLLIDERS, 27, 5)
  assert.equal(navigation.walkable({ x: 649, y: 336 }), false)
  assert.equal(navigation.walkable({ x: 1511, y: 365 }), false)
  const npcs = town.interactables?.filter(n => TOWN_NPC_ENTITY_IDS.includes(n.entityId as typeof TOWN_NPC_ENTITY_IDS[number])) ?? []
  assert.equal(npcs.length, 3)
  for (const npc of npcs) {
    const approach = { x: npc.x, y: npc.y + 65 }
    assert.equal(navigation.walkable(approach), true, npc.entityId)
    assert.equal(navigation.visible(approach, npc), true, npc.entityId)
    for (const entry of town.spawns) assert.ok(navigation.route(entry, approach), `${entry.entryId} -> ${npc.entityId}`)
  }
})
