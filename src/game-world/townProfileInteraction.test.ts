import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { EventEmitter } from 'node:events'
import { JSDOM } from 'jsdom'

test('Town pointer handlers open profiles on tap/click, preserve ground movement, and cancel drags/pinches/cancelled touches', async () => {
  const bundled = await build({ entryPoints: ['src/game-world/TownTestScene.ts'], bundle: true, write: false, format: 'esm', platform: 'node',
    plugins: [{ name: 'phaser-input-test', setup(plugin) {
      plugin.onResolve({ filter: /^phaser$/ }, () => ({ path: 'phaser', namespace: 'test' }))
      plugin.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: `export default { Scene: class {}, Scenes: {Events:{SHUTDOWN:'shutdown'}}, Math: {
        Vector2: class { constructor(x,y) {this.x=x;this.y=y} }, Distance: {Between:(x,y,a,b)=>Math.hypot(x-a,y-b)} } }` }))
    } }], define: { 'import.meta.env.DEV': 'false' } })
  const { TownTestScene } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)
  const intents: unknown[] = []
  const scene = new TownTestScene({ emitIntent: (intent: unknown) => intents.push(intent) }, false, { spawnId: 'farm-arrival' })
  const dom = new JSDOM('<canvas tabindex="0"></canvas>')
  const canvas = dom.window.document.querySelector('canvas')!
  const input = Object.assign(new EventEmitter(), { keyboard: { enabled: true, manager: { enabled: true }, resetKeys() {}, createCursorKeys: () => ({}), addKeys: () => ({ interact: new EventEmitter() }) }, manager: { pointers: [] as unknown[] } })
  scene.input = input; scene.game = { canvas }; scene.events = new EventEmitter()
  scene.remotePlayers = { getPosition: () => ({ x: 100, y: 100 }), getAtPosition: ({ x }: { x: number }) => x === 100 ? { publicId: 'remote-profile' } : undefined }
  scene.player = { x: 150, y: 100 }
  scene.createInput()
  const pointer = (touch = true, x = 100) => ({ pointerId: 1, worldX: x, worldY: 100, x, y: 100, wasTouch: touch, isDown: true })
  for (const touch of [true, false]) {
    const p = pointer(touch); input.manager.pointers = [p]
    input.emit('pointerdown', p); p.isDown = false; input.emit('pointerup', p)
    scene.navigation.update(scene.player, 16, 245, performance.now())
    assert.deepEqual(intents.pop(), { type: 'OPEN_PLAYER_PROFILE', publicId: 'remote-profile' })
    assert.equal(scene.navigation.destination, null)
  }
  // Mouse retargeting is immediate, including motion before release.
  for (const x of [300, 600, 400, 800]) {
    const p = pointer(false, x); input.manager.pointers = [p]
    input.emit('pointerdown', p)
    assert.deepEqual({ ...scene.navigation.destination }, { x, y: 100 })
    p.x += 30; input.emit('pointermove', p)
    p.isDown = false; input.emit('pointerup', p)
    assert.deepEqual({ ...scene.navigation.destination }, { x, y: 100 })
  }
  const ground = pointer(true, 300); input.manager.pointers = [ground]
  input.emit('pointerdown', ground); ground.isDown = false; input.emit('pointerup', ground)
  assert.deepEqual({ ...scene.navigation.destination }, { x: 300, y: 100 })
  for (const cancellation of ['drag', 'pointercancel', 'touchcancel', 'pointerupoutside', 'pinch']) {
    const p = pointer(); input.manager.pointers = [p]; input.emit('pointerdown', p)
    if (cancellation === 'drag') { p.x += 20; input.emit('pointermove', p) }
    else if (cancellation === 'pinch') {
      const second = { ...pointer(), pointerId: 2, x: 200 }; input.manager.pointers.push(second); input.emit('pointerdown', second); second.isDown = false
    } else if (cancellation === 'pointerupoutside') input.emit('pointerupoutside', p)
    else canvas.dispatchEvent(new dom.window.Event(cancellation))
    p.isDown = false; input.emit('pointerup', p)
    assert.equal(intents.length, 0, cancellation)
  }
  scene.events.emit('shutdown')
})


test('Farm rapid mouse destinations replace immediately before release or arrival', async () => {
  const bundled = await build({ entryPoints: ['src/game-world/FarmTestScene.ts'], bundle: true, write: false, format: 'esm', platform: 'node',
    plugins: [{ name: 'phaser-farm-input-test', setup(plugin) {
      plugin.onResolve({ filter: /^phaser$/ }, () => ({ path: 'phaser', namespace: 'test' }))
      plugin.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: `export default { Scene: class {}, Scenes: {Events:{SHUTDOWN:'shutdown'}}, Math: {
        Vector2: class { constructor(x,y) {this.x=x;this.y=y} }, Distance: {Between:(x,y,a,b)=>Math.hypot(x-a,y-b)} } }` }))
    } }], define: { 'import.meta.env.DEV': 'false' } })
  const { FarmTestScene } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)
  const dom = new JSDOM('<canvas tabindex="0"></canvas>')
  const scene = new FarmTestScene({}, false, { spawnId: 'default' })
  const input = Object.assign(new EventEmitter(), { keyboard: { enabled: true, manager: { enabled: true }, resetKeys() {}, createCursorKeys: () => ({}), addKeys: () => ({ interact: new EventEmitter() }) }, manager: { pointers: [] } })
  scene.input = input; scene.game = { canvas: dom.window.document.querySelector('canvas') }; scene.events = new EventEmitter()
  scene.player = { x: 150, y: 100 }
  scene.createInput()
  for (const x of [300, 600, 400, 800]) {
    const p = { pointerId: 1, worldX: x, worldY: 100, x, y: 100, wasTouch: false, isDown: true }
    input.emit('pointerdown', p)
    assert.deepEqual({ ...scene.navigation.destination }, { x, y: 100 })
    input.emit('pointerup', p)
  }
  scene.events.emit('shutdown'); dom.window.close()
})
