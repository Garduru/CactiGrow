import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import type { WorldArea, WorldData, WorldPoint } from '../shared/world/types.ts'

/** One Level-local transform for authored entity positions and IntGrid rectangles. */
export function topologyToRuntime(area: Pick<WorldArea, 'width' | 'height' | 'topology'>, point: WorldPoint): WorldPoint {
  return { x: point.x * area.width / area.topology.width, y: point.y * area.height / area.topology.height }
}

type RecordValue = Record<string, unknown>
function record(v: unknown): RecordValue {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Expected LDtk object.')
  return v as RecordValue
}
function list(v: unknown): unknown[] { if (!Array.isArray(v)) throw new Error('Expected LDtk array.'); return v }
function text(v: unknown): string { if (typeof v !== 'string' || !v) throw new Error('Expected LDtk text.'); return v }
function number(v: unknown): number { if (typeof v !== 'number' || !Number.isSafeInteger(v)) throw new Error('Expected LDtk integer.'); return v }
function id(v: unknown): string { const s = text(v); if (!/^[a-z][a-z0-9-]{0,63}$/.test(s)) throw new Error(`Invalid stable ID: ${s}`); return s }
function fields(v: unknown): RecordValue {
  const out: RecordValue = {}
  for (const f of list(v).map(record)) { const key = text(f.__identifier); if (Object.hasOwn(out, key)) throw new Error(`Duplicate field ${key}`); out[key] = f.__value }
  return out
}
const kinds = ['tutorial', 'path', 'farm', 'town', 'wilderness', 'cave']
export function parseWorld(input: unknown, version = 'test'): WorldData {
  const project = record(input)
  if (project.externalLevels !== false) throw new Error('Embedded Levels required; save external Levels into the source project first.')
  const levels = list(project.levels).map(record)
  const zoneDefinition = list(record(project.defs).levelFields).map(record).find(f => f.identifier === 'zoneId')
  if (typeof zoneDefinition?.regex !== 'string' || !zoneDefinition.regex.startsWith('^') || !zoneDefinition.regex.endsWith('$')) throw new Error('zoneId requires an authored anchored validation pattern.')
  const validZone = new RegExp(zoneDefinition.regex)
  const zones = new Map<string, string>()
  if (!levels.length) throw new Error('World has no Areas.')
  const entities = new Map<string, { areaId: string; levelIid: string; layerIid: string; entity: RecordValue }>()
  const areas: WorldArea[] = levels.map(l => {
    const f = fields(l.fieldInstances), areaId = id(f.areaId), zoneId = id(f.zoneId)
    if (!validZone.test(zoneId)) throw new Error(`Invalid Zone ${zoneId}`)
    const zoneDisplayName = text(f.zoneDisplayName)
    if (zones.has(zoneId) && zones.get(zoneId) !== zoneDisplayName) throw new Error('Inconsistent Zone display name.')
    zones.set(zoneId, zoneDisplayName)
    if (!kinds.includes(text(f.areaType))) throw new Error('Invalid Area type.')
    const tw = number(l.pxWid), th = number(l.pxHei), width = number(f.runtimeWidth), height = number(f.runtimeHeight)
    if ([tw, th, width, height].some(n => n < 32 || n > 100000)) throw new Error('Invalid Area dimensions.')
    const lockedTemplate = f.areaType === 'farm' || f.areaType === 'town'
    if (!lockedTemplate && width * th !== height * tw) throw new Error('Runtime dimensions must preserve the authored aspect ratio.')
    const area: WorldArea = { areaId, identifier: text(l.identifier), zoneId, displayName: text(f.displayName), areaType: f.areaType as WorldArea['areaType'], width, height,
      topology: { x: number(l.worldX), y: number(l.worldY), width: tw, height: th }, travelDestinationId: f.travelDestinationId == null ? null : id(f.travelDestinationId), travelSpawnId: f.travelSpawnId == null ? null : id(f.travelSpawnId), travelDisplayName: f.travelDisplayName == null ? null : text(f.travelDisplayName), spawns: [], exits: [], collision: [] }
    for (const layer of list(l.layerInstances).map(record)) {
      for (const e of list(layer.entityInstances).map(record)) {
        const iid = text(e.iid)
        if (entities.has(iid)) throw new Error('Duplicate entity IID.')
        entities.set(iid, { areaId, levelIid: text(l.iid), layerIid: text(layer.iid), entity: e })
        if (!['AreaSpawn', 'AreaExit'].includes(text(e.__identifier))) continue
        const ef = fields(e.fieldInstances), px = list(e.px)
        const authored = { x: number(px[0]) + number(layer.__pxTotalOffsetX), y: number(px[1]) + number(layer.__pxTotalOffsetY) }
        if (!lockedTemplate && (ef.runtimeX != null || ef.runtimeY != null)) throw new Error('Runtime entity overrides are reserved for locked Farm/Town templates.')
        const { x, y } = lockedTemplate ? { x: ef.runtimeX == null ? authored.x : number(ef.runtimeX), y: ef.runtimeY == null ? authored.y : number(ef.runtimeY) } : topologyToRuntime(area, authored)
        if ((ef.runtimeX == null) !== (ef.runtimeY == null) || x < 0 || y < 0 || x >= width || y >= height) throw new Error(`Invalid entity position in ${areaId}`)
        if (e.__identifier === 'AreaSpawn') area.spawns.push({ entryId: id(ef.entryId), x, y })
        else {
          if (typeof ef.blocked !== 'boolean') throw new Error('Exit requires blocked boolean.')
          const size = lockedTemplate ? { x: number(ef.runtimeWidth), y: number(ef.runtimeHeight) } : topologyToRuntime(area, { x: number(e.width), y: number(e.height) })
          if (!lockedTemplate && (ef.runtimeWidth != null || ef.runtimeHeight != null)) throw new Error('Runtime trigger overrides are reserved for locked Farm/Town templates.')
          if (list(e.__pivot).some(v => v !== .5) || size.x <= 0 || size.y <= 0 || x - size.x / 2 < 0 || y - size.y / 2 < 0 || x + size.x / 2 > width || y + size.y / 2 > height) throw new Error(`Invalid exit trigger bounds in ${areaId}`)
          area.exits.push({ exitId: id(ef.exitId), x, y, width: size.x, height: size.y, blocked: ef.blocked, targetAreaId: null, targetEntryId: null, futureDestinationLabel: ef.futureDestinationLabel == null ? null : text(ef.futureDestinationLabel) })
        }
      }
      if (layer.__type === 'IntGrid') {
        const grid = number(layer.__gridSize), cw = number(layer.__cWid), ch = number(layer.__cHei), csv = list(layer.intGridCsv)
        if (grid <= 0 || csv.length !== cw * ch || csv.some(v => v !== 0 && v !== 1)) throw new Error('Invalid IntGrid.')
        // Compatibility templates keep their locked registered-body collision. Never rescale this outline.
        if (lockedTemplate) continue
        // Merge horizontal runs before feeding the existing visibility graph.
        for (let row = 0; row < ch; row++) for (let col = 0; col < cw; col++) {
          if (csv[row * cw + col] !== 1) continue
          const start = col
          while (col + 1 < cw && csv[row * cw + col + 1] === 1) col++
          const w = (col - start + 1) * grid
          const center = topologyToRuntime(area, { x: number(layer.__pxTotalOffsetX) + start * grid + w / 2, y: number(layer.__pxTotalOffsetY) + row * grid + grid / 2 })
          const size = topologyToRuntime(area, { x: w, y: grid })
          area.collision.push({ ...center, width: size.x, height: size.y })
        }
      }
    }
    return area
  })
  if (new Set(areas.map(a => a.areaId)).size !== areas.length) throw new Error('Duplicate Area ID.')
  const travel = areas.flatMap(a => a.travelDestinationId ? [a.travelDestinationId] : [])
  if (new Set(travel).size !== travel.length) throw new Error('Duplicate Travel destination ID.')
  for (const a of areas) {
    if (a.travelDestinationId ? !a.spawns.some(s => s.entryId === a.travelSpawnId) : a.travelSpawnId != null) throw new Error(`Invalid Travel spawn in ${a.areaId}`)
    if (new Set(a.spawns.map(s => s.entryId)).size !== a.spawns.length || !a.spawns.some(s => s.entryId === 'default')) throw new Error(`Duplicate/missing entries in ${a.areaId}`)
    if (new Set(a.exits.map(e => e.exitId)).size !== a.exits.length) throw new Error('Duplicate exit ID.')
    for (const exit of a.exits) {
      const source = [...entities.values()].find(e => e.areaId === a.areaId && e.entity.__identifier === 'AreaExit' && fields(e.entity.fieldInstances).exitId === exit.exitId)!
      const ref = fields(source.entity.fieldInstances).targetEntry
      if (ref == null) { if (!exit.blocked) throw new Error('Unblocked exit requires destination.'); continue }
      const r = record(ref), target = entities.get(text(r.entityIid))
      if (!target || target.entity.__identifier !== 'AreaSpawn' || r.levelIid !== target.levelIid || r.layerIid !== target.layerIid) throw new Error('Orphan/invalid exit destination.')
      exit.targetAreaId = target.areaId; exit.targetEntryId = id(fields(target.entity.fieldInstances).entryId)
    }
  }
  const path = areas.find(a => a.areaId === 'path-1'), cross = areas.find(a => a.areaId === 'cross-path-1')
  if (path?.zoneId !== 'starting-zone' || cross?.zoneId !== 'first-basin' || !path.exits.some(e => !e.blocked && e.targetAreaId === cross.areaId)) throw new Error('Missing Starting Zone → First Basin boundary.')
  for (const a of areas.filter(a => a.areaType === 'farm' || a.areaType === 'town')) if (a.zoneId !== 'first-basin') throw new Error('Farm/Town must belong to First Basin.')
  return { worldId: 'cactigrow-world', version, zones: [...zones].map(([zoneId, displayName]) => ({ zoneId, displayName })), areas }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const source = readFileSync('world/cactigrow-world.ldtk', 'utf8')
  const world = parseWorld(JSON.parse(source), createHash('sha256').update(source).digest('hex').slice(0, 16))
  if (process.argv.includes('--generate')) writeFileSync('shared/world/generatedWorld.ts', '// Generated from world/cactigrow-world.ldtk. Do not edit.\nimport type { WorldData } from \'./types.ts\'\nexport const WORLD: WorldData = ' + JSON.stringify(world) + '\n')
  console.log(`World ${world.version}: ${world.areas.length} Areas, ${world.areas.reduce((n,a) => n + a.exits.length, 0)} exits validated.`)
}
