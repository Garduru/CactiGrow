import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { parseWorld } from '../../scripts/world-import.ts'
import { WORLD } from './generatedWorld.ts'
import { NavigationMap } from '../../src/game-world/navigation/NavigationMap.ts'
import { minimapSurfaces } from '../../src/game-world/localMinimap.ts'
import { insideExit } from '../../src/game-world/AreaExitController.ts'
import { originalDefinition } from './explorationTestHelpers.ts'

const source=()=>JSON.parse(readFileSync('world/cactigrow-world.ldtk','utf8'))
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,x])=>[k,canonical(x)])):v
const hash=v=>createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex')
const TARGETS=['Cross_Path_1','Path_2','Path_3','Basin_Cave','Path_4','The_First_Basin','Path_5_Under_Construction']
const EXTENSION='/assets/world/tiles/world-first-basin-extension-v01.png'
// Captured from accepted Settlement Art V1 before this milestone; no ignored
// evidence files or generated expectations are needed to run these checks.
const BASELINE_LEVELS={
  Player_Farm:'fe02338063b1fb9c300af127f86efbc5a4b8db96873a2132ca077a043bc302ed',
  Path_1:'4e7dc1c3b307091d8d7d1b3eb720bc842b9ae4bf23e682dd9e9da151107ebeb1',
  Starting_Spawn_Tutorial_1:'7cfee965ad53c3b7e6f869c6f5fa11a019f5113b861053bf7a9cd928707f2854',
  Town_p1:'c839399a960e5ef92a6a4513b9e390be22cb8f55c7e7b5d388b41029b7df9137',
}
const BASELINE_DEFS={
  layers:{uids:[50,146,147,148,149,150,151,152,127,122,1,119,126,120],hash:'08229d3c7a643600ebea9f6d7e7d0d6c07b950a3dbed315236f7b4be0bef1c84'},
  entities:{uids:[13,39,43,103,107,114],hash:'7e46ba5fdc7316076bbad260e836cf703e4aa23890270ff033616211601abd79'},
  tilesets:{uids:[118,125,145],hash:'01a1aa97133525d88dcd8dc9356e47a32e891d2f59d9853ace0bdcb05bd74b20'},
  enums:{uids:[],hash:'4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945'},
  externalEnums:{uids:[],hash:'4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945'},
  levelFields:{uids:[32,33,34,35,36,37,38,51,52,53],hash:'4c0a173bec74c49fe7278b084d846d2f06ca9c6684ef9967ceda7c1019d7181a'},
}

test('First Basin preserves four complete accepted Levels and every existing definition',()=>{
  const project=source()
  for(const[name,baseline]of Object.entries(BASELINE_LEVELS))assert.equal(hash(project.levels.find(l=>l.identifier===name)),baseline,name)
  for(const[group,baseline]of Object.entries(BASELINE_DEFS)){
    const retained=project.defs[group].filter(d=>baseline.uids.includes(d.uid)).map(originalDefinition)
    assert.deepEqual(retained.map(d=>d.uid),baseline.uids,group)
    assert.equal(hash(retained),baseline.hash,group)
  }
})

test('seven saved environments have canonical floors, paths, walls and extension metadata',()=>{
  const project=source(),world=parseWorld(project)
  assert.deepEqual(world.areas,WORLD.areas)
  assert.deepEqual(world.areas.filter(a=>a.visualLayers?.some(l=>l.tileset.path===EXTENSION)).map(a=>a.identifier).sort(),TARGETS.toSorted())
  for(const area of world.areas.filter(a=>TARGETS.includes(a.identifier))){
    assert.ok(area.visualLayers.some(l=>l.name==='Ground'&&l.tiles.length))
    assert.ok(area.visualLayers.some(l=>l.name==='Paths'&&l.tiles.length))
    assert.ok(area.visualLayers.some(l=>l.name==='BoundaryEdges'&&l.tiles.length))
    assert.ok(area.visualLayers.every(l=>Number.isInteger(l.gridWidth)&&Number.isInteger(l.gridHeight)))
    for(const layer of area.visualLayers.filter(l=>l.tileset.path===EXTENSION))assert.deepEqual(layer.tileset,{uid:layer.tileset.uid,path:EXTENSION,tileSize:128,width:1024,height:512,inset:1})
    const paths=area.visualLayers.find(l=>l.name==='Paths')
    assert.ok(paths.tiles.every(t=>[t.blendEdges,t.blendCorners,t.roundCorners].every(m=>Number.isInteger(m)&&m>=0&&m<=15)))
    assert.ok(minimapSurfaces(area).some(s=>s.layer==='Paths'),'rough minimap reads imported paths')
  }
  const cave=world.areas.find(a=>a.identifier==='Basin_Cave')
  assert.ok(cave.visualLayers.every(l=>l.tileset.path===EXTENSION),'cave does not inherit outdoor terrain')
  assert.equal(cave.exits.length,1);assert.equal(cave.exits[0].targetAreaId,'path-3')
})

test('all existing wall cells and world rims are visible while full authored walkable exits stay clear',()=>{
  const project=source(),world=parseWorld(project)
  for(const identifier of TARGETS){
    const level=project.levels.find(l=>l.identifier===identifier),grid=level.layerInstances.find(l=>l.__type==='IntGrid'),area=world.areas.find(a=>a.identifier===identifier)
    const edges=area.visualLayers.find(l=>l.name==='BoundaryEdges'),map=new NavigationMap(area.width,area.height,area.collision)
    const covers=(x,y)=>edges.tiles.some(t=>x>=t.x&&x<t.x+(t.width??edges.cellWidth)&&y>=t.y&&y<t.y+(t.height??edges.cellHeight))
    for(let i=0;i<grid.intGridCsv.length;i++)if(grid.intGridCsv[i]===1)assert.ok(covers((i%grid.__cWid+.5)*80,(Math.floor(i/grid.__cWid)+.5)*80),identifier)
    for(const exit of area.exits.filter(e=>!e.blocked))for(let x=exit.x-exit.width/2+32;x<exit.x+exit.width/2;x+=16)for(let y=exit.y-exit.height/2+32;y<exit.y+exit.height/2;y+=16)if(map.walkable({x,y}))assert.equal(covers(x,y),false,`${identifier}/${exit.exitId}`)
    for(let x=40;x<area.width;x+=80)for(const y of[1,area.height-1])if(!area.exits.some(e=>!e.blocked&&insideExit({x,y},e)))assert.ok(covers(x,y),`${identifier} horizontal rim`)
    for(let y=40;y<area.height;y+=80)for(const x of[1,area.width-1])if(!area.exits.some(e=>!e.blocked&&insideExit({x,y},e)))assert.ok(covers(x,y),`${identifier} vertical rim`)
  }
})

test('cave and canyon connected masks are recalculated from IntGrid, ignoring cached artwork',()=>{
  const project=source(),world=parseWorld(project)
  for(const identifier of TARGETS.filter(n=>n!=='Cross_Path_1')){
    const level=project.levels.find(l=>l.identifier===identifier),grid=level.layerInstances.find(l=>l.__type==='IntGrid'),boundary=level.layerInstances.find(l=>l.__type==='AutoLayer')
    boundary.autoLayerTiles=[]
    const parsed=parseWorld(project).areas.find(a=>a.identifier===identifier)
    assert.deepEqual(parsed.visualLayers.find(l=>l.name==='BoundaryEdges'),world.areas.find(a=>a.identifier===identifier).visualLayers.find(l=>l.name==='BoundaryEdges'))
    const i=grid.intGridCsv.findIndex((v,i)=>v===0&&i%grid.__cWid>1&&Math.floor(i/grid.__cWid)>1)
    grid.intGridCsv[i]=1
    const updated=parseWorld(project).areas.find(a=>a.identifier===identifier),edges=updated.visualLayers.find(l=>l.name==='BoundaryEdges'),tile=edges.tiles.find(t=>t.x===i%grid.__cWid*80&&t.y===Math.floor(i/grid.__cWid)*80)
    assert.ok(tile,identifier)
    const id=tile.sourceY/128*8+tile.sourceX/128
    assert.ok(id>=(identifier==='Basin_Cave'?8:16)&&id<(identifier==='Basin_Cave'?24:32))
    grid.intGridCsv[i]=0
  }
})

test('extension props preserve painted proportions and foot registration without gameplay geometry',()=>{
  const project=source(),world=parseWorld(project),set=project.defs.tilesets.find(s=>s.identifier==='CactiGrowFirstBasinExtensionV1')
  for(const area of world.areas.filter(a=>TARGETS.includes(a.identifier))){
    const level=project.levels.find(l=>l.identifier===area.identifier),authored=level.layerInstances.find(l=>l.__identifier==='BasinDecorations'),decor=area.visualLayers.find(l=>l.name==='Decorations'&&l.tileset.path===EXTENSION)
    for(const[tileIndex,tile]of decor.tiles.entries()){
      const input=authored.gridTiles[tileIndex],id=tile.sourceY/128*8+tile.sourceX/128,registration=JSON.parse(set.customData.find(d=>d.tileId===id).data)
      assert.equal(tile.width,tile.height);assert.equal(tile.width,registration.displayWidth)
      assert.equal(tile.x+tile.width/2,(input.px[0]+8)*5)
      assert.equal(tile.y+(122-1)/126*tile.height,(input.px[1]+16)*5)
    }
    authored.gridTiles=[]
    const without=parseWorld(project).areas.find(a=>a.areaId===area.areaId)
    for(const key of['collision','spawns','exits','interactables'])assert.deepEqual(without[key],area[key],key)
  }
  set.customData.find(d=>d.tileId===30).data=JSON.stringify({displayWidth:10000,displayHeight:10000,footBaseline:122})
  const cross=project.levels.find(l=>l.identifier==='Cross_Path_1').layerInstances.find(l=>l.__identifier==='BasinDecorations')
  cross.gridTiles=[{px:[64,64],src:[768,384],f:0}]
  assert.throws(()=>parseWorld(project),/Invalid basin prop registration/)
  set.customData.find(d=>d.tileId===30).data=JSON.stringify({displayWidth:512,displayHeight:512,footBaseline:122})
  cross.gridTiles[0].px=[0,0]
  assert.throws(()=>parseWorld(project),/Basin prop display outside Area/)
})

test('Path5 blocked trigger retains its label, null target and barrier beyond approach',()=>{
  const area=parseWorld(source()).areas.find(a=>a.areaId==='path-5-under-construction'),exit=area.exits.find(e=>e.blocked)
  assert.equal(exit.futureDestinationLabel,'Route under construction.');assert.equal(exit.targetAreaId,null);assert.equal(exit.targetEntryId,null)
  assert.ok(area.visualLayers.find(l=>l.name==='BoundaryEdges').tiles.some(t=>t.x===560&&t.y===560&&t.width===160))
  assert.equal(WORLD.areas.length,11,'no later Areas invented')
})

test('Basin landmarks remain distinct saved visual groups with quiet space between them',()=>{
  const area=parseWorld(source()).areas.find(a=>a.areaId==='the-first-basin'),decor=area.visualLayers.find(l=>l.name==='Decorations'&&l.tileset.path===EXTENSION)
  const positions=id=>decor.tiles.filter(t=>t.sourceY/128*8+t.sourceX/128===id).map(t=>({x:t.x+t.width/2,y:t.y+(122-1)/126*t.height}))
  assert.equal(positions(28).length,1,'mesa pillar');assert.equal(positions(30).length,1,'central cairn');assert.equal(positions(29).length,4,'two distant groves');assert.equal(positions(24).length,2,'dry wash rubble')
  const grove=positions(29);assert.ok(Math.hypot(grove[0].x-grove[2].x,grove[0].y-grove[2].y)>3000)
  const variation=area.visualLayers.find(l=>l.name==='GroundVariation');assert.ok(variation.tiles.length>50,'broad ground region')
  assert.ok(decor.tiles.length<20,'open basin avoids repetitive props')
})

test('art extension and active presentation have bounded texture and object cost',()=>{
  const manifest=JSON.parse(readFileSync('world/first-basin-extension-v01.json','utf8')),png=readFileSync(`public${manifest.runtimePath}`),world=parseWorld(source())
  assert.equal(png.readUInt32BE(16)*png.readUInt32BE(20)*4,2097152)
  assert.equal(manifest.frames.length,32);assert.equal(new Set(manifest.frames.map(f=>f.tileId)).size,32)
  for(const area of world.areas.filter(a=>TARGETS.includes(a.identifier)))assert.ok(area.visualLayers.reduce((n,l)=>n+l.tiles.length,0)<6000,`${area.areaId}: bounded active-scene object count`)
})
