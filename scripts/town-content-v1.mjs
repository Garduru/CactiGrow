import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { parseWorld } from './world-import.ts'
import { NavigationMap } from '../src/game-world/navigation/NavigationMap.ts'
import { TOWN_COLLIDERS } from '../shared/world/townGeometry.ts'

// Offline, additive authoring. The saved LDtk instances own the runtime stops.
assert.ok(process.argv.includes('--all'), 'Choose --all explicitly.')
const path = 'world/cactigrow-world.ldtk'
const project = JSON.parse(readFileSync(path, 'utf8')), before = structuredClone(project)
const tag = 'town-content-v1'
const stops = [
  { definition: 'TownNpc', id: 'town-rosa-steward', name: 'Rosa', x: 960, y: 1150, iid: '8f0e8217-413d-5c5d-a40c-7c7065382cb8' },
  { definition: 'TownNpc', id: 'town-tomas-shopkeeper', name: 'Tomas', x: 930, y: 625, iid: '24bf3ac5-8e31-5dbe-97ea-4ef00b47ff4d' },
  { definition: 'TownNpc', id: 'town-inez-botanist', name: 'Inez', x: 1570, y: 940, iid: 'ebf7b8c4-0c20-5d6a-b617-d060baf942bc' },
  { definition: 'TownNoticeBoard', id: 'town-community-board', name: 'Community notice board', x: 500, y: 795, iid: 'c3576f2b-87d4-5cb1-af37-26f1495069da', description: 'News from the Basin and the growers who gather here.' },
]
const town = project.levels.find(l => l.fieldInstances.some(f => f.__identifier === 'areaId' && f.__value === 'town-p1'))
assert.ok(town?.identifier === 'Town_p1')
const layer = town.layerInstances.find(l => l.__type === 'Entities')
const template = project.defs.entities.find(e => e.identifier === 'TutorialNpc')
const spawn = project.defs.entities.find(e => e.identifier === 'AreaSpawn')
const inspect = project.defs.entities.find(e => e.identifier === 'EnvironmentalInspectable')
for (const name of ['TownNpc', 'TownNoticeBoard']) {
  if (project.defs.entities.some(e => e.identifier === name)) continue
  const definition = structuredClone(template)
  definition.identifier = name; definition.uid = project.nextUid++; definition.tags = [tag]
  definition.doc = 'Town Content V1: optional presentation/service interaction. Explicit locked-template runtime coordinates; no collision.'
  definition.color = name === 'TownNpc' ? '#DDB46B' : '#83B49A'
  definition.fieldDefs.push(...structuredClone(spawn.fieldDefs.filter(f => ['runtimeX', 'runtimeY'].includes(f.identifier))))
  if (name === 'TownNoticeBoard') definition.fieldDefs.push(structuredClone(inspect.fieldDefs.find(f => f.identifier === 'description')))
  for (const field of definition.fieldDefs) {
    field.uid = project.nextUid++
    if (['runtimeX', 'runtimeY'].includes(field.identifier)) field.canBeNull = false
  }
  project.defs.entities.push(definition)
}
layer.entityInstances = layer.entityInstances.filter(e => !e.__tags.includes(tag))
for (const stop of stops) {
  const definition = project.defs.entities.find(e => e.identifier === stop.definition)
  const px = [Math.round(stop.x * town.pxWid / 2200), Math.round(stop.y * town.pxHei / 1500)]
  const values = { entityId: stop.id, displayName: stop.name, tutorial: false, runtimeX: stop.x, runtimeY: stop.y, description: stop.description }
  layer.entityInstances.push({ __identifier: definition.identifier, __grid: px.map(n => Math.floor(n / layer.__gridSize)), __pivot: [.5, .5],
    __smartColor: definition.color, __tags: [tag], __tile: null, defUid: definition.uid,
    fieldInstances: definition.fieldDefs.map(f => ({ __identifier: f.identifier, __value: values[f.identifier], __type: f.type.slice(2), defUid: f.uid,
      realEditorValues: [{ id: `V_${f.type.slice(2)}`, params: [values[f.identifier]] }] })),
    height: definition.height, iid: stop.iid, px, width: definition.width, __worldX: town.worldX + px[0], __worldY: town.worldY + px[1] })
}
const area = parseWorld(project).areas.find(a => a.areaId === 'town-p1')
const map = new NavigationMap(area.width, area.height, TOWN_COLLIDERS)
for (const stop of stops) {
  const point = { x: stop.x, y: stop.y }, approach = { x: stop.x, y: stop.y + 65 }
  assert.ok(map.walkable(point) && map.walkable(approach) && map.visible(approach, point), `${stop.id} has a clear interaction stop`)
  for (const entry of area.spawns) assert.ok(map.route(entry, approach), `${stop.id} reachable from ${entry.entryId}`)
  assert.ok(map.route({ x: 1100, y: 850 }, approach), `${stop.id} reachable from the open plaza`)
}
const withoutContent = value => {
  const copy = structuredClone(value)
  copy.defs.entities = copy.defs.entities.filter(e => !['TownNpc', 'TownNoticeBoard'].includes(e.identifier))
  copy.nextUid = before.nextUid
  for (const l of copy.levels) for (const s of l.layerInstances) s.entityInstances = s.entityInstances.filter(e => !e.__tags.includes(tag))
  return copy
}
assert.deepEqual(withoutContent(project), withoutContent(before), 'Only four Town entities and their definitions may change.')
const serialized = JSON.stringify(project, null, 2) + '\n'
if (process.argv.includes('--check')) assert.equal(readFileSync(path, 'utf8'), serialized, 'Saved Town content must reproduce exactly.')
else writeFileSync(path, serialized)
console.log('Authored three stationed NPCs and the existing Town board interaction. All prior world content and geometry preserved.')
