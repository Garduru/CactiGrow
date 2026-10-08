import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { parseWorld, topologyToRuntime } from './world-import.ts'
import { NavigationMap } from '../src/game-world/navigation/NavigationMap.ts'

// Offline authoring. The saved LDtk entity is the runtime source of the survey stop.
assert.ok(process.argv.includes('--all'), 'Choose --all explicitly.')
const path = 'world/cactigrow-world.ldtk'
const project = JSON.parse(readFileSync(path, 'utf8')), before = structuredClone(project)
const tag = 'first-basin-field-survey-v1', entityId = 'mara-basin-survey'
const level = project.levels.find(l => l.identifier === 'Cross_Path_1')
const layer = level.layerInstances.find(l => l.__type === 'Entities')
const template = project.levels.flatMap(l => l.layerInstances.flatMap(s => s.entityInstances)).find(e => e.fieldInstances.some(f => f.__identifier === 'entityId' && f.__value === 'mara-guide'))
assert.ok(template?.__identifier === 'TutorialNpc')
const npc = structuredClone(template)
Object.assign(npc, { iid: 'b7f09ad1-185e-50b2-aed9-5795be99ead2', __tags: [tag], px: [144, 84], __grid: [9, 5], __worldX: level.worldX + 144, __worldY: level.worldY + 84 })
for (const field of npc.fieldInstances) {
  if (field.__identifier === 'entityId') field.__value = entityId
  if (field.__identifier === 'tutorial') field.__value = false
  field.realEditorValues = [{ id: `V_${field.__type}`, params: [field.__value] }]
}
layer.entityInstances = layer.entityInstances.filter(e => !e.__tags.includes(tag))
layer.entityInstances.push(npc)
const world = parseWorld(project), area = world.areas.find(a => a.areaId === 'cross-path-1')
const map = new NavigationMap(area.width, area.height, area.collision)
const point = topologyToRuntime(area, { x: npc.px[0], y: npc.px[1] }), approach = { x: point.x, y: point.y + 65 }
assert.deepEqual(point, { x: 720, y: 420 })
assert.ok(map.walkable(point) && map.walkable(approach) && map.visible(approach, point))
for (const spawn of area.spawns) assert.ok(map.route(spawn, approach), `Survey stop reachable from ${spawn.entryId}`)
assert.ok(area.exits.every(e => Math.abs(point.x - e.x) >= e.width / 2 + 95 || Math.abs(point.y - e.y) >= e.height / 2 + 95))
const withoutStation = value => {
  const copy = structuredClone(value)
  for (const l of copy.levels) for (const s of l.layerInstances) s.entityInstances = s.entityInstances.filter(e => !e.__tags.includes(tag))
  return copy
}
assert.deepEqual(withoutStation(project), withoutStation(before), 'Only one authored survey stop may change; art, geometry and definitions remain exact.')
const serialized = JSON.stringify(project, null, 2) + '\n'
if (process.argv.includes('--check')) assert.equal(readFileSync(path, 'utf8'), serialized, 'Saved survey station must reproduce exactly.')
else writeFileSync(path, serialized)
console.log('Authored one Mara survey stop in Cross Path. Existing Levels, art, collision, exits and tutorial preserved.')
