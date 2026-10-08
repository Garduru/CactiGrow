import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import type { WorldArea, WorldData, WorldPoint, WorldVisualLayer } from '../shared/world/types.ts'

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
        if (!['AreaSpawn', 'AreaExit', 'TutorialNpc', 'HarvestablePlant', 'TutorialPot'].includes(text(e.__identifier))) continue
        const ef = fields(e.fieldInstances), px = list(e.px)
        const authored = { x: number(px[0]) + number(layer.__pxTotalOffsetX), y: number(px[1]) + number(layer.__pxTotalOffsetY) }
        if (!lockedTemplate && (ef.runtimeX != null || ef.runtimeY != null)) throw new Error('Runtime entity overrides are reserved for locked Farm/Town templates.')
        const { x, y } = lockedTemplate ? { x: ef.runtimeX == null ? authored.x : number(ef.runtimeX), y: ef.runtimeY == null ? authored.y : number(ef.runtimeY) } : topologyToRuntime(area, authored)
        if ((ef.runtimeX == null) !== (ef.runtimeY == null) || x < 0 || y < 0 || x >= width || y >= height) throw new Error(`Invalid entity position in ${areaId}`)
        if (e.__identifier === 'AreaSpawn') area.spawns.push({ entryId: id(ef.entryId), x, y })
        else if (e.__identifier !== 'AreaExit') {
          if (lockedTemplate || typeof ef.tutorial !== 'boolean') throw new Error('Invalid tutorial interaction.')
          const kind = e.__identifier === 'TutorialNpc' ? 'npc' : e.__identifier === 'HarvestablePlant' ? 'harvestable' : 'tutorial-pot'
          const entity = { entityId: id(ef.entityId), kind, displayName: text(ef.displayName), tutorial: ef.tutorial, x, y } as NonNullable<WorldArea['interactables']>[number]
          if (kind === 'harvestable') {
            entity.speciesId = id(ef.speciesId); entity.seedYield = number(ef.seedYield)
            if (entity.seedYield < 1 || entity.seedYield > 10 || ef.respawn !== 'once-per-player') throw new Error('Invalid controlled harvest reward.')
            entity.respawn = 'once-per-player'
          }
          area.interactables ??= []; area.interactables.push(entity)
        } else {
          if (typeof ef.blocked !== 'boolean') throw new Error('Exit requires blocked boolean.')
          const size = lockedTemplate ? { x: number(ef.runtimeWidth), y: number(ef.runtimeHeight) } : topologyToRuntime(area, { x: number(e.width), y: number(e.height) })
          if (!lockedTemplate && (ef.runtimeWidth != null || ef.runtimeHeight != null)) throw new Error('Runtime trigger overrides are reserved for locked Farm/Town templates.')
          if (list(e.__pivot).some(v => v !== .5) || size.x <= 0 || size.y <= 0 || x - size.x / 2 < 0 || y - size.y / 2 < 0 || x + size.x / 2 > width || y + size.y / 2 > height) throw new Error(`Invalid exit trigger bounds in ${areaId}`)
          area.exits.push({ exitId: id(ef.exitId), x, y, width: size.x, height: size.y, blocked: ef.blocked, targetAreaId: null, targetEntryId: null, futureDestinationLabel: ef.futureDestinationLabel == null ? null : text(ef.futureDestinationLabel) })
        }
      }
      if (layer.__type === 'Tiles' || layer.__type === 'AutoLayer') {
        const authoredVisualName = text(layer.__identifier)
        const basin = !lockedTemplate && authoredVisualName.startsWith('Basin')
        const visualName = lockedTemplate ? authoredVisualName === 'SettlementVegetation' ? 'Decorations' : authoredVisualName.replace(/^Settlement/, '')
          : basin ? authoredVisualName === 'BasinGroundFine' ? 'Ground' : authoredVisualName === 'BasinVegetation' ? 'Decorations' : authoredVisualName.replace(/^Basin(?:Cave)?/, '') : authoredVisualName
        const allowed = lockedTemplate
          ? layer.__type === 'Tiles' && ['Ground','GroundVariation','Paths','StructureGrounding','Decorations','BoundaryEdges'].includes(visualName)
          : layer.__type === 'AutoLayer' ? ['BoundaryEdges','BoundaryEdgesMaster'].includes(visualName) : ['Ground','GroundVariation','Decorations', ...(basin ? ['Paths'] : [])].includes(visualName)
        if (!allowed) throw new Error('Unexpected visual layer.')
        const tileset = list(record(project.defs).tilesets).map(record).find(t => t.uid === layer.__tilesetDefUid)
        if (!tileset || typeof tileset.relPath !== 'string' || !/^\.\.\/public\/assets\/[a-z0-9/-]+\.png$/.test(tileset.relPath)) throw new Error('Tileset must reference a bundled world asset.')
        const tileSize = number(tileset.tileGridSize), grid = number(layer.__gridSize), textureWidth = number(tileset.pxWid), textureHeight = number(tileset.pxHei)
        if (grid < 1 || tileSize < 1) throw new Error('Invalid visual tile size.')
        const cell = topologyToRuntime(area, { x: grid, y: grid }), offset = topologyToRuntime(area, { x: number(layer.__pxTotalOffsetX), y: number(layer.__pxTotalOffsetY) })
        let authoredTiles = list(layer.gridTiles)
        if (layer.__type === 'AutoLayer') {
          const definition = list(record(project.defs).layers).map(record).find(d => d.uid === layer.layerDefUid)
          const source = list(l.layerInstances).map(record).find(s => s.layerDefUid === definition?.autoSourceLayerDefUid)
          const rules = list(definition?.autoRuleGroups).map(record).filter(g => g.active === true).flatMap(g => list(g.rules).map(record)).filter(r => r.active === true)
          // Re-evaluate these bounded LDtk rules from IntGrid. The editor's cached
          // artwork is never a second source of collision or blocked-edge truth.
          if (!source || source.__type !== 'IntGrid' || source.__gridSize !== grid || source.__cWid !== layer.__cWid || source.__cHei !== layer.__cHei || source.__pxTotalOffsetX !== layer.__pxTotalOffsetX || source.__pxTotalOffsetY !== layer.__pxTotalOffsetY) throw new Error('Invalid boundary source layer.')
          const columns = number(tileset.__cWid), cw = number(source.__cWid), ch = number(source.__cHei), csv = list(source.intGridCsv)
          if (csv.length !== cw * ch || csv.some(v => v !== 0 && v !== 1)) throw new Error('Invalid boundary source.')
          const connected = visualName === 'BoundaryEdgesMaster'
          if (rules.length !== (connected ? 16 : 1)) throw new Error('Unsupported boundary auto-rule count.')
          const ruleTiles = rules.map((rule, mask) => {
            const pattern = connected ? [0,mask&1?1:-1,0,mask&8?1:-1,1,mask&2?1:-1,0,mask&4?1:-1,0] : [1]
            if (rule.size !== (connected ? 3 : 1) || JSON.stringify(rule.pattern) !== JSON.stringify(pattern) || rule.chance !== 1 || rule.alpha !== 1 || rule.tileMode !== 'Single' || rule.perlinActive !== false || rule.checker !== 'None' || rule.xModulo !== 1 || rule.yModulo !== 1 || [rule.xOffset,rule.yOffset,rule.tileXOffset,rule.tileYOffset,rule.tileRandomXMin,rule.tileRandomXMax,rule.tileRandomYMin,rule.tileRandomYMax].some(v => v !== 0) || connected && (rule.outOfBoundsValue !== 1 || rule.flipX !== false || rule.flipY !== false)) throw new Error('Unsupported boundary auto-rule.')
            const choices = list(rule.tileRectsIds)
            if (choices.length !== 1 || list(choices[0]).length !== 1) throw new Error('Boundary rule requires one rock tile.')
            const tileId = number(list(choices[0])[0])
            if (tileId < 0) throw new Error('Invalid boundary tile.')
            return tileId
          })
          const blocked = (x: number,y: number) => x < 0 || y < 0 || x >= cw || y >= ch || csv[y*cw+x] === 1
          authoredTiles = csv.flatMap((v,i) => {
            if (v !== 1) return []
            const x = i % cw, y = Math.floor(i / cw), mask = connected ? Number(blocked(x,y-1)) | Number(blocked(x+1,y))*2 | Number(blocked(x,y+1))*4 | Number(blocked(x-1,y))*8 : 0, tileId = ruleTiles[mask]
            return [{px:[x*grid,y*grid],src:[tileId%columns*tileSize,Math.floor(tileId/columns)*tileSize],f:0}]
          })
        }
        const tiles = authoredTiles.map(record).map(t => {
          const px = list(t.px), src = list(t.src), position = topologyToRuntime(area, { x: number(px[0]), y: number(px[1]) }), sourceX = number(src[0]), sourceY = number(src[1]), flip = number(t.f)
          if (position.x < 0 || position.y < 0 || position.x + cell.x > width || position.y + cell.y > height || sourceX < 0 || sourceY < 0 || sourceX + tileSize > textureWidth || sourceY + tileSize > textureHeight || flip < 0 || flip > 3) throw new Error('Invalid visual tile bounds.')
          return { ...position, sourceX, sourceY, flip }
        })
        if (['GroundVariation','Paths','StructureGrounding'].includes(visualName)) {
          // Road shoulders follow the authored road tiles, independently from walls.
          // Compact settlement scales are fractional; compare integer authoring
          // coordinates so adjacent cells do not acquire rounding seams.
          const positions = lockedTemplate ? authoredTiles.map(record).map(t => ({ x: number(list(t.px)[0]), y: number(list(t.px)[1]) })) : tiles
          const occupied = new Set(positions.map(t => `${t.x}:${t.y}`))
          for (const [index, tile] of tiles.entries()) {
            const point = positions[index], stepX = lockedTemplate ? grid : cell.x, stepY = lockedTemplate ? grid : cell.y
            const has = (dx: number,dy: number) => occupied.has(`${point.x+dx*stepX}:${point.y+dy*stepY}`)
            const north=has(0,-1),east=has(1,0),south=has(0,1),west=has(-1,0)
            Object.assign(tile, {
              blendEdges: Number(!north) | Number(!east)*2 | Number(!south)*4 | Number(!west)*8,
              // At a concave road join the cardinal neighbors cover both edges,
              // but the missing diagonal needs the same shoulder fade at its tip.
              blendCorners: Number(north&&west&&!has(-1,-1)) | Number(north&&east&&!has(1,-1))*2 | Number(south&&east&&!has(1,1))*4 | Number(south&&west&&!has(-1,1))*8,
              ...(lockedTemplate || basin ? { roundCorners: Number(!north&&!west) | Number(!north&&!east)*2 | Number(!south&&!east)*4 | Number(!south&&!west)*8 } : {}),
            })
          }
        }
        const settlement = tileset.identifier === 'CactiGrowSettlementMasterV1'
        const extension = tileset.identifier === 'CactiGrowFirstBasinExtensionV1'
        if (basin && extension && visualName === 'Decorations') {
          const registrations = list(tileset.customData).map(record)
          for (const tile of tiles) {
            const tileId = tile.sourceY / tileSize * number(tileset.__cWid) + tile.sourceX / tileSize
            const entry = registrations.find(entry => entry.tileId === tileId)
            if (!entry || typeof entry.data !== 'string') throw new Error('Basin prop requires display registration.')
            const bounds = record(JSON.parse(entry.data)), displayWidth = number(bounds.displayWidth), displayHeight = number(bounds.displayHeight), foot = number(bounds.footBaseline)
            if (displayWidth < 32 || displayWidth > 512 || displayHeight !== displayWidth || foot < 1 || foot >= tileSize) throw new Error('Invalid basin prop registration.')
            Object.assign(tile, { x: tile.x + cell.x / 2 - displayWidth / 2, y: tile.y + cell.y - (foot - 1) / (tileSize - 2) * displayHeight, width: displayWidth, height: displayHeight })
            if (tile.x < 0 || tile.y < 0 || tile.x + displayWidth > width || tile.y + displayHeight > height) throw new Error('Basin prop display outside Area.')
          }
        }
        if (lockedTemplate && visualName === 'Decorations') {
          // Compact Farm/Town topology has different X/Y scales. Prop silhouettes
          // keep one 128-unit square while their authored ground anchors transform.
          // These display bounds never create collision or interaction geometry.
          // Settlement exports share source foot 122; the one-pixel atlas inset
          // crops to 126 pixels before display. Keep that foot at the LDtk anchor.
          const foot = settlement ? (122 - 1) / (128 - 2) * 128 : 128
          for (const tile of tiles) Object.assign(tile, { x: tile.x + cell.x / 2 - 64, y: tile.y + cell.y - foot, width: 128, height: 128 })
        }
        area.visualLayers ??= []; area.visualLayers.push({ name: (visualName === 'BoundaryEdgesMaster' ? 'BoundaryEdges' : visualName) as WorldVisualLayer['name'], tileset: { uid: number(tileset.uid), path: tileset.relPath.replace('../public',''), tileSize, width: textureWidth, height: textureHeight, ...(tileset.identifier === 'CactiGrowDesertMasterV1' || settlement || extension ? {inset:1} : {}) }, gridWidth: number(layer.__cWid), gridHeight: number(layer.__cHei), cellWidth: cell.x, cellHeight: cell.y, offsetX: offset.x, offsetY: offset.y, tiles })
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
    const boundary = area.visualLayers?.find(l => l.name === 'BoundaryEdges')
    if (boundary && !lockedTemplate) {
      const tiles = boundary.tiles, cell = {x:boundary.cellWidth,y:boundary.cellHeight}
      // Arcade world bounds also block movement. Show a narrow rock rim where the
      // IntGrid has no wall, reserving authored unblocked exit openings in full.
      const rock = tiles[0]
      if (!rock) throw new Error('Boundary layer requires collision rocks.')
      const rim = Math.min(27, cell.x, cell.y)
      const border: {x:number;y:number;width:number;height:number}[] = []
      for (let x = 0; x < width; x += cell.x) border.push({x,y:0,width:cell.x,height:rim},{x,y:height-rim,width:cell.x,height:rim})
      for (let y = 0; y < height; y += cell.y) border.push({x:0,y,width:rim,height:cell.y},{x:width-rim,y,width:rim,height:cell.y})
      for (const b of border) {
        if (area.exits.some(e => !e.blocked && b.x < e.x+e.width/2 && b.x+b.width > e.x-e.width/2 && b.y < e.y+e.height/2 && b.y+b.height > e.y-e.height/2)) continue
        if (tiles.some(t => b.x >= t.x && b.x+b.width <= t.x+(t.width ?? cell.x) && b.y >= t.y && b.y+b.height <= t.y+(t.height ?? cell.y))) continue
        tiles.push({...b,sourceX:rock.sourceX,sourceY:rock.sourceY,flip:0})
      }
      // Future-route barrier sits beyond its trigger so the existing message still
      // fires on approach. Placement follows the authored exit and its entrance.
      for (const e of area.exits.filter(e => e.blocked)) {
        const entrance = area.exits.find(x => !x.blocked)
        if (!entrance) continue
        const horizontal = e.width >= e.height, forward = horizontal ? e.y >= entrance.y : e.x >= entrance.x
        const b = horizontal ? {x:e.x-e.width/2,y:e.y+(forward ? e.height/2 : -e.height/2-cell.y),width:e.width,height:cell.y} : {x:e.x+(forward ? e.width/2 : -e.width/2-cell.x),y:e.y-e.height/2,width:cell.x,height:e.height}
        if (b.x < 0 || b.y < 0 || b.x+b.width > width || b.y+b.height > height) throw new Error('Future route barrier outside Area.')
        tiles.push({...b,sourceX:rock.sourceX,sourceY:rock.sourceY,flip:0})
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
    if (new Set(a.interactables?.map(e => e.entityId)).size !== (a.interactables?.length ?? 0)) throw new Error('Duplicate interaction ID.')
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
