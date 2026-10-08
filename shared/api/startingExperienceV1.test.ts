import assert from 'node:assert/strict'
import test from 'node:test'
import { isCharacterAppearance, isStartingCommand, isStartingExperience } from './startingExperienceV1.ts'
import { initialStartingState } from '../../server/starting/startingState.ts'
import { parseWorld } from '../../scripts/world-import.ts'
import { readFileSync } from 'node:fs'
import { TOWN_AREA } from '../realtime/areas.ts'
import { layerId, playerId, presenceId } from '../realtime/identifiers.ts'
import { createAreaPresenceState, joinPresence, toPublicPresence } from '../../server/realtime/presenceState.ts'
import { isPublicPresenceV1 } from '../realtime/protocolV1.ts'
import { isMailAttachment } from './mailV1.ts'
import { isPlantCommoditySeedCommandV3 } from './plantLifecycleV3.ts'
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
test('reserved tutorial material has no commodity/mail identifier; Nursery intent is exact and server validated',()=>{
  assert.equal(isMailAttachment({kind:'tutorial',speciesId:'echinopsis-pachanoi',quantity:1}),false)
  assert.equal(isMailAttachment({kind:'commodity',speciesId:'tutorial-san-pedro',quantity:1}),false)
  const command={slotId:'slot-1',speciesId:'echinopsis-pachanoi',expectedSeedStackVersion:1,tutorial:true}
  assert.equal(isPlantCommoditySeedCommandV3(command),true)
  assert.equal(isPlantCommoditySeedCommandV3({...command,tutorial:false}),false)
  assert.equal(isPlantCommoditySeedCommandV3({...command,quantity:1000}),false)
  assert.equal(isStartingExperience({...initialStartingState(false),farmSeedAvailable:'invented'}),false)
})
test('appearance and tutorial commands accept only available palettes and exact client intent',()=>{
  assert.ok(isCharacterAppearance({skin:2,shirt:1}));for(const a of [{skin:3,shirt:0},{skin:0,shirt:-1},{skin:0,shirt:0,hat:'invented'},{skin:.5,shirt:0}])assert.equal(isCharacterAppearance(a),false)
  assert.ok(isStartingCommand({type:'equip-tool',itemId:'field-knife',commandId:uuid(1)}))
  for(const c of [{type:'equip-tool',itemId:'fabricated',commandId:uuid(1)},{type:'harvest-plant',entityId:'first-san-pedro',commandId:uuid(1),seedYield:999},{type:'complete-tutorial',commandId:uuid(1)},{type:'confirm-nursery',commandId:uuid(1)},{type:'confirm-garden',commandId:uuid(1)},{type:'confirm-garden',commandId:uuid(1),playerId:uuid(2)}])assert.equal(isStartingCommand(c),false)
})
test('initial onboarding projections distinguish new and compatible accounts without inventing gear or rewards',()=>{
  const fresh=initialStartingState(false),old=initialStartingState(true)
  assert.ok(isStartingExperience(fresh));assert.equal(fresh.spawnStage,'appearance');assert.deepEqual(fresh.ownedEquipment,[]);assert.equal(fresh.harvestingXp,0)
  assert.ok(isStartingExperience(old));assert.equal(old.farmStage,'complete');assert.equal(old.appearanceComplete,true)
  assert.equal(isStartingExperience({...fresh,harvestingXp:-1}),false)
})
test('LDtk imports real visual layers and authored interactions independently of collision and locked geometry',()=>{
  const source=JSON.parse(readFileSync('world/cactigrow-world.ldtk','utf8')),world=parseWorld(source)
  // First Basin adds Paths and reused decoration layers to Cross; the original
  // Starting layers and independent interactions/collision remain required.
  for(const id of ['starting-spawn-tutorial','path-1','cross-path-1']){const a=world.areas.find(a=>a.areaId===id)!;assert.deepEqual([...new Set(a.visualLayers?.filter(l=>l.name!=='Paths').map(l=>l.name))].sort(),['BoundaryEdges','Decorations','Ground','GroundVariation']);assert.ok(a.visualLayers!.every(l=>l.tiles.length));assert.ok(a.collision.length)}
  const harvest=world.areas.find(a=>a.areaId==='starting-spawn-tutorial')!.interactables!.find(e=>e.kind==='harvestable')!
  assert.equal(harvest.seedYield,3);assert.equal(harvest.respawn,'once-per-player');assert.equal(harvest.speciesId,'echinopsis-pachanoi')
  assert.equal(world.areas.find(a=>a.areaId==='player-farm')!.width,3000);assert.equal(world.areas.find(a=>a.areaId==='town-p1')!.height,1500)
  const altered=structuredClone(source);altered.levels.find((l: {identifier:string})=>l.identifier==='Path_1').layerInstances.find((l:{__identifier:string})=>l.__identifier==='Ground').gridTiles[0].src=[9999,9999]
  assert.throws(()=>parseWorld(altered),/visual tile bounds/)
  const withoutVisuals=structuredClone(source);for(const l of withoutVisuals.levels)l.layerInstances=l.layerInstances.filter((k:{__type:string})=>!['Tiles','AutoLayer'].includes(k.__type))
  const structural=parseWorld(withoutVisuals);for(const a of world.areas)assert.deepEqual(a.collision,structural.areas.find(b=>b.areaId===a.areaId)!.collision)
})
test('multiplayer whitelists saved appearance, keeps private quest/equipment data out, and accepts legacy presence',()=>{
  const result=joinPresence(createAreaPresenceState(TOWN_AREA,0),{playerId:playerId(uuid(1)),presenceId:presenceId(uuid(2)),newLayerId:layerId(uuid(3)),entryPointId:'farm-arrival',appearance:{skin:2,shirt:1}},1)
  assert.ok(result.ok)
  const projection=toPublicPresence({...result.membership, ...{harvestingXp:999, equipment:{tool:'field-knife'}}})
  assert.deepEqual(projection.appearance,{skin:2,shirt:1});assert.ok(isPublicPresenceV1(projection));assert.equal(Object.hasOwn(projection,'equipment'),false);assert.equal(Object.hasOwn(projection,'harvestingXp'),false)
  assert.ok(isPublicPresenceV1({...projection,appearance:'placeholder'}));assert.equal(isPublicPresenceV1({...projection,appearance:{skin:999,shirt:0}}),false)
})
