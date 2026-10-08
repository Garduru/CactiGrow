import assert from 'node:assert/strict'
import { closeSync, ftruncateSync, openSync, readFileSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { parseWorld } from './world-import.ts'

// Explicit authoring only; runtime consumes saved LDtk layers. Farm first, then Town.
const mode = process.argv.includes('--farm') ? 'farm' : process.argv.includes('--town') ? 'town' : process.argv.includes('--all') ? 'all' : null
assert.ok(mode, 'Choose --farm, --town or --all explicitly.')
const sourcePath = 'world/cactigrow-world.ldtk'
const project = JSON.parse(readFileSync(sourcePath, 'utf8')), original = structuredClone(project)
const manifest = JSON.parse(readFileSync('world/settlement-master-v01.json', 'utf8'))
assert.equal(manifest.identifier, 'CactiGrowSettlementMasterV1')
assert.equal(manifest.tileSize, 128); assert.equal(manifest.columns, 8); assert.equal(manifest.rows, 8)
const atlas = readFileSync(`public${manifest.runtimePath}`)
assert.equal(atlas.readUInt32BE(16), 1024); assert.equal(atlas.readUInt32BE(20), 1024)
const targets = mode === 'all' ? ['Player_Farm','Town_p1'] : mode === 'farm' ? ['Player_Farm'] : ['Town_p1']
const allocate = () => project.nextUid++
let master = project.defs.tilesets.find(t => t.identifier === manifest.identifier)
if (!master) {
  master = { ...structuredClone(project.defs.tilesets[0]), uid: allocate(), identifier: manifest.identifier }
  project.defs.tilesets.push(master)
}
Object.assign(master, { relPath:`../public${manifest.runtimePath}`, pxWid:1024, pxHei:1024, tileGridSize:128, __cWid:8, __cHei:8, padding:0, spacing:0, tags:['settlement-art-v1','visual-only'], cachedPixelData:null,
  customData:[...Object.entries(manifest.ground).flatMap(([name,ids])=>ids.map(tileId=>({tileId,data:name}))),...Object.entries({...manifest.edges,...manifest.props}).map(([data,tileId])=>({tileId,data}))] })
const desert = project.defs.tilesets.find(t => t.identifier === 'CactiGrowDesertMasterV1')
assert.ok(desert)
const names = ['Decorations','Vegetation','BoundaryEdges','StructureGrounding','Paths','GroundVariation','Ground']
const visualGrid = name => ['GroundVariation','Paths','StructureGrounding'].includes(name) ? 8 : 16
for (const name of names) {
  const identifier = `Settlement${name}`
  const existing = project.defs.layers.find(layer => layer.identifier === identifier)
  if (existing) { existing.gridSize=visualGrid(name); continue }
  const definition = { ...structuredClone(project.defs.layers.find(l=>l.identifier==='Ground')), uid:allocate(), identifier, gridSize:visualGrid(name),
    tilesetDefUid:name==='Vegetation'?desert.uid:master.uid,
    doc:`Settlement Art V1 ${name}. Visual only; registered Farm/Town bodies, entrances and runtime bounds remain authority.` }
  project.defs.layers.splice(1 + names.indexOf(name), 0, definition)
}
const ground = name => manifest.ground[name] ?? (name==='stone-paver' ? manifest.ground['warm-stone-paver'] : undefined)
for (const name of ['packed-earth','swept-dirt','cultivated-soil','stone-paver']) assert.equal(ground(name)?.length,4)
const prop = name => { const id=manifest.props[name]??manifest.edges[name]; assert.ok(Number.isInteger(id),`Missing ${name}`);return id }
const distance = (x,y,a,b) => {
  const dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy
  const t=den?Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/den)):0
  return Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t)
}
const routes = {
  Player_Farm:[[[1500,1900],[1500,1100],[1500,870]],[[1500,1050],[940,860],[650,580],[680,555]],[[1500,1050],[2060,850],[2390,630]],[[1500,1080],[1940,1200],[2060,1210],[2060,1425],[2420,1425]],[[1500,1650],[1260,1665],[1120,1665]]],
  Town_p1:[[[1100,1500],[1100,1140],[1100,850]],[[1100,850],[850,690],[650,560]],[[1100,850],[1320,700],[1510,590]],[[650,560],[1050,610],[1510,590]]],
}
const props = {
  Player_Farm:[['water-barrel',1000,495],['soil-bag-stack',1050,610],['pot-stack',925,555],['propagation-table',450,650],['seedling-tray',440,710],['wheelbarrow',1140,690],['hand-tool-bundle',1030,690],['compost-bin',2820,555],['watering-can',2020,525],['pot-stack',2780,650],['soil-sack',2740,1380],['closed-crate',2110,1500],['woven-basket',1210,990],['bench-horizontal',1150,900],['public-cactus-planter',1830,780],['lantern-post',1350,1620],['timber-gate-post',1365,1850],['timber-gate-post',1635,1850],['coiled-irrigation-hose',2050,675],['small-shade-canopy',440,1250]],
  Town_p1:[['water-barrel',350,540],['crate-stack',960,505],['pot-stack',415,650],['modest-cloth-awning',1810,660],['closed-crate',1890,540],['soil-sack',1930,615],['cactus-display-stand',1740,545],['botanical-noticeboard',500,795],['bench-horizontal',800,1080],['bench-horizontal',1410,1080],['public-water-trough',1790,1030],['public-cactus-planter',740,930],['public-cactus-planter',1460,955],['public-cactus-planter',1870,1230],['lantern-post',590,1030],['lantern-post',1640,1050],['stone-gate-post',965,1480],['stone-gate-post',1235,1480]],
}
const vegetation = {
  Player_Farm:[[250,330,37],[280,900,35],[2700,280,37],[2730,930,46],[340,1590,37],[2640,1610,35],[1050,300,34],[1980,330,37],[2750,1280,32],[420,1100,36],[1840,1450,34]],
  Town_p1:[[260,280,37],[1950,240,35],[260,1100,34],[1960,850,37],[360,1270,46],[1850,1390,34]],
}
const ellipse = (x,y,cx,cy,rx,ry) => ((x-cx)/rx)**2+((y-cy)/ry)**2 <= 1
for (const level of project.levels.filter(l=>targets.includes(l.identifier))) {
  const farm = level.identifier==='Player_Farm', fields=Object.fromEntries(level.fieldInstances.map(f=>[f.__identifier,f.__value]))
  const sx=fields.runtimeWidth/level.pxWid, sy=fields.runtimeHeight/level.pxHei, cell=16, cellW=cell*sx, cellH=cell*sy
  const tiles = Object.fromEntries(names.map(name=>[name,[]]))
  function tile(name,px,py,id,f=0) {
    const grid=visualGrid(name)
    assert.ok(px>=0&&py>=0&&px+grid<=level.pxWid&&py+grid<=level.pxHei,`${name} outside ${level.identifier}`)
    const columns=8, size=128
    tiles[name].push({px:[px,py],src:[id%columns*size,Math.floor(id/columns)*size],f,t:id,d:[Math.floor(px/grid)+Math.floor(py/grid)*(level.pxWid/grid)],a:1})
  }
  function anchored(name,x,y,id) { tile(name,Math.round((x-cellW/2)/sx),Math.round((y-cellH)/sy),id) }
  function edge(x,y,id) {
    const [left,top,right,bottom]=manifest.frames[id].alphaBounds, inset=manifest.samplingInset, sampled=manifest.tileSize-inset*2
    tile('BoundaryEdges',Math.round(x/sx-((left+right)/2-inset)/sampled*cell),Math.round(y/sy-((top+bottom)/2-inset)/sampled*cell),id)
  }
  for(const name of ['Ground','Paths','GroundVariation','StructureGrounding']) {
  const grid=visualGrid(name),cw=level.pxWid/grid,ch=level.pxHei/grid
  for(let row=0;row<ch;row++)for(let col=0;col<cw;col++) {
    const x=(col+.5)*grid*sx,y=(row+.5)*grid*sy, variant=(col*7+row*11+(col*row)%3)%4
    if(name==='Ground') {tile(name,col*grid,row*grid,ground(farm?'packed-earth':'swept-dirt')[variant]);continue}
    const nearest=Math.min(...routes[level.identifier].flatMap(r=>r.slice(1).map((p,i)=>distance(x,y,r[i],p))))
    // One quiet material per connected overlay avoids patchwork and bounds its cache.
    if(name==='Paths'&&nearest <= (farm?72:93)) tile(name,col*grid,row*grid,ground(farm?'swept-dirt':'packed-earth')[0])
    if(name==='GroundVariation'&&farm && (ellipse(x,y,650,560,385,170)||ellipse(x,y,2390,570,390,165))) tile(name,col*grid,row*grid,ground('cultivated-soil')[0])
    if(name==='GroundVariation'&&!farm && (ellipse(x,y,1790,1030,105,60)||ellipse(x,y,1870,1230,90,60))) tile(name,col*grid,row*grid,ground('packed-earth')[0])
    const thresholds=farm?[[1500,825,330,135],[680,535,320,120],[2390,610,390,140],[2420,1370,335,150],[1120,1660,260,100]]:[[650,545,410,155],[1510,560,620,165]]
    const nearFoundation=thresholds.some(([cx,cy,w,h])=>Math.abs(x-cx)<=w/2&&Math.abs(y-cy)<=h/2)
    const plaza=!farm&&ellipse(x,y,1100,850,340,215)
    if(name==='StructureGrounding'&&(nearFoundation||plaza))tile(name,col*grid,row*grid,ground('stone-paver')[0])
  }
  }
  const h=prop(farm?'timber-fence-H':'low-stone-H'),v=prop(farm?'timber-fence-V':'low-stone-V')
  const left=farm?90:68,right=farm?2910:2132,top=farm?90:58,bottom=farm?1810:1442
  const hBounds=manifest.frames[h].alphaBounds,vBounds=manifest.frames[v].alphaBounds,sampled=manifest.tileSize-manifest.samplingInset*2
  // Repeat the visible strip, with a small overlap, rather than its transparent slot.
  const stepH=Math.floor(cell*(hBounds[2]-hBounds[0]-2)/sampled)*sx,stepV=Math.floor(cell*(vBounds[3]-vBounds[1]-2)/sampled)*sy
  for(let x=left+stepH/2;x<right;x+=stepH) {
    edge(x,top,h)
    if(x<(farm?1320:885)||x>(farm?1680:1315)) edge(x,bottom,h)
  }
  for(let y=top+stepV/2;y<bottom;y+=stepV) {edge(left,y,v);edge(right,y,v)}
  for(const [name,x,y] of props[level.identifier])anchored('Decorations',x,y,prop(name))
  for(const [x,y,id] of vegetation[level.identifier])anchored('Vegetation',x,y,id)
  if(farm) {
    const irrigation=prop('irrigation-H'),bounds=manifest.frames[irrigation].alphaBounds,step=Math.floor(cell*(bounds[2]-bounds[0]-2)/sampled)*sx
    for(let x=2160;x<=2575;x+=step) edge(x,700,irrigation)
  }
  const template = original.levels.find(l=>l.identifier==='Cross_Path_1').layerInstances.find(l=>l.__identifier==='Ground')
  for(const name of names) {
    const identifier=`Settlement${name}`,definition=project.defs.layers.find(l=>l.identifier===identifier),set=name==='Vegetation'?desert:master
    let layer=level.layerInstances.find(l=>l.__identifier===identifier)
    if(!layer) {layer={...structuredClone(template),iid:randomUUID(),levelId:level.uid,__identifier:identifier};level.layerInstances.push(layer)}
    const grid=visualGrid(name)
    Object.assign(layer,{__type:'Tiles',__cWid:level.pxWid/grid,__cHei:level.pxHei/grid,__gridSize:grid,__tilesetDefUid:set.uid,__tilesetRelPath:set.relPath,layerDefUid:definition.uid,gridTiles:tiles[name],autoLayerTiles:[],overrideTilesetUid:null})
  }
  const order=['WorldEntities','IntGrid',...names.map(name=>`Settlement${name}`)]
  level.layerInstances.sort((a,b)=>order.indexOf(a.__identifier)-order.indexOf(b.__identifier))
}
const authority=p=>{const world=parseWorld(p);return{...world,areas:world.areas.map(({visualLayers,...area})=>{void visualLayers;return area})}}
assert.deepEqual(authority(project),authority(original),'Settlement art must preserve runtime authority')
for(const level of original.levels.filter(l=>!targets.includes(l.identifier))) assert.deepEqual(project.levels.find(l=>l.identifier===level.identifier),level,'Untargeted Level changed')
for(const level of original.levels)for(const layer of level.layerInstances.filter(l=>l.__type==='IntGrid'||l.__type==='Entities')) assert.deepEqual(project.levels.find(l=>l.identifier===level.identifier).layerInstances.find(l=>l.iid===layer.iid),layer,'Collision/entities changed')
for(const definition of original.defs.layers.filter(l=>!l.identifier.startsWith('Settlement')))assert.deepEqual(project.defs.layers.find(l=>l.uid===definition.uid),definition,'Existing layer definition changed')
const bytes=Buffer.from(JSON.stringify(project,null,2)+'\n'),handle=openSync(sourcePath,'r+')
try {writeFileSync(handle,bytes);ftruncateSync(handle,bytes.length)} finally {closeSync(handle)}
console.log(`Authored ${targets.join(', ')} settlement visuals. All runtime geometry/authority and untargeted Levels preserved.`)
