import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { readFile, readdir, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { createServer } from 'node:net'
import { verifyStartingUi } from './startingUiAcceptance.mjs'

test('Starting Experience V1: fresh player through real Nursery, Collection, research and breeding with persistent, replay-safe rewards', { skip: !process.env.CACTIGROW_EMBEDDED_POSTGRES_MODULE && 'Set CACTIGROW_EMBEDDED_POSTGRES_MODULE.' }, async t => {
  const { default: EmbeddedPostgres } = await import(process.env.CACTIGROW_EMBEDDED_POSTGRES_MODULE)
  const probe=createServer(); await new Promise(r=>probe.listen(0,'127.0.0.1',r)); const port=probe.address().port; await new Promise(r=>probe.close(r))
  const password=crypto.randomUUID(), cluster=new EmbeddedPostgres({databaseDir:resolve(tmpdir(),`cactigrow-starting-${crypto.randomUUID()}`),user:'postgres',password,port,persistent:true,postgresFlags:['-h','127.0.0.1'],onLog(){},onError(){}})
  await cluster.initialise(); await cluster.start(); await cluster.createDatabase('starting_test')
  const connection=cluster.getPgClient('starting_test','127.0.0.1'); await connection.connect()
  const {Pool}=await import('pg'),pool=new Pool({host:'127.0.0.1',port,user:'postgres',password,database:'starting_test',max:5})
  try {
    for(const file of (await readdir('server/db/migrations')).filter(f=>f.endsWith('.sql')).sort())await connection.query(await readFile('server/db/migrations/'+file,'utf8'))
    await mkdir('node_modules/.tmp',{recursive:true});const out=resolve('node_modules/.tmp/starting-db.mjs')
    await build({stdin:{contents:`export {StartingExperienceService} from './server/starting/StartingExperienceService.ts';export {WorldService} from './server/world/WorldService.ts';export {initializeStagingGrower} from './server/staging/initializeGrower.ts';export {PlantLifecycleService} from './server/gameplay/PlantLifecycleService.ts';export {GrowerAlphaService} from './server/gameplay/GrowerAlphaService.ts';export {GardenService} from './server/gameplay/GardenService.ts';export {MailService} from './server/player/MailService.ts';export {createApiRouter} from './server/api/router.ts';export {handleApiRequest} from './server/api/handler.ts';export {resolvePlantGrowth} from './server/gameplay/plantLifecycleRules.ts';`,resolveDir:process.cwd()},bundle:true,packages:'external',platform:'node',format:'esm',outfile:out})
    const {StartingExperienceService,WorldService,initializeStagingGrower,PlantLifecycleService,GrowerAlphaService,GardenService,MailService,createApiRouter,handleApiRequest,resolvePlantGrowth}=await import(pathToFileURL(out).href)
    const {drizzle}=await import('drizzle-orm/node-postgres'),db=drizzle(pool),ids=[crypto.randomUUID(),crypto.randomUUID(),crypto.randomUUID()]
    for(const id of ids)await connection.query('insert into players(id)values($1)',[id])
    await initializeStagingGrower(db,ids[0],true);await initializeStagingGrower(db,ids[1]);
    await connection.query("insert into player_seed_stacks(player_id,species_id,quantity)values($1,'echinopsis-pachanoi',1)",[ids[2]])
    await initializeStagingGrower(db,ids[2],true)
    for(const [i,id]of ids.entries())await connection.query('insert into player_profiles(player_id,public_id,display_name)values($1,$2,$3)',[id,crypto.randomUUID(),'Starting Tester '+i])
    await connection.query(`create role starting_runtime;grant usage on schema public to starting_runtime;grant select on all tables in schema public to starting_runtime;
      grant insert,update on player_onboarding,player_grower_state,player_seed_stacks,plant_specimens,player_plant_lifecycle_versions,gameplay_command_receipts,player_garden_specimens to starting_runtime;
      grant insert on clone_lines,genetic_profiles,clone_line_variants,bred_seeds,player_grower_events to starting_runtime;grant update on bred_seeds to starting_runtime;
      grant insert,update,delete on nursery_occupancies to starting_runtime;`)
    await connection.query('grant insert,update on player_profiles to starting_runtime')
    pool.on('connect',client=>{void client.query('set role starting_runtime')})
    // Close initialized pool clients so all further operations use the restricted role.
    await pool.query('set role starting_runtime')
    let clock=new Date('2026-10-06T12:00:00Z'),starting=new StartingExperienceService(db,()=>clock),world=new WorldService(db),lifecycle=new PlantLifecycleService(db,{environment:'staging',now:()=>clock}),grower=new GrowerAlphaService(db),garden=new GardenService(db)
    const id=ids[0],cmd=command=>starting.execute(id,{...command,commandId:crypto.randomUUID()})
    let state,location
    await t.test('fresh player appearance/name state and existing account compatibility',async()=>{
      state=await starting.read(id);assert.equal(state.appearanceComplete,false);assert.equal(state.nameComplete,true)
      for(const old of ids.slice(1)){const s=await starting.read(old);assert.equal(s.compatibilityComplete,true);assert.equal(s.farmTutorialComplete,true)}
      await initializeStagingGrower(db,id,true);assert.equal((await starting.read(id)).appearanceComplete,false,'repeated authentication does not mark a fresh player complete')
      location=await world.read(id);assert.equal(location.areaId,'starting-spawn-tutorial')
      await assert.rejects(world.transition(id,{v:1,exitId:'to-path-1',expectedRevision:0,commandId:crypto.randomUUID()}),/appearance/)
    })
    await t.test('API rejects invalid appearance, fabricated payloads, unauthorized callers and production tutorial routes',async()=>{
      const router=createApiRouter({authenticationConfigurationFactory:()=>({identityProvider:{verify:async req=>req.getHeader('x-test-player')===id?{provider:'test',subject:id}:null},createPlayerIdentityResolver:async()=>({resolve:async()=>({playerId:id})})})})
      const request=async(body,environment='test',authorized=true)=>handleApiRequest(new Request('https://starting.test/api/v1/me/starting-experience',{method:body?'POST':'GET',headers:{'content-type':'application/json',...(authorized?{'x-test-player':id}:{})},...(body?{body:JSON.stringify(body)}:{})}),{CACTIGROW_ENVIRONMENT:environment,CACTIGROW_VERSION:'test'},undefined,{router,createRequestDatabaseContext:()=>({getDatabase:async()=>db,dispose:async()=>{}})})
      assert.equal((await request({type:'save-appearance',commandId:crypto.randomUUID(),appearance:{skin:999,shirt:0}})).status,400)
      assert.equal((await request({type:'harvest-plant',commandId:crypto.randomUUID(),entityId:'first-san-pedro',seedYield:999})).status,400)
      assert.equal((await request(null,'test',false)).status,401);assert.equal((await request(null,'production')).status,404)
    })
    await t.test('appearance persists across new service instances and cannot be overwritten by a second setup',async()=>{
      const c={type:'save-appearance',appearance:{skin:2,shirt:1},commandId:crypto.randomUUID()};state=await starting.execute(id,c);assert.deepEqual((await new StartingExperienceService(db).read(id)).appearance,c.appearance);assert.deepEqual(await starting.execute(id,c),state)
      await assert.rejects(cmd({type:'save-appearance',appearance:{skin:0,shirt:0}}),/already complete/)
    })
    await t.test('authored guide grants one persistent tool under concurrent replay',async()=>{
      await assert.rejects(cmd({type:'equip-tool',itemId:'field-knife'}))
      await assert.rejects(cmd({type:'talk-guide',entityId:'fabricated-guide'}))
      const c={type:'talk-guide',entityId:'mara-guide',commandId:crypto.randomUUID()};const raced=await Promise.all([starting.execute(id,c),starting.execute(id,c)]);assert.deepEqual(raced[0],raced[1]);assert.deepEqual(raced[0].ownedEquipment,['field-knife'])
      await assert.rejects(cmd({type:'talk-guide',entityId:'mara-guide'}),/already given/)
      await assert.rejects(cmd({type:'harvest-plant',entityId:'first-san-pedro'}),/Equip/)
      state=await cmd({type:'equip-tool',itemId:'field-knife'});assert.equal((await new StartingExperienceService(db).read(id)).equipment.tool,'field-knife')
    })
    const exit=async exitId=>{location=await world.transition(id,{v:1,exitId,expectedRevision:location.revision,commandId:crypto.randomUUID()})}
    await t.test('harvest validates current authored Area/target and gives exactly controlled seeds/XP once',async()=>{
      await exit('to-path-1');await assert.rejects(cmd({type:'harvest-plant',entityId:'first-san-pedro'}));await exit('to-starting-spawn-tutorial')
      const before=(await lifecycle.getProjection(id)).seedStacks.find(s=>s.speciesId==='echinopsis-pachanoi').quantity
      const c={type:'harvest-plant',entityId:'first-san-pedro',commandId:crypto.randomUUID()};await starting.execute(id,c);await starting.execute(id,c);await assert.rejects(cmd({type:'harvest-plant',entityId:'first-san-pedro'}))
      state=await new StartingExperienceService(db).read(id);assert.equal(state.harvestingXp,10);assert.equal(state.tutorialSeedAvailable,true);assert.equal((await lifecycle.getProjection(id)).seedStacks.find(s=>s.speciesId==='echinopsis-pachanoi').quantity,before+2)
    })
    await t.test('dedicated pot has server-owned 45-second growth, reserves a seed, and cannot duplicate planting or collect early',async()=>{
      await exit('to-path-1');await assert.rejects(world.transition(id,{v:1,exitId:'to-cross-path-1',expectedRevision:location.revision,commandId:crypto.randomUUID()}),/tutorial pot/)
      state=await cmd({type:'plant-pot',entityId:'path-1-pot'});assert.equal(Date.parse(state.pot.readyAt)-Date.parse(state.pot.plantedAt),45000);assert.equal(state.tutorialSeedAvailable,false)
      assert.equal((await lifecycle.getProjection(id)).nursery.slots.every(s=>s.occupancy===null),true,'tutorial pot never occupies a Farm bed')
      await assert.rejects(cmd({type:'plant-pot',entityId:'path-1-pot'}));await assert.rejects(cmd({type:'collect-pot',entityId:'path-1-pot'}),/still growing/)
      assert.equal(resolvePlantGrowth(clock,'staging','echinopsis-pachanoi').readyAt.getTime()-clock.getTime(),120000)
      assert.equal(resolvePlantGrowth(clock,'production','echinopsis-pachanoi').readyAt.getTime()-clock.getTime(),300000)
      clock=new Date(clock.getTime()+45000);state=await cmd({type:'collect-pot',entityId:'path-1-pot'});assert.equal(state.spawnStage,'leave-zone');assert.ok((await lifecycle.getProjection(id)).ownedSpecimens.some(p=>p.specimenId===state.pot.specimenId))
      await assert.rejects(cmd({type:'collect-pot',entityId:'path-1-pot'}))
    })
    await t.test('authored Starting Zone exit records completion; physical Farm discovery starts lessons and unlocks Travel',async()=>{
      await exit('to-cross-path-1');state=await starting.read(id);assert.equal(state.spawnTutorialComplete,true);assert.equal(state.farmStage,'undiscovered')
      await exit('to-player-farm');assert.ok(location.runtimeAreaId.startsWith('farm-'));assert.ok(location.discoveredTravelDestinationIds.includes('player-farm'));assert.equal((await starting.read(id)).farmStage,'nursery')
      await assert.rejects(world.transition(id,{v:1,exitId:'to-town-p1',expectedRevision:location.revision,commandId:crypto.randomUUID()}))
      await exit('to-cross-path-1');await exit('to-path-1');await exit('to-cross-path-1');await exit('to-player-farm');assert.equal((await starting.read(id)).farmStage,'nursery','re-entry does not reset quests')
    })
    await t.test('Nursery lesson requires real normal planting; Collection lesson requires persisted favorite',async()=>{
      await assert.rejects(cmd({type:'confirm-nursery'}),/normal seed/)
      const stack=(await lifecycle.getProjection(id)).seedStacks.find(s=>s.speciesId==='echinopsis-pachanoi');const planted=await lifecycle.plantCommoditySeed(id,crypto.randomUUID(),{speciesId:stack.speciesId,slotId:'slot-1',expectedSeedStackVersion:stack.version})
      assert.equal(Date.parse(planted.slot.occupancy.readyAt)-Date.parse(planted.slot.occupancy.plantedAt),120000)
      state=await cmd({type:'confirm-nursery'});assert.equal(state.farmStage,'garden');await assert.rejects(cmd({type:'confirm-garden'}),/Favorite/)
      await garden.execute(id,{type:'favorite',specimenId:state.tutorialParentIds[0],favorite:true,commandId:crypto.randomUUID()});state=await cmd({type:'confirm-garden'});assert.equal(state.farmStage,'research');assert.equal(state.tutorialParentIds.length,2)
    })
    await t.test('safe material uses actual baseline genetics, cannot sell/list/mail/sample, and real research updates player knowledge',async()=>{
      const specimenId=state.tutorialParentIds[0],plant=(await lifecycle.getProjection(id)).ownedSpecimens.find(p=>p.specimenId===specimenId)
      assert.deepEqual(plant.genetics,{vigor:50,growthSpeed:50,size:50,flowering:50,mutationChance:1});assert.deepEqual(plant.specialVariants,[])
      for(const type of ['sell-specimen-to-npc','list-specimen','collect-tissue-sample'])await assert.rejects(grower.execute(id,{type,specimenId,commandId:crypto.randomUUID(),...(type==='list-specimen'?{askingPrice:1}:{})}))
      const recipient=(await connection.query('select public_id from player_profiles where player_id=$1',[ids[1]])).rows[0].public_id
      await assert.rejects(new MailService(db).execute(id,{type:'send',commandId:crypto.randomUUID(),recipientPublicId:recipient,subject:'Practice transfer',text:'Isolated test',attachment:{kind:'specimen',specimenId}}),/Tutorial specimens/)
      assert.equal((await connection.query('select count(*)::int as n from mail_messages where sender_player_id=$1',[id])).rows[0].n,0)
      const result=await grower.execute(id,{type:'observe-specimen',specimenId,commandId:crypto.randomUUID()});assert.ok(result.research.records[plant.cloneLineId]);assert.ok(result.player.skills.geneticsXp>0);state=await starting.read(id);assert.equal(state.farmStage,'breeding')
    })
    await t.test('one real breeding operation inherits genetics, serializes duplicate rewards, protects offspring and persists Farm completion',async()=>{
      const parents=(await lifecycle.getProjection(id)).ownedSpecimens,first=parents.find(p=>p.specimenId===state.tutorialParentIds[0]),second=parents.find(p=>p.specimenId===state.tutorialParentIds[1]);const command={parent1SpecimenId:first.specimenId,parent2SpecimenId:second.specimenId,expectedParent1Version:first.version,expectedParent2Version:second.version}
      const c=crypto.randomUUID(),seed=await lifecycle.breedSpecimens(id,c,command);assert.deepEqual(await lifecycle.breedSpecimens(id,c,command),seed);await assert.rejects(lifecycle.breedSpecimens(id,crypto.randomUUID(),command),/already produced/)
      assert.deepEqual(seed.seed.parentPlantIds,[first.specimenId,second.specimenId]);assert.notEqual(seed.seed.cloneLineId,first.cloneLineId);assert.ok(Object.values(seed.seed.genetics).every(v=>Number.isInteger(v)&&v>=0&&v<=100))
      await assert.rejects(lifecycle.plantBredSeed(id,crypto.randomUUID(),{slotId:'slot-2',seedId:seed.seed.seedId}),/practice offspring/)
      state=await starting.read(id);assert.equal(state.farmTutorialComplete,true);assert.equal(state.offspringSeedId,seed.seed.seedId);assert.equal((await grower.project(id)).player.skills.breedingXp,40)
      assert.deepEqual(await new StartingExperienceService(db).read(id),state);assert.ok((await connection.query('select tutorial_completed_at from player_onboarding where player_id=$1',[id])).rows[0].tutorial_completed_at)
      assert.equal((await connection.query('select count(*)::int as n from bred_seeds where owner_player_id=$1',[id])).rows[0].n,1)
    })
    await t.test('fresh full-app browser flow: name, appearance, authored world interactions, mobile HUD, refresh, real Farm systems', { skip: !process.env.CACTIGROW_TEST_BROWSER_EXECUTABLE && 'Set CACTIGROW_TEST_BROWSER_EXECUTABLE.', timeout:180000 }, async()=>{
      const playerId=crypto.randomUUID();await connection.query('insert into players(id)values($1)',[playerId])
      await verifyStartingUi({database:db,playerId,handleApiRequest,createApiRouter})
    })
  } finally { await pool.end();await connection.end();await cluster.stop() }
})
