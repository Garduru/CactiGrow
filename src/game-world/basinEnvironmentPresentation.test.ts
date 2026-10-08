import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import type Phaser from 'phaser'
import type { WorldArea, WorldVisualLayer } from '../../shared/world/types.ts'

// Bundle the presentation imports with the same resolver used by the browser.
const bundle = await build({ entryPoints: ['src/game-world/basinEnvironmentPresentation.ts'], bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' })
const { BASIN_EXTENSION_PATH, drawBasinEnvironment, hasBasinEnvironment, mirrorBasinMask } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString('base64')}`) as typeof import('./basinEnvironmentPresentation.ts')

function layer(name: WorldVisualLayer['name'], uid: number, path: string, tiles: WorldVisualLayer['tiles']): WorldVisualLayer {
  return { name, tileset: { uid, path, tileSize: 128, width: 1024, height: 512, inset: 1 }, gridWidth: 4, gridHeight: 4, cellWidth: 160, cellHeight: 160, offsetX: 5, offsetY: 7, tiles }
}
function area(visualLayers: WorldVisualLayer[]): WorldArea {
  return { areaId: 'basin-review', identifier: 'Basin_Review', zoneId: 'first-basin', displayName: 'Basin Review', areaType: 'wilderness', width: 640, height: 640, topology: { x: 0, y: 0, width: 128, height: 128 }, travelDestinationId: null, travelSpawnId: null, travelDisplayName: null, spawns: [], exits: [], collision: [{ x: 320, y: 400, width: 80, height: 160 }], visualLayers }
}

interface RenderObject { kind: 'image' | 'rectangle'; x: number; y: number; width: number; height: number; key?: string; frame?: string; depth?: number; name?: string; origin?: number[]; flip?: boolean[] }
function fakeScene(loaded: readonly number[]) {
  const objects: RenderObject[] = [], canvases: string[] = []
  const context = { drawImage() {}, createLinearGradient() { return { addColorStop() {} } }, createRadialGradient() { return { addColorStop() {} } }, fillRect() {}, globalCompositeOperation: 'source-over', fillStyle: '' }
  const texture = (width: number, height: number) => {
    const frames = new Map<string, { cutX: number; cutY: number; cutWidth: number; cutHeight: number }>([['__BASE', { cutX: 0, cutY: 0, cutWidth: width, cutHeight: height }]])
    return { has: (frame: string) => frames.has(frame), add: (frame: string, _source: number, x: number, y: number, w: number, h: number) => frames.set(frame, { cutX: x, cutY: y, cutWidth: w, cutHeight: h }), get: (frame?: string) => frames.get(frame ?? '__BASE')!, getSourceImage: () => ({ width, height }) }
  }
  const textures = new Map(loaded.map(uid => [`terrain:${uid}`, texture(1024, 512)]))
  const addObject = (object: RenderObject) => {
    objects.push(object)
    const api = { setDepth: (depth: number) => { object.depth = depth; return api }, setName: (name: string) => { object.name = name; return api }, setOrigin: (x: number, y: number) => { object.origin = [x, y]; return api }, setDisplaySize: (width: number, height: number) => { Object.assign(object, { width, height }); return api }, setFlip: (x: boolean, y: boolean) => { object.flip = [x, y]; return api } }
    return api
  }
  const scene = {
    textures: { exists: (key: string) => textures.has(key), get: (key: string) => textures.get(key)!, createCanvas: (key: string, width: number, height: number) => { canvases.push(key); textures.set(key, texture(width, height)); return { context, refresh() {} } } },
    add: { rectangle: (x: number, y: number, width: number, height: number) => addObject({ kind: 'rectangle', x, y, width, height }), image: (x: number, y: number, key: string, frame?: string) => addObject({ kind: 'image', x, y, width: 0, height: 0, key, frame }) },
  } as unknown as Phaser.Scene
  return { scene, objects, canvases }
}

test('only the versioned Basin extension opts a rough Area into the new renderer', () => {
  const old = area([layer('Ground', 125, '/assets/world/tiles/world-desert-master-v01.png', [])])
  const fallback = fakeScene([125])
  assert.equal(hasBasinEnvironment(old), false)
  assert.equal(drawBasinEnvironment(fallback.scene, old), false)
  assert.deepEqual(fallback.objects, [])
  assert.equal(hasBasinEnvironment(area([layer('Decorations', 200, BASIN_EXTENSION_PATH, [])])), true)
})

test('cardinal fades and convex corners retain authored compass directions after either image flip', () => {
  // Rows are no flip, horizontal, vertical, both. Columns are N/E/S/W
  // and NW/NE/SE/SW respectively, independently specified in world space.
  const edges = [[1, 2, 4, 8], [1, 8, 4, 2], [4, 2, 1, 8], [4, 8, 1, 2]]
  const corners = [[1, 2, 4, 8], [2, 1, 8, 4], [8, 4, 2, 1], [4, 8, 1, 2]]
  for (let flip = 0; flip < 4; flip++) {
    for (const [index, bit] of [1, 2, 4, 8].entries()) {
      assert.equal(mirrorBasinMask(bit, flip, false), edges[flip][index])
      assert.equal(mirrorBasinMask(bit, flip, true), corners[flip][index])
    }
    assert.equal(mirrorBasinMask(undefined, flip, true), 0)
    assert.equal(mirrorBasinMask(15, flip, false), 15)
  }
})

test('authored paths render between ground detail and obstacles, preserve visual bounds and reuse cached frames', () => {
  const visuals = [
    layer('Decorations', 200, BASIN_EXTENSION_PATH, [{ x: 300, y: 180, sourceX: 0, sourceY: 384, flip: 0, width: 256, height: 224 }]),
    layer('Paths', 125, '/assets/world/tiles/world-desert-master-v01.png', [{ x: 160, y: 160, sourceX: 128, sourceY: 0, flip: 1, blendEdges: 2, blendCorners: 2, roundCorners: 2 }]),
    layer('GroundVariation', 125, '/assets/world/tiles/world-desert-master-v01.png', [{ x: 0, y: 160, sourceX: 256, sourceY: 0, flip: 0 }]),
    layer('BoundaryEdges', 200, BASIN_EXTENSION_PATH, [{ x: 240, y: 320, sourceX: 0, sourceY: 128, flip: 0, width: 80, height: 80 }]),
    layer('Ground', 125, '/assets/world/tiles/world-desert-master-v01.png', [{ x: 0, y: 0, sourceX: 0, sourceY: 0, flip: 0 }]),
  ]
  const current = area(visuals), before = structuredClone(current), renderer = fakeScene([125, 200])
  const previousDocument = globalThis.document
  globalThis.document = { createElement: () => ({ getContext: () => ({ drawImage() {}, getImageData: () => ({ data: [101, 82, 61, 255] }) }) }) } as unknown as Document
  try {
    assert.equal(drawBasinEnvironment(renderer.scene, current), true)
    const images = renderer.objects.filter(object => object.kind === 'image')
    assert.deepEqual(images.map(object => [object.name, object.depth]), [['basin:Ground', 0], ['basin:GroundVariation', 5], ['basin:Paths', 10], ['basin:Decorations', 20], ['basin:BoundaryEdges', 20]])
    const path = images.find(object => object.name === 'basin:Paths')!
    assert.deepEqual([path.x, path.y, path.width, path.height, path.origin, path.flip], [164.75, 166.75, 160.5, 160.5, [0, 0], [true, false]])
    assert.equal(path.key, 'terrain:125:road:128:0:8:1::basin-round:1')
    const prop = images.find(object => object.name === 'basin:Decorations')!
    assert.deepEqual([prop.x, prop.y, prop.width, prop.height], [305, 187, 256, 224])
    assert.equal(renderer.canvases.length, 2)
    assert.equal(drawBasinEnvironment(renderer.scene, current), true)
    assert.equal(renderer.canvases.length, 2)
    assert.deepEqual(current, before)
  } finally { globalThis.document = previousDocument }
})

test('missing atlas leaves a readable visual fallback without physics or navigation calls', () => {
  const current = area([layer('Ground', 125, '/assets/world/tiles/world-desert-master-v01.png', [{ x: 0, y: 0, sourceX: 0, sourceY: 0, flip: 0 }]), layer('Decorations', 200, BASIN_EXTENSION_PATH, [])])
  const before = structuredClone(current), renderer = fakeScene([125])
  assert.equal(drawBasinEnvironment(renderer.scene, current), true)
  assert.deepEqual(renderer.objects.map(({ kind, x, y, width, height, name, depth }) => ({ kind, x, y, width, height, name, depth })), [
    { kind: 'rectangle', x: 320, y: 320, width: 640, height: 640, name: 'basin:fallback-ground', depth: 0 },
    { kind: 'rectangle', x: 320, y: 400, width: 80, height: 160, name: 'basin:fallback-boundary', depth: 20 },
  ])
  assert.deepEqual(renderer.canvases, [])
  assert.deepEqual(current, before)
})

test('mixed Ground materials reuse opaque inset frames without a feathered undercoat canvas', () => {
  const current = area([
    layer('Ground', 200, BASIN_EXTENSION_PATH, [{ x: 0, y: 0, sourceX: 0, sourceY: 0, flip: 0 }, { x: 160, y: 0, sourceX: 512, sourceY: 0, flip: 0 }]),
  ])
  const renderer = fakeScene([200]), previousDocument = globalThis.document
  globalThis.document = { createElement: () => ({ getContext: () => ({ drawImage() {}, getImageData: () => ({ data: [101, 82, 61, 255] }) }) }) } as unknown as Document
  try {
    assert.equal(drawBasinEnvironment(renderer.scene, current), true)
    const images = renderer.objects.filter(object => object.kind === 'image')
    assert.deepEqual(images.map(object => [object.key, object.frame, object.width, object.height]), [['terrain:200', '0:0', 160.5, 160.5], ['terrain:200', '512:0', 160.5, 160.5]])
    for (const [index, object] of images.entries()) {
      const frame = renderer.scene.textures.get(object.key!).get(object.frame)
      assert.deepEqual([frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight], [index * 512 + 1, 1, 126, 126])
    }
    assert.deepEqual(renderer.canvases, [])
    assert.equal(drawBasinEnvironment(renderer.scene, current), true)
    assert.deepEqual(renderer.canvases, [])
  } finally { globalThis.document = previousDocument }
})
