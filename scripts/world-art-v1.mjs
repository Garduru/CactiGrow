import assert from 'node:assert/strict'
import { closeSync, ftruncateSync, openSync, readFileSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { parseWorld } from './world-import.ts'

// Author only visual LDtk data. Runtime still consumes the saved project, never
// this authoring recipe. Run explicitly with node --experimental-strip-types.
const path = 'world/cactigrow-world.ldtk'
const project = JSON.parse(readFileSync(path, 'utf8')), original = structuredClone(project)
const manifest = JSON.parse(readFileSync('world/desert-master-v01.json', 'utf8'))
const targetIds = ['Starting_Spawn_Tutorial_1', 'Path_1', 'Cross_Path_1']
let nextUid = project.nextUid
const allocate = () => nextUid++
const size = manifest.tileSize, columns = manifest.columns
let master = project.defs.tilesets.find(t => t.identifier === manifest.identifier)
if (!master) {
  master = { ...structuredClone(project.defs.tilesets[0]), uid: allocate(), identifier: manifest.identifier }
  project.defs.tilesets.push(master)
}
Object.assign(master, { relPath: `../public${manifest.runtimePath}`, pxWid: size * columns, pxHei: size * manifest.rows, tileGridSize: size, __cWid: columns, __cHei: manifest.rows, padding: 0, spacing: 0, tags: ['art-direction-v1', 'desert-master'], cachedPixelData: null,
  customData: [...Object.entries(manifest.ground).flatMap(([category, ids]) => ids.map(tileId => ({tileId, data: category}))), ...Array.from({length:16},(_,mask)=>({tileId:16+mask,data:`canyon-neighbors-${mask}`})), ...Object.entries({...manifest.props,...manifest.propVariations}).map(([data,tileId])=>({tileId,data}))] })
const tileTemplate = project.defs.layers.find(l => l.identifier === 'Ground')
let variation = project.defs.layers.find(l => l.identifier === 'GroundVariation')
if (!variation) { variation = { ...structuredClone(tileTemplate), identifier: 'GroundVariation', uid: allocate() }; project.defs.layers.splice(project.defs.layers.indexOf(tileTemplate),0,variation) }
for (const layer of project.defs.layers.filter(l => ['Ground','GroundVariation','Decorations'].includes(l.identifier))) Object.assign(layer, {tilesetDefUid:master.uid,doc:layer.identifier==='GroundVariation'?'Visual road surface with runtime feathered shoulders; no collision.':'Art Direction V1 visual only. Collision remains independently authored in IntGrid.'})
let boundary = project.defs.layers.find(l => l.identifier === 'BoundaryEdgesMaster')
if (!boundary) {
  boundary = { ...structuredClone(project.defs.layers.find(l=>l.identifier==='BoundaryEdges')), identifier:'BoundaryEdgesMaster', uid:allocate(), autoRuleGroups:[] }
  project.defs.layers.splice(1,0,boundary)
}
const previousRules = boundary.autoRuleGroups[0]?.rules
const ruleTemplate = project.defs.layers.find(l=>l.identifier==='BoundaryEdges').autoRuleGroups[0].rules[0]
const rules = Array.from({length:16},(_,mask)=>({...structuredClone(ruleTemplate),uid:previousRules?.[mask]?.uid??allocate(),size:3,pattern:[0,mask&1?1:-1,0,mask&8?1:-1,1,mask&2?1:-1,0,mask&4?1:-1,0],outOfBoundsValue:1,tileRectsIds:[[16+mask]]}))
Object.assign(boundary,{tilesetDefUid:master.uid,doc:'Connected canyon edges, outer/inner turns and ledges derived only from unchanged IntGrid. N/E/S/W bitmask, outside-Level neighbors blocked.',autoRuleGroups:[{...structuredClone(project.defs.layers.find(l=>l.identifier==='BoundaryEdges').autoRuleGroups[0]),uid:boundary.autoRuleGroups[0]?.uid??allocate(),name:'Connected canyon walls',rules}]})

const routes = {
  Starting_Spawn_Tutorial_1: [[[80,176],[304,176],[416,176],[544,144],[672,112]]],
  Path_1: [[[0,64],[96,104],[176,136],[512,136]]],
  Cross_Path_1: [[[0,88],[128,112],[256,112]],[[128,0],[128,256]]],
}
const props = {
  Starting_Spawn_Tutorial_1: [[64,64,34],[128,96,35],[192,64,32],[352,64,38],[512,64,37],[608,208,45],[544,240,46],[416,240,36],[256,256,34],[64,224,44],[96,256,37],[608,64,39]],
  Path_1: [[64,176,45],[96,208,35],[160,64,44],[256,32,37],[384,32,34],[416,208,46],[480,224,32],[352,224,38],[448,64,39]],
  Cross_Path_1: [[32,32,34],[192,32,46],[32,192,37],[192,192,38],[64,224,44]],
}
function segmentDistance(x,y,a,b) {
  const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)))
  return Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t)
}
function tile(x,y,t,grid) { return {px:[x,y],src:[t%columns*size,Math.floor(t/columns)*size],f:0,t,d:[Math.floor(x/grid)+Math.floor(y/grid)*(project.levels.find(l=>l.identifier===currentId).pxWid/grid)],a:1} }
let currentId
for (const level of project.levels.filter(l=>targetIds.includes(l.identifier))) {
  currentId=level.identifier
  const oldBoundary=level.layerInstances.find(l=>['BoundaryEdges','BoundaryEdgesMaster'].includes(l.__identifier))
  const collision=level.layerInstances.find(l=>l.__type==='IntGrid')
  const grid=collision.__gridSize,cw=collision.__cWid,ch=collision.__cHei,csv=collision.intGridCsv
  const blocked=(x,y)=>x<0||y<0||x>=cw||y>=ch||csv[y*cw+x]===1
  Object.assign(oldBoundary,{__identifier:boundary.identifier,__tilesetDefUid:master.uid,__tilesetRelPath:master.relPath,layerDefUid:boundary.uid,overrideTilesetUid:null,autoLayerTiles:csv.flatMap((v,i)=>{
    if(v!==1)return[]
    const x=i%cw,y=Math.floor(i/cw),mask=Number(blocked(x,y-1))|Number(blocked(x+1,y))*2|Number(blocked(x,y+1))*4|Number(blocked(x-1,y))*8
    return [{...tile(x*grid,y*grid,16+mask,grid),d:[rules[mask].uid,x,y]}]
  })})
  for (const name of ['Ground','GroundVariation','Decorations']) {
    const definition=project.defs.layers.find(l=>l.identifier===name),cell=definition.gridSize
    let layer=level.layerInstances.find(l=>l.__identifier===name)
    if(!layer) { layer={...structuredClone(level.layerInstances.find(l=>l.__identifier==='Ground')),iid:randomUUID(),__identifier:name,layerDefUid:definition.uid};level.layerInstances.push(layer) }
    const tiles=[]
    if(name==='Decorations') {
      for(const [x,y,id] of props[currentId]) tiles.push(tile(x,y,id,cell))
    } else for(let y=0;y<level.pxHei;y+=cell)for(let x=0;x<level.pxWid;x+=cell) {
      const variationIndex=((x/cell)*7+(y/cell)*11+((x/cell)*(y/cell))%3)%4
      if(name==='Ground') tiles.push(tile(x,y,variationIndex,cell))
      else {
        const distance=Math.min(...routes[currentId].flatMap(r=>r.slice(1).map((p,i)=>segmentDistance(x+cell/2,y+cell/2,r[i],p))))
        if(distance<=(currentId==='Cross_Path_1'?34:30)) tiles.push(tile(x,y,8+variationIndex,cell))
      }
    }
    Object.assign(layer,{__type:'Tiles',__cWid:level.pxWid/cell,__cHei:level.pxHei/cell,__gridSize:cell,__tilesetDefUid:master.uid,__tilesetRelPath:master.relPath,layerDefUid:definition.uid,gridTiles:tiles,autoLayerTiles:[],overrideTilesetUid:null})
  }
  const order=['WorldEntities','BoundaryEdgesMaster','IntGrid','Decorations','GroundVariation','Ground']
  level.layerInstances.sort((a,b)=>order.indexOf(a.__identifier)-order.indexOf(b.__identifier))
}
project.nextUid=nextUid
const authority=p=>({...parseWorld(p),areas:parseWorld(p).areas.map(({visualLayers,...area})=>{void visualLayers;return area})})
assert.deepEqual(authority(project),authority(original),'Art authoring must preserve all runtime authority and geometry')
for(const level of original.levels.filter(l=>!targetIds.includes(l.identifier))) assert.deepEqual(project.levels.find(l=>l.identifier===level.identifier),level,'Areas outside the visual milestone remain identical')
// LDtk may keep a shared read handle open on Windows. Preserve that handle while
// replacing the validated bytes; no editor process or unsaved state is closed.
const bytes=Buffer.from(JSON.stringify(project,null,2)+'\n'),handle=openSync(path,'r+')
try { writeFileSync(handle,bytes);ftruncateSync(handle,bytes.length) } finally { closeSync(handle) }
console.log('Authored master terrain for Starting Spawn, Path 1 and Cross Path; all gameplay geometry and other Areas preserved.')
