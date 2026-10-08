import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { parseWorld } from '../../scripts/world-import.ts'
import { NavigationMap } from '../../src/game-world/navigation/NavigationMap.ts'
import { CHARACTER_MODULES } from '../../src/characters/characterArt.ts'
import { NPC_APPEARANCES, NPC_PRESET_BY_ENTITY_ID, isCharacterAppearance } from '../characters/appearance.ts'
import { TOWN_COLLIDERS, TOWN_LOCATION_LAYOUT } from './townGeometry.ts'
import { WORLD } from './generatedWorld.ts'

const TAG = 'town-content-v1'
const DEFINITIONS = ['TownNpc', 'TownNoticeBoard']
const STOPS = [
  ['town-rosa-steward', 'Rosa', 960, 1150, 'npc', 'rosa'],
  ['town-tomas-shopkeeper', 'Tomas', 930, 625, 'npc', 'tomas'],
  ['town-inez-botanist', 'Inez', 1570, 940, 'npc', 'inez'],
  ['town-community-board', 'Community notice board', 500, 795, 'inspectable'],
]
const IDS = STOPS.map(([id]) => id)
const source = () => JSON.parse(readFileSync('world/cactigrow-world.ldtk', 'utf8'))
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => [key, canonical(item)])) : value
const hash = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')
const field = (entity, name) => entity.fieldInstances.find(f => f.__identifier === name)
const entityId = entity => field(entity, 'entityId')?.__value
const town = project => project.levels.find(level => level.identifier === 'Town_p1')
const entityLayer = level => level.layerInstances.find(layer => layer.__type === 'Entities')
const stop = (project, id = IDS[0]) => entityLayer(town(project)).entityInstances.find(entity => entityId(entity) === id)

// Captured from accepted checkpoint 1efb2a051a8ca794d96908ab5b6726790d5696b0,
// before Town authoring. These expectations need neither Git nor ignored evidence.
const PROJECT_BASELINE = '68c5eb6b013003a97e022bfe7de10dbc44993a240b99af357ce39ea6a7f89915'
const RUNTIME_BASELINE = 'd39ec521e51edce369cb795aa5b342232cdd0fdb4027f5aec4d227a6677fd511'
const ORIGINAL_NEXT_UID = 214
function withoutContent(project) {
  const copy = structuredClone(project)
  copy.defs.entities = copy.defs.entities.filter(definition => !DEFINITIONS.includes(definition.identifier))
  copy.nextUid = ORIGINAL_NEXT_UID
  for (const level of copy.levels) for (const layer of level.layerInstances) {
    layer.entityInstances = layer.entityInstances.filter(entity => !IDS.includes(entityId(entity)))
  }
  return copy
}
function originalRuntime(world) {
  const { version, ...copy } = structuredClone(world)
  void version
  for (const area of copy.areas) if (area.interactables) {
    area.interactables = area.interactables.filter(entity => !IDS.includes(entity.entityId))
    if (!area.interactables.length) delete area.interactables
  }
  return copy
}

test('only four exact Town entities, two definitions and their UID bookkeeping are added to the complete accepted LDtk project', () => {
  const project = source()
  const definitions = project.defs.entities.filter(definition => DEFINITIONS.includes(definition.identifier))
  assert.deepEqual(definitions.map(definition => definition.identifier), DEFINITIONS)
  assert.deepEqual(definitions.flatMap(definition => [definition.uid, ...definition.fieldDefs.map(f => f.uid)]), Array.from({ length: 13 }, (_, i) => ORIGINAL_NEXT_UID + i))
  assert.equal(project.nextUid, 227)
  const instances = project.levels.flatMap(level => level.layerInstances.flatMap(layer => layer.entityInstances
    .filter(entity => entity.__tags.includes(TAG) || DEFINITIONS.includes(entity.__identifier) || IDS.includes(entityId(entity)))
    .map(entity => ({ level, layer, entity }))))
  assert.deepEqual(instances.map(({ entity }) => entityId(entity)), IDS)
  for (const { level, layer, entity } of instances) {
    assert.equal(level.identifier, 'Town_p1')
    assert.equal(layer.__type, 'Entities')
    assert.deepEqual(entity.__tags, [TAG])
    assert.equal(entity.__identifier, entityId(entity) === IDS[3] ? 'TownNoticeBoard' : 'TownNpc')
    assert.equal(field(entity, 'tutorial').__value, false)
  }
  assert.equal(hash(withoutContent(project)), PROJECT_BASELINE, 'Every prior project property, definition, Level, tile, IntGrid cell, entity, exit, spawn and topology field remains exact.')
})

test('parsed and generated worlds preserve all accepted runtime content and add precisely the four authored stops', () => {
  const parsed = parseWorld(source())
  assert.deepEqual(parsed.areas, WORLD.areas)
  assert.deepEqual(parsed.zones, WORLD.zones)
  for (const world of [parsed, WORLD]) {
    assert.equal(hash(originalRuntime(world)), RUNTIME_BASELINE, 'Whole-world identity, dimensions, collision, visuals, spawns, exits, Travel, exploration and Survey content remain exact.')
    const area = world.areas.find(candidate => candidate.areaId === 'town-p1')
    assert.deepEqual(area.interactables.map(entity => [entity.entityId, entity.displayName, entity.x, entity.y, entity.kind]), STOPS.map(entry => entry.slice(0, 5)))
    assert.deepEqual(area.collision, [], 'Town scene registration remains the collision owner.')
    for (const entity of area.interactables) {
      assert.equal(entity.tutorial, false)
      for (const key of ['noteId', 'speciesId', 'seedYield', 'rewardTable', 'harvestingXp', 'respawn']) assert.equal(entity[key], undefined, key)
    }
  }
})

test('mandatory Town runtime overrides bridge compact authoring coordinates without altering the topology footprint', () => {
  const project = source(), level = town(project), layer = entityLayer(level)
  assert.deepEqual([level.pxWid, level.pxHei, level.worldX, level.worldY], [432, 416, 512, -160])
  for (const [id, , x, y] of STOPS) {
    const entity = stop(project, id)
    assert.deepEqual(entity.px, [Math.round(x * 432 / 2200), Math.round(y * 416 / 1500)])
    assert.deepEqual(entity.__grid, entity.px.map(n => Math.floor(n / layer.__gridSize)))
    assert.deepEqual([field(entity, 'runtimeX').__value, field(entity, 'runtimeY').__value], [x, y])
  }
  for (const definition of project.defs.entities.filter(definition => DEFINITIONS.includes(definition.identifier))) {
    for (const key of ['runtimeX', 'runtimeY']) assert.equal(definition.fieldDefs.find(f => f.identifier === key).canBeNull, false)
  }
})

test('Town keeps the accepted ten bodies, sixteen navigation nodes and open plaza, door approaches and exit', () => {
  assert.deepEqual(TOWN_COLLIDERS, [
    { x: 1100, y: 58, width: 2080, height: 30 }, { x: 68, y: 750, width: 30, height: 1400 },
    { x: 2132, y: 750, width: 30, height: 1400 }, { x: 475, y: 1442, width: 820, height: 30 },
    { x: 1725, y: 1442, width: 820, height: 30 }, { x: 649, y: 336, width: 460, height: 261 },
    { x: 1511, y: 365, width: 666, height: 205 }, { x: 1510, y: 243, width: 312, height: 60 },
    { x: 965, y: 1420, width: 24, height: 118 }, { x: 1235, y: 1420, width: 24, height: 118 },
  ])
  const area = WORLD.areas.find(candidate => candidate.areaId === 'town-p1'), map = new NavigationMap(area.width, area.height, TOWN_COLLIDERS)
  assert.equal(map.nodes.length, 16)
  const plaza = { x: 1100, y: 850 }
  for (let x = 1015; x <= 1185; x += 17) assert.ok(map.walkable({ x, y: 1420 }), 'full formerly walkable gate corridor stays clear')
  for (const location of TOWN_LOCATION_LAYOUT) assert.ok(map.route(plaza, { x: location.approachX, y: location.approachY }), `${location.id} approach`)
  for (const [id, , x, y] of STOPS) {
    const point = { x, y }, approach = { x, y: y + 65 }
    assert.ok(map.walkable(point) && map.walkable(approach) && map.visible(approach, point), id)
    for (const entry of [...area.spawns, plaza]) assert.ok(map.route(entry, approach), `${id} reachable from ${entry.entryId ?? 'plaza'}`)
    for (const exit of area.exits) assert.ok(Math.abs(x - exit.x) >= exit.width / 2 + 95 || Math.abs(y - exit.y) >= exit.height / 2 + 95, `${id} leaves exit clear`)
  }
})

test('community board reuses the exact accepted settlement tile and has no exploration note or reward contract', () => {
  const area = WORLD.areas.find(candidate => candidate.areaId === 'town-p1')
  const tiles = area.visualLayers.flatMap(layer => layer.tiles.filter(tile => layer.tileset.path === '/assets/world/tiles/world-settlement-master-v01.png' && tile.sourceX === 384 && tile.sourceY === 768))
  assert.deepEqual(tiles, [{ x: 435.0740740740741, y: 670.3485958485959, sourceX: 384, sourceY: 768, flip: 0, width: 128, height: 128 }])
  const board = area.interactables.find(entity => entity.entityId === IDS[3])
  assert.equal(board.description, 'News from the Basin and the growers who gather here.')
  assert.equal(board.noteId, undefined)
})

test('Town entity types are rejected in every other Area even without runtime overrides', () => {
  for (const id of [IDS[0], IDS[3]]) for (const destination of source().levels.filter(level => level.identifier !== 'Town_p1')) {
    const project = source(), origin = entityLayer(town(project)), entity = stop(project, id)
    origin.entityInstances = origin.entityInstances.filter(candidate => candidate !== entity)
    entity.fieldInstances = entity.fieldInstances.filter(f => !['runtimeX', 'runtimeY'].includes(f.__identifier))
    entity.px = [32, 32]
    entityLayer(project.levels.find(level => level.identifier === destination.identifier)).entityInstances.push(entity)
    assert.throws(() => parseWorld(project), /Invalid authored Town content/, `${entity.__identifier} outside Town in ${destination.identifier}`)
  }
})

test('Town importer rejects missing, partial, invalid, spoofed and mismatched runtime contracts', () => {
  const mutations = [
    entity => { entity.fieldInstances = entity.fieldInstances.filter(f => !['runtimeX', 'runtimeY'].includes(f.__identifier)) },
    entity => { entity.fieldInstances = entity.fieldInstances.filter(f => f.__identifier !== 'runtimeX') },
    entity => { field(entity, 'runtimeX').__value = null },
    entity => { field(entity, 'runtimeY').__value = 625.5 },
    entity => { field(entity, 'runtimeX').__value = -1 },
    entity => { field(entity, 'runtimeX').__value = 2200 },
    entity => { field(entity, 'runtimeY').__value = 1500 },
    entity => { field(entity, 'runtimeX').__value = '960' },
    entity => { field(entity, 'tutorial').__value = true },
    entity => { field(entity, 'tutorial').__value = null },
    entity => { field(entity, 'entityId').__value = 'town-unapproved-npc' },
    entity => { field(entity, 'entityId').__value = IDS[3] },
  ]
  for (const [index, mutate] of mutations.entries()) {
    const project = source(); mutate(stop(project))
    assert.throws(() => parseWorld(project), `invalid Town contract ${index}`)
  }
  const board = source(); field(stop(board, IDS[3]), 'entityId').__value = IDS[0]
  assert.throws(() => parseWorld(board), /Invalid authored Town content/)
  const missingDescription = source(); field(stop(missingDescription, IDS[3]), 'description').__value = null
  assert.throws(() => parseWorld(missingDescription), /Expected LDtk text/)
  const wrongType = source(); field(town(wrongType), 'areaType').__value = 'farm'
  assert.throws(() => parseWorld(wrongType), /Invalid authored Town content/)
  const tutorialInTown = source(); stop(tutorialInTown).__identifier = 'TutorialNpc'
  assert.throws(() => parseWorld(tutorialInTown), /Invalid tutorial interaction/, 'original locked-template tutorial ban remains intact')
})

test('three NPC-exclusive presets use distinct additive stationary art that cannot be requested in player appearance', () => {
  const report = JSON.parse(readFileSync('art-source/characters/town-content-v01/export-report.json', 'utf8'))
  assert.equal(report.mode, 'stationary-four-direction-idle')
  assert.deepEqual(report.frameSize, [128, 224]); assert.deepEqual(report.atlasSize, [640, 896])
  const hashes = []
  for (const [id, name, , , , preset] of STOPS.slice(0, 3)) {
    assert.equal(NPC_PRESET_BY_ENTITY_ID[id], preset)
    assert.equal(NPC_APPEARANCES[preset].displayName, name)
    assert.equal(isCharacterAppearance({ ...NPC_APPEARANCES[preset].appearance, npcId: preset }), false)
    const entry = report.npcs[preset], atlas = readFileSync(`public${CHARACTER_MODULES[preset]}`)
    assert.equal(CHARACTER_MODULES[preset], entry.url)
    assert.equal(createHash('sha256').update(atlas).digest('hex'), entry.sha256)
    assert.equal(atlas.byteLength, entry.bytes)
    assert.equal(createHash('sha256').update(readFileSync(`art-source/characters/town-content-v01/${entry.source}`)).digest('hex'), entry.sourceSha256)
    assert.equal(entry.walkingAuthored, false)
    assert.equal(entry.uniqueIdleDirections, 4)
    assert.deepEqual(entry.frames.map(frame => frame.direction), ['south', 'west', 'east', 'north'])
    assert.equal(new Set(entry.frames.map(frame => frame.sha256)).size, 4)
    for (const frame of entry.frames) assert.ok(frame.alphaBounds[0] >= 0 && frame.alphaBounds[2] <= 128 && frame.alphaBounds[1] >= 0 && frame.alphaBounds[3] <= 216)
    hashes.push(entry.sha256)
  }
  assert.equal(new Set(hashes).size, 3)
  assert.equal(NPC_PRESET_BY_ENTITY_ID['mara-guide'], 'mara'); assert.equal(NPC_PRESET_BY_ENTITY_ID['mara-basin-survey'], 'mara')
  assert.equal(CHARACTER_MODULES.mara, '/assets/characters/npc/mara/desert-mara-poses-v03.webp')
})

test('offline Town authoring reproduces saved bytes and never rewrites existing visual or authority content', () => {
  const result = spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/town-content-v1.mjs', '--all', '--check'], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
})
