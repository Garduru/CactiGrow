import assert from 'node:assert/strict'
import test from 'node:test'
import { NavigationMap, distance, type Point } from './NavigationMap.ts'
import { NavigationController } from './NavigationController.ts'
const obstacle = { x: 500, y: 500, width: 200, height: 240 }
const from = { x: 200, y: 500 }, to = { x: 800, y: 500 }
function verify(map: NavigationMap, start: Point, path: Point[] | null) {
  assert.ok(path)
  for (const point of path) { assert.ok(map.clear(start, point), JSON.stringify({ start, point })); start = point }
}
function follow(controller: NavigationController, start: Point, limit = 1500) {
  const position = { ...start }
  for (let i = 0; i < limit; i++) {
    const v = controller.update(position, 1000 / 60, 245, i * 1000 / 60)
    position.x += v.x / 60; position.y += v.y / 60
    if (!controller.destination) return position
  }
  assert.fail('Route did not finish')
}
test('direct routes, deterministic obstacle detours and clearance', () => {
  const map = new NavigationMap(1000, 1000, [obstacle])
  assert.deepEqual(map.route({ x: 200, y: 200 }, { x: 800, y: 200 }), [{ x: 800, y: 200 }])
  const path = map.route(from, to)
  verify(map, from, path)
  assert.equal(path!.length, 3)
  assert.deepEqual(path, map.route(from, to))
  assert.ok(path!.some(p => p.y <= 348 || p.y >= 652))
  assert.ok(!map.walkable({ x: 380, y: 500 }), '27px player footprint plus 5px margin')
  assert.ok(distance(follow(newController(map, from, to), from), to) < 2)
})
function newController(map: NavigationMap, start: Point, goal: Point) { const c = new NavigationController(map); c.move(start, goal); return c }
test('multiple overlapping obstacles and simplification keep every segment clear', () => {
  const map = new NavigationMap(1200, 1000, [obstacle, { x: 650, y: 330, width: 180, height: 200 }, { x: 800, y: 650, width: 150, height: 200 }])
  const path = map.route(from, { x: 1000, y: 400 })
  verify(map, from, path)
  const open = new NavigationMap(1000, 1000, [])
  assert.deepEqual(open.simplify(from, [{ x: 300, y: 500 }, { x: 400, y: 500 }, to]), [to])
})
test('disconnected, invalid and out-of-bounds targets reject or project safely', () => {
  const wall = new NavigationMap(1000, 1000, [{ x: 500, y: 500, width: 100, height: 1000 }])
  assert.equal(wall.route(from, to), null)
  const map = new NavigationMap(1000, 1000, [obstacle])
  verify(map, from, map.route(from, { x: 500, y: 500 }))
  verify(map, from, map.route(from, { x: -100, y: 200 }))
  assert.equal(map.route(from, { x: NaN, y: 0 }), null)
  const escape = map.route({ x: 370, y: 500 }, from)
  assert.ok(escape && escape[0].x <= 368)
  assert.equal(map.route({ x: 500, y: 500 }, to), null)
})
test('latest destination replaces all waypoints and interaction intent', () => {
  const c = new NavigationController(new NavigationMap(1000, 1000, [obstacle]))
  let opened = 0
  c.approach(from, { id: 'player', position: () => to, radius: 96, moving: true, activate: () => opened++ }, 0)
  c.move(from, { x: 200, y: 200 }); c.move(from, { x: 250, y: 250 })
  assert.deepEqual(c.path, [{ x: 250, y: 250 }])
  follow(c, from); assert.equal(opened, 0)
  c.move(from, to); c.move(from, { x: NaN, y: 500 })
  assert.equal(c.destination, null)
})
test('fixed building routes to its entrance before exactly one activation', () => {
  const c = new NavigationController(new NavigationMap(1000, 1000, [obstacle])); let opened = 0
  const entrance = { x: 500, y: 720 }
  c.approach(from, { id: 'building', position: () => entrance, approach: entrance, radius: 100, activate: () => opened++ }, 0)
  const final = follow(c, from)
  assert.ok(distance(final, entrance) <= 8); assert.equal(opened, 1)
  c.update(final, 16, 245, 30000); assert.equal(opened, 1)
})
test('player behind a wall is approached into range without stacking', () => {
  const c = new NavigationController(new NavigationMap(1000, 1000, [obstacle])); let opened = 0
  c.approach(from, { id: 'remote', position: () => to, radius: 96, moving: true, activate: () => opened++ }, 0)
  verify(c.map, from, c.path)
  const final = follow(c, from)
  assert.equal(opened, 1); assert.ok(distance(final, to) <= 96 && distance(final, to) > 50)
})
test('moving target replans at bounded intervals and disappears cleanly', () => {
  const c = new NavigationController(new NavigationMap(1200, 1000, [])); let target: Point | undefined = { x: 800, y: 500 }
  c.approach(from, { id: 'remote', position: () => target, radius: 96, moving: true, activate() {} }, 0)
  const original = c.destination
  target = { x: 1000, y: 500 }; c.update(from, 16, 245, 499)
  assert.deepEqual(c.destination, original)
  c.update(from, 16, 245, 500); assert.notDeepEqual(c.destination, original)
  target = undefined; c.update(from, 16, 245, 501); assert.equal(c.destination, null)
})
test('stalled physics cancels cleanly instead of pushing indefinitely', () => {
  const c = newController(new NavigationMap(1000, 1000, []), from, to)
  for (let i = 0; i < 80; i++) c.update(from, 16, 245, i * 16)
  assert.equal(c.destination, null)
})

test('120Hz rendering with 60Hz physics stops without final-point oscillation', () => {
  const c = newController(new NavigationMap(1000, 1000, []), from, { x: 207, y: 503 })
  const p = { ...from }
  for (let i = 0; i < 100; i++) {
    const v = c.update(p, 1000 / 120, 245, i * 1000 / 120)
    if (i % 2 === 0) { p.x += v.x / 60; p.y += v.y / 60 }
  }
  assert.equal(c.destination, null); assert.ok(distance(p, { x: 207, y: 503 }) < 2)
})
test('profile remains usable beside a wall and small target movement is refreshed at arrival', () => {
  const map = new NavigationMap(1000, 1000, [obstacle])
  assert.ok(map.visible({ x: 300, y: 500 }, { x: 370, y: 500 }))
  assert.ok(!map.visible(from, to))
  const c = new NavigationController(new NavigationMap(1200, 1000, [])); let opened = 0
  let target = { x: 800, y: 500 }
  c.approach(from, { id: 'p', position: () => target, radius: 96, moving: true, activate: () => opened++ }, 0)
  target = { x: 835, y: 500 }
  const p = follow(c, from)
  assert.equal(opened, 1); assert.ok(distance(p, target) <= 96)
})
