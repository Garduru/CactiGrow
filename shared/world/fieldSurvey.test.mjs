import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { parseWorld } from '../../scripts/world-import.ts'
import { NavigationMap } from '../../src/game-world/navigation/NavigationMap.ts'
import { NPC_PRESET_BY_ENTITY_ID } from '../characters/appearance.ts'
import { WORLD } from './generatedWorld.ts'

const TAG = 'first-basin-field-survey-v1'
const TOWN_IDS = ['town-rosa-steward', 'town-tomas-shopkeeper', 'town-inez-botanist', 'town-community-board']
const canonical = v => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, x]) => [k, canonical(x)])) : v

test('one survey stop preserves the accepted complete LDtk project after the exact named Town additions are removed', () => {
  const project = JSON.parse(readFileSync('world/cactigrow-world.ldtk', 'utf8'))
  const stations = project.levels.flatMap(l => l.layerInstances.flatMap(s => s.entityInstances)).filter(e => e.__tags.includes(TAG))
  assert.equal(stations.length, 1)
  assert.equal(stations[0].__identifier, 'TutorialNpc')
  assert.deepEqual(stations[0].fieldInstances.map(f => [f.__identifier, f.__value]), [['entityId', 'mara-basin-survey'], ['displayName', 'Mara'], ['tutorial', false]])
  assert.deepEqual(parseWorld(project).areas, WORLD.areas)
  for (const level of project.levels) for (const layer of level.layerInstances) layer.entityInstances = layer.entityInstances.filter(e => !e.__tags.includes(TAG) && !TOWN_IDS.includes(e.fieldInstances.find(f => f.__identifier === 'entityId')?.__value))
  project.defs.entities = project.defs.entities.filter(e => !['TownNpc', 'TownNoticeBoard'].includes(e.identifier))
  project.nextUid = 214 // Undo only the new Town definition UID bookkeeping.
  assert.equal(createHash('sha256').update(JSON.stringify(canonical(project))).digest('hex'), '4f06c84c2a4930164e29207425c35df1805e05fd8fd6ef0968b19a951c36553d', 'All prior definitions, eleven Levels, artwork, original entities, IntGrid, dimensions, spawns and exits remain exact.')
})

test('Mara uses accepted NPC-exclusive art at a reachable Cross Path stop away from exits', () => {
  const area = WORLD.areas.find(a => a.areaId === 'cross-path-1')
  const station = area.interactables.find(e => e.entityId === 'mara-basin-survey')
  assert.equal(NPC_PRESET_BY_ENTITY_ID[station.entityId], 'mara')
  assert.deepEqual([station.x, station.y, station.kind, station.tutorial], [720, 420, 'npc', false])
  const map = new NavigationMap(area.width, area.height, area.collision), approach = { x: station.x, y: station.y + 65 }
  assert.ok(map.walkable(station) && map.walkable(approach) && map.visible(approach, station))
  for (const spawn of area.spawns) assert.ok(map.route(spawn, approach), spawn.entryId)
  for (const exit of area.exits) assert.ok(Math.abs(station.x - exit.x) >= exit.width / 2 + 95 || Math.abs(station.y - exit.y) >= exit.height / 2 + 95)
  assert.equal(WORLD.areas.find(a => a.areaId === 'starting-spawn-tutorial').interactables.find(e => e.entityId === 'mara-guide').tutorial, true)
})

test('offline survey authoring reproduces saved bytes without changing the project', () => {
  const result = spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/field-survey-v1.mjs', '--all', '--check'], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
})
