import assert from 'node:assert/strict'
import test from 'node:test'
import { minimapPoint, walkMinimap, LocalMinimapStore } from './localMinimap.ts'
import { NavigationMap } from './navigation/NavigationMap.ts'
import { NavigationController } from './navigation/NavigationController.ts'
import { findArea } from '../../shared/world/world.ts'
test('minimap uses runtime bounds for outdoor, Farm and Town coordinate conversion', () => {
  for (const id of ['path-1', 'player-farm', 'town-p1']) {
    const area = findArea(id)!
    assert.deepEqual(minimapPoint(80, 40, 160, 80, area), { x: area.width/2, y: area.height/2 })
    assert.equal(minimapPoint(-1, 20, 160, 80, area), null)
  }
})
test('minimap delegates real pathfinding; blocked/outside/disconnected points cannot replace valid routes or teleport', () => {
  const nav = new NavigationController(new NavigationMap(1000, 700, [{ x:500, y:350, width:50, height:700 }]))
  const player = { x:100, y:100 }
  assert.equal(walkMinimap(nav, player, { x:200, y:200 }), true)
  const path = nav.path
  for (const target of [{ x:500, y:350 }, { x:-1, y:100 }, { x:800, y:200 }]) { assert.equal(walkMinimap(nav, player, target), false); assert.equal(nav.path, path) }
  assert.deepEqual(player, { x:100, y:100 })
})
test('scene minimap teardown cannot clear a new Area binding', () => {
  const store = new LocalMinimapStore(), old = () => true, next = () => false
  store.publish({ area:findArea('player-farm')!, blocked:[], player:{x:100,y:100} }, old)
  store.publish({ area:findArea('town-p1')!, blocked:[], player:{x:200,y:200} }, next)
  store.clear(old); assert.equal(store.snapshot()?.area.areaId, 'town-p1')
  store.clear(next); assert.equal(store.snapshot(), null); assert.equal(store.walk({x:0,y:0}), false)
})
