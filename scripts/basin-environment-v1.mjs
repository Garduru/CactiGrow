import assert from 'node:assert/strict'
import { closeSync, ftruncateSync, openSync, readFileSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { parseWorld } from './world-import.ts'
import { NavigationMap } from '../src/game-world/navigation/NavigationMap.ts'

// Explicit offline authoring. Gameplay/runtime consumes the saved, editable LDtk
// project, never this recipe. This script does not author any gameplay geometry.
assert.ok(process.argv.includes('--all'), 'Choose --all explicitly.')
const sourcePath = 'world/cactigrow-world.ldtk'
const project = JSON.parse(readFileSync(sourcePath, 'utf8')), original = structuredClone(project)
const manifest = JSON.parse(readFileSync('world/first-basin-extension-v01.json', 'utf8'))
assert.equal(manifest.identifier, 'CactiGrowFirstBasinExtensionV1')
assert.equal(manifest.tileSize, 128); assert.equal(manifest.columns, 8); assert.equal(manifest.rows, 4)
const atlas = readFileSync(`public${manifest.runtimePath}`)
assert.equal(atlas.readUInt32BE(16), 1024); assert.equal(atlas.readUInt32BE(20), 512)
const targets = ['Cross_Path_1','Path_2','Path_3','Basin_Cave','Path_4','The_First_Basin','Path_5_Under_Construction']
const baselineWorld = parseWorld(original)
const allocate = () => project.nextUid++
let extension = project.defs.tilesets.find(t => t.identifier === manifest.identifier)
if (!extension) {
  extension = { ...structuredClone(project.defs.tilesets[0]), uid: allocate(), identifier: manifest.identifier }
  project.defs.tilesets.push(extension)
}
Object.assign(extension, { relPath:`../public${manifest.runtimePath}`, pxWid:1024, pxHei:512, tileGridSize:128, __cWid:8, __cHei:4, padding:0, spacing:0, tags:['first-basin-environment-v1','visual-only'], cachedPixelData:null,
  customData:[...Object.entries(manifest.ground).flatMap(([name,ids])=>ids.map(tileId=>({tileId,data:name}))),
    ...Array.from({length:16},(_,mask)=>({tileId:8+mask,data:`cave-neighbors-${mask}`})),
    ...Object.entries(manifest.props).map(([name,tileId])=>({tileId,data:JSON.stringify({name,...manifest.propRegistration[name]})}))] })
const desert = project.defs.tilesets.find(t => t.identifier === 'CactiGrowDesertMasterV1')
assert.ok(desert)
const tileTemplate = original.defs.layers.find(l=>l.identifier==='Ground')
const boundaryTemplate = original.defs.layers.find(l=>l.identifier==='BoundaryEdgesMaster')
const names = ['Decorations','Vegetation','BoundaryEdgesMaster','CaveBoundaryEdgesMaster','Paths','GroundVariation','GroundFine','Ground']
const visualGrid = name => ['GroundVariation','Paths'].includes(name) ? 8 : name === 'Ground' ? 32 : 16
for (const name of names) {
  const identifier = `Basin${name}`
  let definition = project.defs.layers.find(l=>l.identifier===identifier)
  if (definition) continue
  const caveBoundary = name === 'CaveBoundaryEdgesMaster', boundary = name.includes('BoundaryEdges')
  definition = { ...structuredClone(boundary ? boundaryTemplate : tileTemplate), uid:allocate(), identifier, gridSize:visualGrid(name),
    tilesetDefUid: caveBoundary || name === 'Decorations' ? extension.uid : desert.uid,
    doc:`First Basin Environment V1 ${name}. Visual only; unchanged IntGrid, entities and Level dimensions remain authority.` }
  if (boundary) {
    const group = structuredClone(boundaryTemplate.autoRuleGroups[0]); group.uid=allocate(); group.name=caveBoundary?'Connected cave walls':'Connected canyon walls'
    group.rules=group.rules.map((rule,mask)=>({...rule,uid:allocate(),tileRectsIds:[[(caveBoundary?8:16)+mask]]}))
    definition.autoRuleGroups=[group]
  }
  project.defs.layers.push(definition)
}
const distanceToSegment = (x,y,a,b) => {
  const dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy
  const t=den?Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/den)):0
  return Math.hypot(x-a.x-dx*t,y-a.y-dy*t)
}
const ellipse = (x,y,cx,cy,rx,ry) => ((x-cx)/rx)**2+((y-cy)/ry)**2 <= 1
// Five landmarks sit in existing terrain/openings: broad dry wash, cactus grove,
// cairn, stratified mesa shoulder, and the distant cactus/rubble ridge.
export const BASIN_LANDMARKS = [
  {name:'Entrance cactus grove',x:1060,y:1860,kind:'grove'},
  {name:'Stratified mesa shoulder',x:2440,y:1640,kind:'mesa'},
  {name:'Pale dry wash',x:3000,y:2380,kind:'wash'},
  {name:'Central trail cairn',x:3680,y:2140,kind:'cairn'},
  {name:'Eastern cactus ridge',x:4860,y:2500,kind:'ridge'},
]
const props = {
  Cross_Path_1:[['trail-cairn',870,770],['wild-cactus-cluster',260,950]],
  Path_2:[['trail-cairn',670,645],['loose-mineral-rubble',1810,945]],
  Path_3:[['trail-cairn',770,1580],['dry-root-debris',385,1550],['loose-mineral-rubble',880,1750]],
  Basin_Cave:[['loose-mineral-rubble',710,980],['dry-root-debris',1190,1240],['damp-floor-patch',1230,630],['weathered-mineral-rock',880,440]],
  Path_4:[['trail-cairn',1950,740],['dry-root-debris',1300,370],['rockslide-barrier-debris',2520,1120]],
  The_First_Basin:[['wild-cactus-cluster',1010,1840],['wild-cactus-cluster',1190,1845],['stratified-rock-pillar',2440,1640],['loose-mineral-rubble',2770,2490],['loose-mineral-rubble',3180,2560],['trail-cairn',3680,2140],['wild-cactus-cluster',4800,2520],['wild-cactus-cluster',5050,2540],['rockslide-barrier-debris',5030,2810]],
  Path_5_Under_Construction:[['rockslide-barrier-debris',610,615],['loose-mineral-rubble',800,670],['trail-cairn',840,380]],
}
const vegetation = {
  Cross_Path_1:[[360,170,39],[850,1060,47]],
  Path_2:[[590,615,34],[920,740,35],[1420,1000,37],[1820,900,34],[2140,595,39],[2300,350,46]],
  Path_3:[[650,720,34],[430,1080,38],[750,1230,37],[490,1680,34],[860,1930,39]],
  Path_4:[[650,740,34],[920,630,37],[1750,720,38],[2060,930,34],[2560,870,39]],
  The_First_Basin:[[760,2220,34],[1500,1860,37],[1780,2560,38],[2560,2200,34],[3300,2830,35],[3700,2520,38],[4020,1890,37],[4630,2440,34],[4870,1790,37],[5160,2320,35]],
  Path_5_Under_Construction:[[760,270,34]],
}
for (const level of project.levels.filter(l=>targets.includes(l.identifier))) {
  const area=baselineWorld.areas.find(a=>a.identifier===level.identifier), cave=area.areaType==='cave', cross=level.identifier==='Cross_Path_1', basin=level.identifier==='The_First_Basin'
  const map=new NavigationMap(area.width,area.height,area.collision), grid=level.layerInstances.find(l=>l.__type==='IntGrid'), cw=grid.__cWid,ch=grid.__cHei,csv=grid.intGridCsv
  const start=area.spawns.find(s=>s.entryId==='default'), accessible=new Set(), queue=[]
  for(const spawn of area.spawns) {const i=Math.floor(spawn.y/80)*cw+Math.floor(spawn.x/80); if(csv[i]===0&&!accessible.has(i)){accessible.add(i);queue.push(i)}}
  while(queue.length){const i=queue.pop(),x=i%cw,y=Math.floor(i/cw);for(const[nx,ny]of[[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){const n=ny*cw+nx;if(nx>=0&&ny>=0&&nx<cw&&ny<ch&&csv[n]===0&&!accessible.has(n)){accessible.add(n);queue.push(n)}}}
  const connected=(x,y)=>accessible.has(Math.floor(y/80)*cw+Math.floor(x/80))
  const routes=[]
  if(cross) routes.push([{x:0,y:440},{x:640,y:560},{x:1280,y:560}],[{x:640,y:0},{x:640,y:1280}])
  else if(basin) {
    for(const goal of [{x:1400,y:2060},{x:3000,y:2380},{x:3680,y:2140},{x:4860,y:2500}]){const route=map.route(start,goal);assert.ok(route,'Basin landmark approach must use existing navigation');routes.push([start,...route])}
    routes.push([{x:0,y:2000},start])
  } else for(const goal of [...area.spawns.filter(s=>s.entryId!=='default'),...area.exits]) {
    const route=map.route(start,goal);assert.ok(route,`${level.identifier}/${goal.entryId??goal.exitId} route unavailable`);routes.push([start,...route])
    if(goal.exitId&&!goal.blocked) {
      const endpoint=goal.x<=120?{x:0,y:goal.y}:goal.x>=area.width-120?{x:area.width,y:goal.y}:goal.y<=120?{x:goal.x,y:0}:{x:goal.x,y:area.height}
      routes.push([goal,endpoint])
    }
  }
  const selectedNames=cross?['Decorations','Vegetation','Paths']:['Decorations',...(cave?[]:['Vegetation']),cave?'CaveBoundaryEdgesMaster':'BoundaryEdgesMaster','Paths','GroundVariation',level.pxWid%32||level.pxHei%32?'GroundFine':'Ground']
  // Keep all accepted Cross terrain/roads/rocks; Path5's obsolete visual boundary
  // is replaced atomically with the connected wall layer and a complete floor.
  level.layerInstances=level.layerInstances.filter(l=>!l.__identifier.startsWith('Basin') && (cross||!['Tiles','AutoLayer'].includes(l.__type)))
  for(const name of selectedNames) {
    const definition=project.defs.layers.find(l=>l.identifier===`Basin${name}`), cell=visualGrid(name), set=cave&&name!=='Vegetation'?extension:name==='Decorations'?extension:desert
    const previous=original.levels.find(l=>l.identifier===level.identifier).layerInstances.find(l=>l.__identifier===definition.identifier)
    const template=original.levels.find(l=>l.identifier==='Cross_Path_1').layerInstances.find(l=>l.__identifier==='Ground')
    const layer={...structuredClone(template),iid:previous?.iid??randomUUID(),levelId:level.uid,__identifier:definition.identifier,__type:name.includes('BoundaryEdges')?'AutoLayer':'Tiles',__cWid:level.pxWid/cell,__cHei:level.pxHei/cell,__gridSize:cell,__tilesetDefUid:set.uid,__tilesetRelPath:set.relPath,layerDefUid:definition.uid,overrideTilesetUid:set.uid===definition.tilesetDefUid?null:set.uid,gridTiles:[],autoLayerTiles:[]}
    function tile(x,y,id,f=0) {
      assert.ok(x>=0&&y>=0&&x+cell<=level.pxWid&&y+cell<=level.pxHei,`${name} outside ${level.identifier}`)
      return{px:[x,y],src:[id%8*128,Math.floor(id/8)*128],f,t:id,d:[Math.floor(x/cell)+Math.floor(y/cell)*layer.__cWid],a:1}
    }
    const anchor=(x,y,id)=>layer.gridTiles.push(tile(Math.round(x/5-cell/2),Math.round(y/5-cell),id))
    if(name.includes('BoundaryEdges')) {
      const blocked=(x,y)=>x<0||y<0||x>=cw||y>=ch||csv[y*cw+x]===1
      layer.autoLayerTiles=csv.flatMap((v,i)=>{if(v!==1)return[];const x=i%cw,y=Math.floor(i/cw),mask=Number(blocked(x,y-1))|Number(blocked(x+1,y))*2|Number(blocked(x,y+1))*4|Number(blocked(x-1,y))*8
        return[{...tile(x*16,y*16,(cave?8:16)+mask),d:[definition.autoRuleGroups[0].rules[mask].uid,x,y]}]})
    } else if(name==='Decorations') {
      for(const[key,requestedX,requestedY]of props[level.identifier]) {
        let x=requestedX,y=requestedY
        // Solid-looking tall rocks share existing physical wall ground. They
        // cannot manufacture a new obstacle on an otherwise walkable floor.
        if(['stratified-rock-pillar','weathered-mineral-rock','rockslide-barrier-debris'].includes(key)) {
          const cells=csv.flatMap((v,i)=>v===1?[{x:(i%cw+.5)*80,y:(Math.floor(i/cw)+.5)*80}]:[])
          const ground=cells.reduce((a,b)=>Math.hypot(a.x-x,a.y-y)<Math.hypot(b.x-x,b.y-y)?a:b);x=ground.x;y=ground.y
        }
        // Keep approach and exit/spawn visual envelopes quiet.
        if(area.exits.some(e=>!e.blocked&&Math.abs(x-e.x)<e.width/2+60&&Math.abs(y-e.y)<e.height/2+60))continue
        anchor(x,y,manifest.props[key])
      }
    } else if(name==='Vegetation') {
      for(const[x,y,id]of vegetation[level.identifier]??[]) if(connected(x,y)&&map.walkable({x,y})&& !area.exits.some(e=>Math.abs(x-e.x)<e.width/2+50&&Math.abs(y-e.y)<e.height/2+50)) anchor(x,y,id)
    } else {
      for(let y=0;y<level.pxHei;y+=cell)for(let x=0;x<level.pxWid;x+=cell) {
        const wx=(x+cell/2)*5,wy=(y+cell/2)*5,reachable=connected(wx,wy),variant=(x/cell*7+y/cell*11+(x/cell*y/cell)%3)%4
        if(name.startsWith('Ground')&&name!=='GroundVariation') {layer.gridTiles.push(tile(x,y,cave?(reachable?0:4)+variant:(reachable?0:12)+variant));continue}
        if(!reachable||!map.walkable({x:wx,y:wy}))continue
        const near=Math.min(...routes.flatMap(r=>r.slice(1).map((p,i)=>distanceToSegment(wx,wy,r[i],p))))
        if(name==='Paths'&&near<=(cross?65:level.identifier==='Path_2'?120:cave?75:basin?65:85))layer.gridTiles.push(tile(x,y,cave?4:cross?4:8))
        if(name==='GroundVariation') {
          const patch=basin?ellipse(wx,wy,3000,2380,1040,260)||ellipse(wx,wy,4860,2520,460,210):cave?ellipse(wx,wy,1230,630,420,240):level.identifier==='Path_4'?ellipse(wx,wy,1830,760,390,210):level.identifier==='Path_3'?ellipse(wx,wy,650,1500,280,500):ellipse(wx,wy,1450,980,490,190)
          if(patch&&near>100)layer.gridTiles.push(tile(x,y,cave?4:basin?0:12))
        }
      }
    }
    level.layerInstances.push(layer)
  }
  // Editor order follows existing conventions; runtime sorts canonical depths.
  const priority=l=>l.__type==='Entities'?0:l.__type==='IntGrid'?1:l.__type==='AutoLayer'?2:l.__identifier.includes('Decorations')||l.__identifier.includes('Vegetation')?3:l.__identifier.includes('Paths')?4:l.__identifier.includes('Variation')?5:6
  level.layerInstances.sort((a,b)=>priority(a)-priority(b))
}
const authority=p=>{const world=parseWorld(p);return{...world,areas:world.areas.map(({visualLayers,...area})=>{void visualLayers;return area})}}
assert.deepEqual(authority(project),authority(original),'Basin art must preserve all runtime authority')
for(const level of original.levels.filter(l=>!targets.includes(l.identifier)))assert.deepEqual(project.levels.find(l=>l.identifier===level.identifier),level,'Untargeted Level changed')
for(const level of original.levels)for(const layer of level.layerInstances.filter(l=>['IntGrid','Entities'].includes(l.__type)))assert.deepEqual(project.levels.find(l=>l.identifier===level.identifier).layerInstances.find(l=>l.iid===layer.iid),layer,'Collision/entities changed')
for(const[group,defs]of Object.entries(original.defs))if(Array.isArray(defs))for(const definition of defs)if(!String(definition.identifier).startsWith('Basin')&&definition.identifier!==manifest.identifier)assert.deepEqual(project.defs[group].find(l=>l.uid===definition.uid),definition,'Existing definition changed')
const bytes=Buffer.from(JSON.stringify(project,null,2)+'\n'),handle=openSync(sourcePath,'r+')
try{writeFileSync(handle,bytes);ftruncateSync(handle,bytes.length)}finally{closeSync(handle)}
console.log(`Authored ${targets.join(', ')}. All authority and four untargeted Levels preserved.`)
