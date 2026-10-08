import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { parseWorld, topologyToRuntime } from '../../scripts/world-import.ts'
import { WORLD } from './generatedWorld.ts'
import type { WorldArea, WorldVisualLayer } from './types.ts'
import { LocalMinimapStore, minimapSurfaces, walkMinimap } from '../../src/game-world/localMinimap.ts'
import { NavigationMap } from '../../src/game-world/navigation/NavigationMap.ts'
import { NavigationController } from '../../src/game-world/navigation/NavigationController.ts'

interface AuthoredTile { px: number[]; src: number[]; f: number }
interface AuthoredLayer extends Record<string, unknown> {
  __identifier: string; __type: string; __gridSize: number; __cWid: number; __cHei: number
  __pxTotalOffsetX: number; __pxTotalOffsetY: number; __tilesetDefUid: number
  gridTiles: AuthoredTile[]; entityInstances: unknown[]
}
interface AuthoredLevel extends Record<string, unknown> {
  identifier: string; pxWid: number; pxHei: number; layerInstances: AuthoredLayer[]
}
interface AuthoredDefinition extends Record<string, unknown> { uid: number; identifier: string }
interface AuthoredProject { levels: AuthoredLevel[]; defs: Record<string, AuthoredDefinition[]> }
const source = (): AuthoredProject => JSON.parse(readFileSync('world/cactigrow-world.ldtk', 'utf8'))
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => [key, canonical(item)]))
  return value
}
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')
function authority(area: WorldArea) { const { visualLayers, ...state } = area; void visualLayers; return state }

// Captured before Settlement Art V1 from the accepted V2.1 world. These constants
// deliberately travel with the tests: no ignored .wrangler evidence is required.
const AUTHORITY_LEVELS: Record<string, string> = {
  Player_Farm: 'a53dfc3440f6a69cbe2d959b0a58292d124b48600d0c0fc482320d1495214ad7',
  Cross_Path_1: '2cb77f18eeac1ef5275d2118418f0084e10e4e4efad38b3734f5ca824e51dcd9',
  Path_1: '8e40d4cd9ba2deee83be98f790fe2c1d310da404c3376878dfc686916c22b3c7',
  Path_3: '2ab18eb8d85a7d93c7b0a681601d51163da569f52e4dbb78840d2d45a3a4842a',
  Starting_Spawn_Tutorial_1: '875e56db732ba64c2b08aa57791f9b85371ab2a110831c32588e75e85167dfa1',
  Path_2: '727e544d307d034790e64dc447d950977351dcf9cdb311a9a4e33914851336b5',
  Town_p1: '98cce880b9a07eeac44273dabd89efe2b44063f24d99cefadd092c296ad910bb',
  Basin_Cave: 'cb5f242aa75e3b9f335963cf8e7d123e8aee24ba4649e40a877cd3d01552b160',
  Path_4: 'd26849a843632d6aadb89d92d5b25458160ca2fa854bd1f373e63ccc001506c6',
  Path_5_Under_Construction: '4b0c48ce5f011c9cc1b4534b01da1a53b762b15ccf761518092c9213dac96880',
  The_First_Basin: 'fc8ce92a66682fe9d40e2d1da9ca55ed2d60ffe0199b1abfd7b174e60e3fdfb6',
}
const UNTARGETED_LEVELS: Record<string, string> = {
  Path_1: '4e7dc1c3b307091d8d7d1b3eb720bc842b9ae4bf23e682dd9e9da151107ebeb1',
  Starting_Spawn_Tutorial_1: '7cfee965ad53c3b7e6f869c6f5fa11a019f5113b861053bf7a9cd928707f2854',
}
// The seven former untouched rough Levels are explicitly authorized for First
// Basin Environment V1 visuals. Their eleven authority hashes above still apply;
// the new Basin suite also locks the now-accepted complete Farm/Town payloads.
const OLD_DEFINITIONS: Record<string, { uids: number[]; hash: string }> = {
  layers: { uids: [50, 127, 122, 1, 119, 126, 120], hash: '97d9231bc240982e77746cc9364c74fdb7469faae514eaf90fc55ab94a650ecd' },
  entities: { uids: [13, 39, 43, 103, 107, 114], hash: '7e46ba5fdc7316076bbad260e836cf703e4aa23890270ff033616211601abd79' },
  tilesets: { uids: [118, 125], hash: '21cff20cf6089e021be68f7fce0b96b911b7fb24109a61c71d4a86c90a7a03dd' },
  enums: { uids: [], hash: '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945' },
  externalEnums: { uids: [], hash: '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945' },
  levelFields: { uids: [32, 33, 34, 35, 36, 37, 38, 51, 52, 53], hash: '4c0a173bec74c49fe7278b084d846d2f06ca9c6684ef9967ceda7c1019d7181a' },
}
const RUNTIME_AUTHORITY: Record<string, string> = {
  'player-farm': '4147679cba13843c6600f1cc53aee6f350787ab131d61946f19efc7ef4442686',
  'cross-path-1': 'b2f99383bd108a740626371171a91d919a876972ab117696352430273048cd79',
  'path-1': 'f28e56a5db881865588a9447d9a07f8ea2e0cc5b7deabf008ed92c6d3b31b744',
  'path-3': '5655106d2a366ecc4923ad71492f233037e8413be05314ef9ae9dcdd652895b6',
  'starting-spawn-tutorial': '8ee07b9f517251a927e223f2a3f165d1cd2db1db56e9b70cdea92b67eac073c0',
  'path-2': 'a01fa594d17a7d8b1029cb36487b851e65cea9fb55afa2b4d94ee40bbf217a0c',
  'town-p1': '1d13958cd4dc7b557e4f00d1e90d53a5ee790e365f61345c98f6e7e3aab156a3',
  'basin-cave': '8f042d71b944cdd6779f363a0791e76a4af883680c3a08025a538c3d8bf2ba4b',
  'path-4': '3f5eaa56e9ebeb8213c3c086150a7cb14ad68b71ebd6cb1753410f86b862b94e',
  'path-5-under-construction': 'a92640b471a9090959ea5bfbac706fca9ee1b15fa000bc6dad595808ec3ae2ba',
  'the-first-basin': 'e6dd603d153d2e224de55600080ae82014a6f41951fb31aee6ed9228c9e01da5',
}
const LAYER_NAMES = ['Ground', 'GroundVariation', 'Paths', 'StructureGrounding', 'Decorations', 'BoundaryEdges'] as const
// Runtime samples the atlas inside its one-pixel inset. Source baseline122
// therefore reaches this position in the 128-unit square display envelope.
const SETTLEMENT_PROP_FOOT = (122 - 1) / (128 - 2) * 128

test('settlement art preserves all eleven authored authority Levels and both complete starting Levels', () => {
  const project = source()
  assert.deepEqual(project.levels.map(level => level.identifier).sort(), Object.keys(AUTHORITY_LEVELS).sort())
  for (const level of project.levels) {
    const protectedLevel = { ...level, layerInstances: level.layerInstances.filter(layer => !['Tiles', 'AutoLayer'].includes(layer.__type)) }
    assert.equal(hash(protectedLevel), AUTHORITY_LEVELS[level.identifier], `${level.identifier}: metadata, fields, topology, IntGrid and entities remain unchanged`)
    if (UNTARGETED_LEVELS[level.identifier]) assert.equal(hash(level), UNTARGETED_LEVELS[level.identifier], `${level.identifier}: complete untouched Level payload`)
  }
})

test('settlement authoring adds definitions without modifying any original definition', () => {
  const { defs } = source()
  for (const [group, baseline] of Object.entries(OLD_DEFINITIONS)) {
    const retained = defs[group].filter(definition => baseline.uids.includes(definition.uid))
    assert.deepEqual(retained.map(definition => definition.uid), baseline.uids, `${group}: original IDs and order`)
    assert.equal(hash(retained), baseline.hash, `${group}: original complete definition payloads`)
  }
})

test('parsed and generated world preserve every runtime identity, dimension, collision, interaction, spawn, exit and Travel field', () => {
  for (const world of [parseWorld(source()), WORLD]) {
    assert.equal(world.worldId, 'cactigrow-world')
    assert.deepEqual(world.zones, [{ zoneId: 'first-basin', displayName: 'The First Basin' }, { zoneId: 'starting-zone', displayName: 'Starting Zone' }])
    assert.deepEqual(world.areas.map(area => area.areaId).sort(), Object.keys(RUNTIME_AUTHORITY).sort())
    for (const area of world.areas) assert.equal(hash(authority(area)), RUNTIME_AUTHORITY[area.areaId], area.areaId)
  }
})

function visualFixture(identifier = 'Town_p1') {
  const project = source(), level = project.levels.find(level => level.identifier === identifier)!
  const uid = 99001
  project.defs.tilesets.push({ uid, identifier: 'CactiGrowSettlementMasterV1', relPath: '../public/assets/world/tiles/settlement-fixture-v01.png', tileGridSize: 128, pxWid: 1024, pxHei: 768 })
  level.layerInstances = level.layerInstances.filter(layer => !['Tiles', 'AutoLayer'].includes(layer.__type))
  const layers: AuthoredLayer[] = LAYER_NAMES.map(name => ({
    __identifier: `Settlement${name}`, __type: 'Tiles', __gridSize: 16, __cWid: level.pxWid / 16, __cHei: level.pxHei / 16,
    __pxTotalOffsetX: 0, __pxTotalOffsetY: 0, __tilesetDefUid: uid, entityInstances: [],
    gridTiles: [{ px: [32, 32], src: [0, 0], f: 0 }, { px: [48, 32], src: [128, 0], f: 3 }],
  }))
  level.layerInstances.unshift(...layers)
  return { project, level, layers, tileset: project.defs.tilesets.at(-1)! }
}

test('six prefixed settlement layers transform visual cells and square props without creating authority', () => {
  for (const identifier of ['Player_Farm', 'Town_p1']) {
    const { project } = visualFixture(identifier), world = parseWorld(project), area = world.areas.find(area => area.identifier === identifier)!
    assert.deepEqual(area.visualLayers!.map(layer => layer.name), [...LAYER_NAMES])
    for (const candidate of world.areas) assert.equal(hash(authority(candidate)), RUNTIME_AUTHORITY[candidate.areaId], candidate.areaId)
    assert.deepEqual(area.collision, [], 'registered Farm/Town scene bodies remain the collision owner')
    const cell = topologyToRuntime(area, { x: 16, y: 16 }), position = topologyToRuntime(area, { x: 32, y: 32 })
    const ground = area.visualLayers!.find(layer => layer.name === 'Ground')!
    assert.equal(ground.cellWidth, cell.x); assert.equal(ground.cellHeight, cell.y)
    assert.deepEqual(ground.tiles[0], { ...position, sourceX: 0, sourceY: 0, flip: 0 })
    const paths = area.visualLayers!.find(layer => layer.name === 'Paths')!
    assert.equal(paths.tiles[0].blendEdges! & 2, 0, 'adjacent authored cells have no east shoulder despite fractional runtime scale')
    assert.equal(paths.tiles[1].blendEdges! & 8, 0, 'the same shared edge has no west shoulder')
    assert.equal(paths.tiles[0].blendEdges! & 8, 8, 'the exposed outside edge still blends into surrounding ground')
    assert.equal(paths.tiles[1].blendEdges! & 2, 2)
    const props = area.visualLayers!.find(layer => layer.name === 'Decorations')!
    for (const tile of props.tiles) { assert.equal(tile.width, 128); assert.equal(tile.height, 128) }
    assert.equal(props.tiles[0].x + 64, position.x + cell.x / 2)
    assert.equal(props.tiles[0].y + SETTLEMENT_PROP_FOOT, position.y + cell.y)
    assert.equal(props.tiles[1].flip, 3, 'square display registration preserves authored flips')
  }
})

test('separate settlement vegetation reuses unchanged desert art with its existing square baseline', () => {
  for (const identifier of ['Player_Farm', 'Town_p1']) {
    const { project, layers } = visualFixture(identifier)
    const desert = project.defs.tilesets.find(definition => definition.identifier === 'CactiGrowDesertMasterV1')!
    layers.at(-1)!.__identifier = 'SettlementVegetation'
    layers.at(-1)!.__tilesetDefUid = desert.uid
    const area = parseWorld(project).areas.find(area => area.identifier === identifier)!
    const vegetation = area.visualLayers!.find(layer => layer.tileset.uid === desert.uid)!
    assert.equal(vegetation.name, 'Decorations')
    const position = topologyToRuntime(area, { x: 32, y: 32 }), cell = topologyToRuntime(area, { x: 16, y: 16 })
    assert.equal(vegetation.tiles[0].width, 128); assert.equal(vegetation.tiles[0].height, 128)
    assert.equal(vegetation.tiles[0].x + 64, position.x + cell.x / 2)
    assert.equal(vegetation.tiles[0].y + 128, position.y + cell.y)
    assert.equal(hash(authority(area)), RUNTIME_AUTHORITY[area.areaId])
  }
})

test('settlement importer rejects unsupported layers, asset paths, bounds, sizes and flips', () => {
  const mutations: ((fixture: ReturnType<typeof visualFixture>) => void)[] = [
    ({ layers }) => { layers[0].__identifier = 'SettlementRoof' },
    ({ layers }) => { layers[0].__type = 'AutoLayer' },
    ({ layers }) => { layers[0].__tilesetDefUid = 99002 },
    ({ tileset }) => { tileset.relPath = 'https://example.invalid/world.png' },
    ({ tileset }) => { tileset.relPath = '../public/assets/../../private.png' },
    ({ tileset }) => { tileset.tileGridSize = 0 },
    ({ layers }) => { layers[0].__gridSize = 0 },
    ({ layers, level }) => { layers[0].gridTiles[0].px = [level.pxWid, 32] },
    ({ layers }) => { layers[0].gridTiles[0].px = [-16, 32] },
    ({ layers }) => { layers[0].gridTiles[0].src = [1024, 0] },
    ({ layers }) => { layers[0].gridTiles[0].src = [0, 768] },
    ({ layers }) => { layers[0].gridTiles[0].f = 4 },
    ({ layers }) => { layers[0].gridTiles[0].f = 0.5 },
  ]
  for (const [index, mutate] of mutations.entries()) { const fixture = visualFixture(); mutate(fixture); assert.throws(() => parseWorld(fixture.project), `invalid visual mutation ${index}`) }
  assert.throws(() => parseWorld(visualFixture('Path_2').project), 'settlement prefixes cannot expand wilderness visual authoring')
})

test('actual Farm and Town settlement layers cover ground and retain aspect-correct decorative art', () => {
  const project = source(), world = parseWorld(project)
  for (const identifier of ['Player_Farm', 'Town_p1']) {
    const level = project.levels.find(level => level.identifier === identifier)!, area = world.areas.find(area => area.identifier === identifier)!
    const authored = level.layerInstances.filter(layer => layer.__identifier.startsWith('Settlement'))
    assert.equal(authored.length, 7)
    assert.deepEqual(new Set(authored.map(layer => layer.__identifier)), new Set([...LAYER_NAMES.map(name => `Settlement${name}`), 'SettlementVegetation']))
    assert.deepEqual(new Set(area.visualLayers?.map(layer => layer.name)), new Set(LAYER_NAMES))
    assert.equal(area.visualLayers!.length, 7)
    const vegetation = authored.find(layer => layer.__identifier === 'SettlementVegetation')!
    const desert = project.defs.tilesets.find(definition => definition.identifier === 'CactiGrowDesertMasterV1')!
    assert.equal(vegetation.__tilesetDefUid, desert.uid, 'extra vegetation reuses the accepted desert master')
    assert.equal(area.visualLayers!.filter(layer => layer.tileset.uid === desert.uid).length, 1)
    for (const layer of area.visualLayers!) {
      assert.ok(layer.tiles.length > 0, `${identifier}/${layer.name}: authored content`)
      const tileset = project.defs.tilesets.find(definition => definition.uid === layer.tileset.uid)!
      if (tileset.identifier !== 'CactiGrowSettlementMasterV1') {
        assert.equal(tileset.identifier, 'CactiGrowDesertMasterV1')
        assert.equal(layer.name, 'Decorations', 'accepted desert art is permitted only for the extra vegetation layer')
        assert.equal(layer.tileset.uid, vegetation.__tilesetDefUid)
      }
      assert.ok(readFileSync(`public${layer.tileset.path}`).byteLength > 0, 'bundled runtime atlas exists')
      if (layer.name === 'Ground') {
        assert.equal(layer.tiles.length, layer.gridWidth * layer.gridHeight)
        assert.equal(new Set(layer.tiles.map(tile => `${tile.x}:${tile.y}`)).size, layer.tiles.length, 'full ground coverage has no duplicated cell')
      }
      if (layer.name === 'Decorations') for (const tile of layer.tiles) { assert.equal(tile.width, 128); assert.equal(tile.height, 128) }
    }
    assert.ok(minimapSurfaces(area).some(surface => surface.layer === 'Paths'))
    assert.ok(minimapSurfaces(area).some(surface => surface.layer === 'StructureGrounding'))
    assert.equal(hash(authority(area)), RUNTIME_AUTHORITY[area.areaId])
  }
})

function surfaceLayer(name: WorldVisualLayer['name'], points: { x: number; y: number; width?: number; height?: number }[], offsetX = 7, offsetY = 11): WorldVisualLayer {
  return { name, tileset: { uid: 1, path: '/assets/world/tiles/test.png', tileSize: 128, width: 128, height: 128 }, gridWidth: 10, gridHeight: 10, cellWidth: 20, cellHeight: 30, offsetX, offsetY, tiles: points.map(point => ({ ...point, sourceX: 0, sourceY: 0, flip: 0 })) }
}

test('minimap surfaces derive transformed art, merge adjacent cells and preserve gaps and layer identity', () => {
  const area = structuredClone(WORLD.areas.find(area => area.areaId === 'town-p1')!)
  area.visualLayers = [
    surfaceLayer('Paths', [{ x: 60, y: 0 }, { x: 20, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 30 }]),
    surfaceLayer('GroundVariation', [{ x: 5, y: 7, width: 12, height: 8 }], 3, 4),
    surfaceLayer('StructureGrounding', [{ x: 0, y: 0 }]),
    ...(['Ground', 'Decorations', 'BoundaryEdges'] as const).map(name => surfaceLayer(name, [{ x: 99, y: 99 }])),
  ]
  const original = hash(area), surfaces = minimapSurfaces(area)
  assert.deepEqual(surfaces, [
    { layer: 'Paths', x: 7, y: 11, width: 40, height: 30 },
    { layer: 'Paths', x: 67, y: 11, width: 20, height: 30 },
    { layer: 'Paths', x: 7, y: 41, width: 20, height: 30 },
    { layer: 'GroundVariation', x: 8, y: 11, width: 12, height: 8 },
    { layer: 'StructureGrounding', x: 7, y: 11, width: 20, height: 30 },
  ])
  surfaces[0].x = -100
  assert.equal(hash(area), original, 'derivation and returned rectangles cannot mutate authored art or authority')
  assert.deepEqual(minimapSurfaces({ ...area, areaType: 'path' }), minimapSurfaces(area), 'First Basin rough Areas can opt into imported Paths')
  assert.deepEqual(minimapSurfaces({ ...area, areaType: 'path', visualLayers: area.visualLayers!.filter(layer => layer.name !== 'Paths') }), [], 'legacy rough Areas without Paths retain their original minimap')
  assert.deepEqual(minimapSurfaces({ ...area, visualLayers: undefined }), [])
})

test('visual minimap courtyards cannot make collision walkable or replace an existing valid route', () => {
  const area = structuredClone(WORLD.areas.find(area => area.areaId === 'town-p1')!)
  area.width = 1000; area.height = 700
  area.visualLayers = [surfaceLayer('Paths', [{ x: 0, y: 0, width: 1000, height: 700 }], 0, 0)]
  const navigation = new NavigationController(new NavigationMap(area.width, area.height, [{ x: 500, y: 350, width: 80, height: 700 }]))
  const player = { x: 100, y: 100 }, store = new LocalMinimapStore()
  let calls = 0
  store.publish({ area, blocked: navigation.map.obstacles, player }, point => { calls++; return walkMinimap(navigation, player, point) })
  assert.equal(minimapSurfaces(area).length, 1)
  assert.equal(calls, 0, 'visual derivation never invokes movement')
  assert.equal(store.walk({ x: 200, y: 200 }), true)
  const route = navigation.path
  for (const point of [{ x: 500, y: 350 }, { x: 800, y: 200 }]) { assert.equal(store.walk(point), false); assert.equal(navigation.path, route) }
  area.visualLayers = []
  assert.deepEqual(minimapSurfaces(area), [])
  assert.equal(store.walk({ x: 500, y: 350 }), false, 'removing road art also leaves navigation unchanged')
  assert.equal(navigation.path, route)
  assert.equal(store.walk({ x: 200, y: 500 }), true, 'new valid map clicks still replace the existing route')
  assert.notEqual(navigation.path, route)
  assert.deepEqual(player, { x: 100, y: 100 }, 'minimap commands never teleport the player')
})
