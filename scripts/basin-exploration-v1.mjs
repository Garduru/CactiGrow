import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { parseWorld } from './world-import.ts'
import { NavigationMap } from '../src/game-world/navigation/NavigationMap.ts'

// Offline content authoring only. Runtime rewards and discoveries consume the
// saved LDtk entities; this recipe never runs in the browser or Worker.
assert.ok(process.argv.includes('--all'), 'Choose --all explicitly.')
const path = 'world/cactigrow-world.ldtk'
const project = JSON.parse(readFileSync(path, 'utf8')), original = structuredClone(project)
const TAG = 'first-basin-exploration-v1'
const targets = ['Cross_Path_1','Path_2','Path_3','Basin_Cave','Path_4','The_First_Basin','Path_5_Under_Construction']
const wildFields = ['resourceType','rewardTable','minYield','maxYield','harvestingXp','respawnSeconds','requiredToolId','rareRollEligible']
const baseline = parseWorld(original)
const allocate = () => project.nextUid++
const harvestDefinition = project.defs.entities.find(e => e.identifier === 'HarvestablePlant')
assert.ok(harvestDefinition)
const fieldTemplate = harvestDefinition.fieldDefs[0]
function field(identifier, type, canBeNull = false, doc = null) {
  return { ...structuredClone(fieldTemplate), identifier, uid: allocate(), __type: type, type: `F_${type}`, canBeNull, doc }
}
for (const [identifier,type] of [['resourceType','String'],['rewardTable','String'],['minYield','Int'],['maxYield','Int'],['harvestingXp','Int'],['respawnSeconds','Int'],['requiredToolId','String'],['rareRollEligible','Bool']]) {
  if (!harvestDefinition.fieldDefs.some(f => f.identifier === identifier)) harvestDefinition.fieldDefs.push(field(identifier,type,true,'First Basin wild harvest configuration; unused by controlled tutorial harvesting.'))
}
function definition(identifier, properties, fields) {
  let def = project.defs.entities.find(e => e.identifier === identifier)
  if (!def) {
    def = { ...structuredClone(harvestDefinition), uid: allocate(), identifier, tags:[TAG], ...properties, fieldDefs: fields.map(([name,type]) => field(name,type)) }
    project.defs.entities.push(def)
  }
  return def
}
const landmarkDefinition = definition('LandmarkRegion', { resizableX:true, resizableY:true, width:80, height:64, color:'#A5B86B', fillOpacity:.12, hollow:true,
  doc:'Player-center entry discovers a named landmark. Region geometry grants no movement, travel or collision authority.' }, [['landmarkId','String'],['displayName','String'],['description','String']])
const inspectableDefinition = definition('EnvironmentalInspectable', { width:32, height:32, color:'#B9AA87',
  doc:'Optional inspection of an existing environmental feature. No economic reward or new collision.' }, [['entityId','String'],['displayName','String'],['tutorial','Bool'],['noteId','String'],['description','String']])

const SAN_PEDRO = 'echinopsis-pachanoi', PEYOTE = 'lophophora-williamsii'
const resources = [
  ['Cross_Path_1','cross-wild-san-pedro',330,940,SAN_PEDRO,600],
  ['Path_2','path-2-wild-san-pedro',620,590,SAN_PEDRO,900],
  ['Path_2','path-2-wild-peyote',1770,880,PEYOTE,900],
  ['Path_3','path-3-wild-san-pedro',650,750,SAN_PEDRO,900],
  ['Path_3','path-3-wild-peyote',500,1700,PEYOTE,1200],
  ['Path_4','path-4-wild-san-pedro',900,650,SAN_PEDRO,900],
  ['Path_4','path-4-wild-peyote',1900,900,PEYOTE,1200],
  ['The_First_Basin','basin-san-pedro-entrance',1000,1950,SAN_PEDRO,900],
  ['The_First_Basin','basin-peyote-west',1600,2240,PEYOTE,1200],
  ['The_First_Basin','basin-san-pedro-wash',2750,2270,SAN_PEDRO,900],
  ['The_First_Basin','basin-peyote-south',3250,2770,PEYOTE,1200],
  ['The_First_Basin','basin-san-pedro-cairn',4000,2150,SAN_PEDRO,900],
  ['The_First_Basin','basin-peyote-ridge',4830,2400,PEYOTE,1200],
]
const landmarks = [
  ['The_First_Basin','entrance-grove','Entrance Grove',1060,1860,500,400,'A sheltered stand of cactus marks the first open ground beyond the canyon trail.'],
  // The visual pillar is grounded at (2440,1720) on existing blocked terrain.
  // This broad shoulder includes the reachable southern approach at y1800.
  ['The_First_Basin','mesa-shoulder','Mesa Shoulder',2440,1770,560,420,'Layers of sandstone rise above a quiet shoulder of wind-worn sand.'],
  ['The_First_Basin','dry-wash','Dry Wash',3000,2380,720,360,'A shallow channel cut through the basin by storms that rarely come gently.'],
  ['The_First_Basin','cairn','Cairn',3680,2140,400,360,'A small stack of trail stones offers a steady point in the wide basin.'],
  ['The_First_Basin','eastern-ridge','Eastern Ridge',4860,2500,640,400,'Cactus and fallen stone gather beneath the basin\'s eastern rise.'],
  ['Basin_Cave','seeping-stone','Seeping Stone',1230,650,400,320,'A cool seam of mineral-stained stone shelters a faint trace of moisture.'],
]
const inspections = [
  ['Cross_Path_1','cross-trail-cairn','Junction Cairn',870,770,'cross-trail-cairn-note','The stones mark the meeting of settled roads and the quieter Basin trail.'],
  ['Path_2','path-2-roadside-cairn','Roadside Cairn',670,645,'path-2-roadside-cairn-note','A few carefully balanced stones keep the winding road toward Town easy to follow.'],
  ['Path_3','path-3-canyon-cairn','Canyon Cairn',770,1580,'path-3-canyon-cairn-note','Dust collects between these trail stones where the canyon begins to branch.'],
  ['Basin_Cave','cave-mineral-seam','Mineral Formation',1230,650,'cave-mineral-seam-note','Pale mineral lines trace an old seep above the cave\'s damp floor.'],
  ['Path_4','path-4-trail-cairn','Basin Trail Cairn',1950,740,'path-4-trail-cairn-note','The last close-set trail stones point toward the open basin ahead.'],
  ['The_First_Basin','basin-trail-cairn','Basin Cairn',3680,2140,'basin-trail-cairn-note','Someone has kept this modest marker standing against wind and passing seasons.'],
  ['Path_5_Under_Construction','path-5-route-marker','Route Marker',760,380,'path-5-route-marker-note','Route under construction.'],
]
function stableIid(key) {
  const hex = createHash('sha256').update(`cactigrow:${TAG}:${key}`).digest('hex')
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`
}
function authoredEntity(levelName, def, key, x, y, values, width = def.width * 5, height = def.height * 5) {
  const level = project.levels.find(l => l.identifier === levelName), layer = level.layerInstances.find(l => l.__type === 'Entities')
  assert.ok(targets.includes(levelName) && level && layer)
  const area = baseline.areas.find(a => a.identifier === levelName), sx = area.width / level.pxWid, sy = area.height / level.pxHei
  const px = [x/sx,y/sy], size=[width/sx,height/sy]
  assert.ok([...px,...size].every(Number.isSafeInteger),'Content must map exactly to authored integer pixels.')
  const fields = def.fieldDefs.map(f => ({ __identifier:f.identifier, __type:f.__type, __value:values[f.identifier] ?? null, defUid:f.uid,
    realEditorValues:values[f.identifier] == null ? [null] : [{ id:`V_${f.__type}`, params:[values[f.identifier]] }] }))
  return { __identifier:def.identifier, __grid:px.map(v=>Math.floor(v/layer.__gridSize)), __pivot:[.5,.5], __smartColor:def.color, __tags:[TAG], __tile:null,
    defUid:def.uid, fieldInstances:fields, height:size[1], iid:stableIid(key), px, width:size[0], __worldX:level.worldX+px[0], __worldY:level.worldY+px[1] }
}
function add(levelName, entity) { project.levels.find(l=>l.identifier===levelName).layerInstances.find(l=>l.__type==='Entities').entityInstances.push(entity) }
for (const level of project.levels.filter(l=>targets.includes(l.identifier))) for (const layer of level.layerInstances.filter(l=>l.__type==='Entities')) layer.entityInstances=layer.entityInstances.filter(e=>!e.__tags.includes(TAG))
for (const [level,key,x,y,speciesId,respawnSeconds] of resources) add(level,authoredEntity(level,harvestDefinition,key,x,y,{entityId:key,displayName:speciesId===SAN_PEDRO?'Wild San Pedro':'Wild Peyote',tutorial:false,speciesId,seedYield:3,respawn:'player-cooldown',resourceType:'seed-pod',rewardTable:'commodity-seeds',minYield:3,maxYield:10,harvestingXp:10,respawnSeconds,requiredToolId:'field-knife',rareRollEligible:false}))
for (const [level,key,displayName,x,y,width,height,description] of landmarks) add(level,authoredEntity(level,landmarkDefinition,key,x,y,{landmarkId:key,displayName,description},width,height))
for (const [level,key,displayName,x,y,noteId,description] of inspections) add(level,authoredEntity(level,inspectableDefinition,key,x,y,{entityId:key,displayName,tutorial:false,noteId,description}))

const result = parseWorld(project)
function withoutContent(world) { return {...world,areas:world.areas.map(({landmarks,...area})=>{void landmarks; const interactables=area.interactables?.filter(e=>e.tutorial); if(interactables?.length) return {...area,interactables}; const {interactables:unused,...rest}=area;void unused;return rest})} }
assert.deepEqual(withoutContent(result),withoutContent(baseline),'Existing runtime world authority/presentation must remain exact.')
for (const level of original.levels) {
  const actual = project.levels.find(l=>l.identifier===level.identifier)
  if (!targets.includes(level.identifier)) assert.deepEqual(actual,level,'Untargeted complete Level changed.')
  else {
    const preserved = structuredClone(actual)
    for (const layer of preserved.layerInstances.filter(l=>l.__type==='Entities')) layer.entityInstances=layer.entityInstances.filter(e=>!e.__tags.includes(TAG))
    const before = structuredClone(level)
    for (const layer of before.layerInstances.filter(l=>l.__type==='Entities')) layer.entityInstances=layer.entityInstances.filter(e=>!e.__tags.includes(TAG))
    assert.deepEqual(preserved,before,'Existing Level data/art/geometry changed.')
  }
}
function protectedDefs(defs) { return {...defs,entities:defs.entities.filter(d=>!['LandmarkRegion','EnvironmentalInspectable'].includes(d.identifier)).map(d=>d.identifier==='HarvestablePlant'?{...d,fieldDefs:d.fieldDefs.filter(f=>!wildFields.includes(f.identifier))}:d)} }
assert.deepEqual(protectedDefs(project.defs),protectedDefs(original.defs),'Existing LDtk definitions changed beyond appended optional wild fields.')
for (const area of result.areas.filter(a=>targets.includes(a.identifier))) {
  const map = new NavigationMap(area.width,area.height,area.collision), start=area.spawns.find(s=>s.entryId==='default')
  for (const node of area.interactables??[]) if (!node.tutorial) {
    const approach={x:node.x,y:node.y+65}
    assert.ok(map.walkable(node)&&map.walkable(approach)&&map.route(start,approach)&&map.visible(approach,node),`${node.entityId}: existing interaction approach unreachable`)
  }
  for (const landmark of area.landmarks??[]) {
    let reachable=false
    for(let x=landmark.x-landmark.width/2+40;x<landmark.x+landmark.width/2;x+=40)for(let y=landmark.y-landmark.height/2+40;y<landmark.y+landmark.height/2;y+=40)if(map.walkable({x,y})&&map.route(start,{x,y})){reachable=true;break}
    assert.ok(reachable,`${landmark.landmarkId}: discovery region unreachable`)
  }
}
writeFileSync(path,JSON.stringify(project,null,2)+'\n')
console.log(`Authored ${resources.length} wild seed-pod plants, ${landmarks.length} discovery regions and ${inspections.length} inspections. Existing art, geometry, exits, spawns and tutorial payloads preserved.`)
