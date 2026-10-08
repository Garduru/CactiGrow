import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { parseWorld, topologyToRuntime } from '../../scripts/world-import.ts'
import { NavigationMap } from '../../src/game-world/navigation/NavigationMap.ts'
import { WORLD } from './generatedWorld.ts'
import { EXPLORATION_TAG, originalDefinition, WILD_FIELD_NAMES } from './explorationTestHelpers.ts'

const source=()=>JSON.parse(readFileSync('world/cactigrow-world.ldtk','utf8'))
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,x])=>[k,canonical(x)])):v
const hash=v=>createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex')
const beforeLevels={
  Player_Farm:'fe02338063b1fb9c300af127f86efbc5a4b8db96873a2132ca077a043bc302ed',
  Cross_Path_1:'7a1385aec3459f79874ea3ece1c5a420ba6b157b04b20d807b512dacb95ee1e3',
  Path_1:'4e7dc1c3b307091d8d7d1b3eb720bc842b9ae4bf23e682dd9e9da151107ebeb1',
  Path_3:'f523f656f6e3755746d135ef00b8ca1cbc2a2d71f4fdbd0fd906693603215b49',
  Starting_Spawn_Tutorial_1:'7cfee965ad53c3b7e6f869c6f5fa11a019f5113b861053bf7a9cd928707f2854',
  Path_2:'e53256f4c13e85c89f14ee6f4605b56828158359d5d3057b77daeaceb74a820d',
  Town_p1:'c839399a960e5ef92a6a4513b9e390be22cb8f55c7e7b5d388b41029b7df9137',
  Basin_Cave:'a852b270e2e3061b782fbdeba79df1ce60abb65805d9f9ec6f41ff9f04091589',
  Path_4:'9f229990c3df9a9823b743cfe32b2d5e5abb13866029ea4cdcb0b3d663d6d029',
  Path_5_Under_Construction:'3f962212b0313f921d50844fba5e8798656037ec761d57d87e5dc9baa0d36883',
  The_First_Basin:'8c4fe34c1cac97e37d4dd30236310ddaca9885ba1a7bff73a99bcf01e925347e',
}
const NODE_IDS=['cross-wild-san-pedro','path-2-wild-san-pedro','path-2-wild-peyote','path-3-wild-san-pedro','path-3-wild-peyote','path-4-wild-san-pedro','path-4-wild-peyote','basin-san-pedro-entrance','basin-peyote-west','basin-san-pedro-wash','basin-peyote-south','basin-san-pedro-cairn','basin-peyote-ridge']
const LANDMARK_IDS=['entrance-grove','mesa-shoulder','dry-wash','cairn','eastern-ridge','seeping-stone']
const INSPECTION_IDS=['cross-trail-cairn','path-2-roadside-cairn','path-3-canyon-cairn','cave-mineral-seam','path-4-trail-cairn','basin-trail-cairn','path-5-route-marker']

test('exploration content is additive to every accepted Level and original entity field contract',()=>{
  const p=source()
  assert.equal(p.levels.length,11)
  for(const level of p.levels){
    const original=structuredClone(level)
    for(const layer of original.layerInstances)layer.entityInstances=layer.entityInstances.filter(e=>!e.__tags.includes(EXPLORATION_TAG)&&!e.__tags.includes('first-basin-field-survey-v1'))
    assert.equal(hash(original),beforeLevels[level.identifier],`${level.identifier}: art, IntGrid, topology, exits, entries and original entities`)
  }
  const harvest=p.defs.entities.find(d=>d.identifier==='HarvestablePlant')
  assert.deepEqual(harvest.fieldDefs.slice(6).map(f=>f.identifier),WILD_FIELD_NAMES)
  assert.ok(harvest.fieldDefs.slice(6).every(f=>f.canBeNull),'tutorial authoring does not require wild fields')
  assert.equal(hash(p.defs.entities.filter(d=>[13,39,43,103,107,114].includes(d.uid)).map(originalDefinition)),'7e46ba5fdc7316076bbad260e836cf703e4aa23890270ff033616211601abd79')
  assert.deepEqual(parseWorld(p).areas,WORLD.areas,'generated authority matches saved LDtk content')
})

test('modest wild population has supported normal commodities, bounded seed pods and personal cooldown rules',()=>{
  const world=parseWorld(source()),nodes=world.areas.flatMap(a=>a.interactables??[]).filter(e=>e.kind==='harvestable'&&!e.tutorial)
  assert.deepEqual(nodes.map(e=>e.entityId).sort(),NODE_IDS.toSorted())
  for(const node of nodes){
    assert.ok(['echinopsis-pachanoi','lophophora-williamsii'].includes(node.speciesId))
    assert.deepEqual([node.resourceType,node.rewardTable,node.minYield,node.maxYield,node.harvestingXp,node.respawn,node.requiredToolId,node.rareRollEligible],['seed-pod','commodity-seeds',3,10,10,'player-cooldown','field-knife',false])
    assert.ok([600,900,1200].includes(node.respawnSeconds)); assert.equal(node.seedYield,undefined)
  }
  assert.equal(world.areas.find(a=>a.areaId==='the-first-basin').interactables.filter(e=>e.kind==='harvestable').length,6,'Basin is the highest concentration')
  const basin=nodes.filter(e=>e.entityId.startsWith('basin-'))
  for(const a of basin)for(const b of basin)if(a!==b)assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>550,'open terrain between Basin plants')
  const tutorial=world.areas.find(a=>a.areaId==='starting-spawn-tutorial').interactables.find(e=>e.kind==='harvestable')
  assert.deepEqual(tutorial,{entityId:'first-san-pedro',kind:'harvestable',displayName:'Wild San Pedro',tutorial:true,x:1664,y:704,speciesId:'echinopsis-pachanoi',seedYield:3,respawn:'once-per-player'})
})

test('all wild and inspectable approaches are reachable from every actual entry through unchanged 27+5 navigation',()=>{
  const world=parseWorld(source())
  for(const area of world.areas){
    const nodes=area.interactables?.filter(e=>!e.tutorial)??[]
    if(!nodes.length)continue
    const map=new NavigationMap(area.width,area.height,area.collision)
    for(const node of nodes){
      const approach={x:node.x,y:node.y+65}
      assert.ok(map.walkable(node)&&map.walkable(approach)&&map.visible(approach,node),node.entityId)
      for(const spawn of area.spawns)assert.ok(map.route(spawn,approach),`${area.areaId}/${spawn.entryId}/${node.entityId}`)
      assert.ok(!area.exits.some(e=>Math.abs(node.x-e.x)<e.width/2+65&&Math.abs(node.y-e.y)<e.height/2+65),'content leaves exits quiet')
    }
  }
})

test('six broad discovery regions cover existing Basin landmarks and cave formation with reachable physical entry',()=>{
  const p=source(),world=parseWorld(p),landmarks=world.areas.flatMap(a=>a.landmarks??[])
  assert.deepEqual(landmarks.map(l=>l.landmarkId).sort(),LANDMARK_IDS.toSorted())
  assert.deepEqual(world.areas.find(a=>a.areaId==='the-first-basin').landmarks.map(l=>l.displayName),['Entrance Grove','Mesa Shoulder','Dry Wash','Cairn','Eastern Ridge'])
  for(const area of world.areas.filter(a=>a.landmarks)){
    const map=new NavigationMap(area.width,area.height,area.collision),spawn=area.spawns.find(s=>s.entryId==='default')
    for(const l of area.landmarks){
      assert.ok(l.width>=360&&l.height>=320&&l.description.length<130,'no tiny discovery target or long lore')
      const points=[]
      for(let x=l.x-l.width/2+40;x<l.x+l.width/2;x+=40)for(let y=l.y-l.height/2+40;y<l.y+l.height/2;y+=40)if(map.walkable({x,y})&&map.route(spawn,{x,y}))points.push({x,y})
      assert.ok(points.length>3,`${l.landmarkId}: reachable region interior`)
      const authored=p.levels.find(level=>level.identifier===area.identifier).layerInstances.flatMap(layer=>layer.entityInstances).find(e=>e.fieldInstances.some(f=>f.__identifier==='landmarkId'&&f.__value===l.landmarkId))
      assert.deepEqual(topologyToRuntime(area,{x:authored.px[0],y:authored.px[1]}),{x:l.x,y:l.y})
      assert.deepEqual(topologyToRuntime(area,{x:authored.width,y:authored.height}),{x:l.width,y:l.height})
    }
  }
  const basin=world.areas.find(a=>a.areaId==='the-first-basin'),mesa=basin.landmarks.find(l=>l.landmarkId==='mesa-shoulder')
  assert.ok(Math.abs(2440-mesa.x)<mesa.width/2&&Math.abs(1720-mesa.y)<mesa.height/2,'region covers existing pillar, while reachable south is discoverable')
})

test('cave inspection and blocked Path 5 remain modest and independent from Travel or rewards',()=>{
  const world=parseWorld(source()),notes=world.areas.flatMap(a=>a.interactables??[]).filter(e=>e.kind==='inspectable')
  assert.deepEqual(notes.map(e=>e.entityId).sort(),INSPECTION_IDS.toSorted())
  assert.equal(new Set(notes.map(e=>e.noteId)).size,notes.length)
  assert.ok(notes.every(e=>!e.tutorial&&e.description&&e.harvestingXp===undefined&&e.rewardTable===undefined))
  const cave=world.areas.find(a=>a.areaId==='basin-cave')
  assert.equal(cave.landmarks[0].landmarkId,'seeping-stone');assert.equal(cave.interactables[0].entityId,'cave-mineral-seam')
  assert.equal(cave.exits.length,1);assert.equal(cave.exits[0].targetAreaId,'path-3');assert.equal(cave.travelDestinationId,null)
  const path5=world.areas.find(a=>a.areaId==='path-5-under-construction'),blocked=path5.exits.find(e=>e.blocked)
  assert.deepEqual([blocked.targetAreaId,blocked.targetEntryId,blocked.futureDestinationLabel],[null,null,'Route under construction.'])
  assert.equal(path5.interactables.find(e=>e.kind==='inspectable').description,'Route under construction.')
  assert.equal(world.areas.some(a=>/verdara|glass/.test(a.areaId)),false)
})

test('importer rejects malformed wild balance, tool, rare eligibility and discovery/inspection metadata',()=>{
  const mutations=[
    ['minYield',2],['maxYield',11],['harvestingXp',11],['respawnSeconds',0],['rewardTable','tutorial-seeds'],['resourceType','tissue-sample'],['requiredToolId','unknown-tool'],['rareRollEligible',true],['speciesId','invented-species'],['respawn','shared-cooldown'],
  ]
  for(const [field,value]of mutations){const p=source(),node=p.levels.flatMap(l=>l.layerInstances.flatMap(layer=>layer.entityInstances)).find(e=>e.fieldInstances.some(f=>f.__identifier==='entityId'&&f.__value===NODE_IDS[0]));node.fieldInstances.find(f=>f.__identifier===field).__value=value;assert.throws(()=>parseWorld(p),/wild harvest/,field)}
  const p=source(),regions=p.levels.flatMap(l=>l.layerInstances.flatMap(layer=>layer.entityInstances)).filter(e=>e.__identifier==='LandmarkRegion')
  regions[0].width=0;assert.throws(()=>parseWorld(p),/landmark discovery bounds/)
  const q=source(),inspect=q.levels.flatMap(l=>l.layerInstances.flatMap(layer=>layer.entityInstances)).find(e=>e.__identifier==='EnvironmentalInspectable')
  inspect.fieldInstances.find(f=>f.__identifier==='tutorial').__value=true;assert.throws(()=>parseWorld(q),/environmental inspection/)
})
