import assert from 'node:assert/strict'
import test from 'node:test'
import { EventEmitter } from 'node:events'
import { build } from 'esbuild'

test('actual Farm/Town diagnostic adapters preserve scene and connection; reset uses current-world safe spawn; production exposes neither', async () => {
  for (const mode of ['development', 'staging', 'production']) {
    const result = await build({ stdin: { contents: `export {FarmTestScene} from './src/game-world/FarmTestScene';export {TownTestScene} from './src/game-world/TownTestScene';export {farmWorldSpawns} from './src/game-world/farmWorldLayout';export {townWorldSpawns} from './src/game-world/townWorldLayout';export {getWorldDiagnostics} from './src/features/devtools/worldDiagnostics';`, resolveDir: process.cwd() }, bundle: true, packages: 'external', platform: 'node', format: 'esm', write: false, define: { 'import.meta.env.MODE': JSON.stringify(mode), 'import.meta.env.DEV': 'false' }, plugins: [{ name: 'scene-renderer-fixture', setup(plugin) {
      plugin.onResolve({ filter: /^phaser$/ }, () => ({ path: 'phaser', namespace: 'fixture' }))
      plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `export default {Scene:class{},Scenes:{Events:{SHUTDOWN:'shutdown'}}}` }))
    } }] })
    const { FarmTestScene, TownTestScene, getWorldDiagnostics, farmWorldSpawns, townWorldSpawns } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
    for (const [Scene, name, spawnId, expected] of [[FarmTestScene, 'Farm', 'default', farmWorldSpawns.default], [TownTestScene, 'Town', 'farm-arrival', townWorldSpawns['farm-arrival']]]) {
      let starts = 0, stops = 0, editorSetups = 0
      const connection = { start() { starts++ }, stop() { stops++ }, getSnapshot: () => ({ status: 'connected', layerId: 'test-layer', remotes: [{ publicId: 'remote' }] }) }
      const bridge = { getProjection: () => ({ locations: [] }), subscribeToProjection: () => () => {} }
      const scene = new Scene(bridge, false, { spawnId, connection })
      scene.physics = { world: { setBounds() {}, drawDebug: false, createDebugGraphic() { this.debugGraphic = { setVisible() {} } } } }
      scene.cameras = { main: { setBounds() {} } }; scene.events = new EventEmitter(); scene.children = { list: [] }
      scene.add = { graphics: () => ({ setDepth() { return this }, destroy() {} }) }
      for (const method of ['drawGroundAndPaths', 'drawPropertyBoundary', 'drawLandscaping', 'createLocations', 'updateGardenDisplays', 'createInput', 'configureCamera', 'rebuildNavigation', 'drawBoundary', 'setupPresence']) scene[method] = () => {}
      scene.createPlayer = () => { scene.player = { x: 1234, y: 567, body: { reset(x, y) { scene.player.x = x; scene.player.y = y } } } }
      scene.setupEditor = () => { editorSetups++ }
      scene.drawDebugOverlay = () => { const label = { destroyed: false, destroy() { this.destroyed = true } }; scene.children.list.push(label); scene.cameraDebugText = label }
      scene.create()
      const handle = getWorldDiagnostics()
      if (mode === 'production') { assert.equal(handle, null); scene.events.emit('shutdown'); continue }
      const before = handle.read(); assert.equal(before.world, name); assert.deepEqual(before.position, { x: 1234, y: 567 })
      if (name === 'Town') assert.deepEqual(before.multiplayer, { status: 'connected', layer: 'test-layer', remotePlayers: 1 })
      handle.enableEditor(); handle.enableEditor(); assert.equal(editorSetups, 1)
      assert.equal(handle.read().sessionId, before.sessionId); assert.deepEqual(handle.read().position, before.position)
      handle.setDebugVisible(true); handle.setDebugVisible(false); assert.equal(scene.cameraDebugText, null)
      assert.deepEqual(handle.read().position, before.position)
      assert.equal(handle.resetPosition(), true); assert.deepEqual(handle.read().position, expected)
      assert.equal(handle.read().sessionId, before.sessionId); assert.equal(starts, 0); assert.equal(stops, 0)
      scene.events.emit('shutdown'); assert.equal(getWorldDiagnostics(), null)
    }
  }
})
