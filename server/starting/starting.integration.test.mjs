import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { readFile, readdir, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { createServer } from 'node:net'
import { verifyStartingUi } from './startingUiAcceptance.mjs'
import { resolveCharacterAppearance } from '../../shared/characters/appearance.ts'

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
    await build({stdin:{contents:`export {SocialService} from './server/player/SocialService.ts';export {StartingExperienceService} from './server/starting/StartingExperienceService.ts';export {StartingResetService} from './server/starting/StartingResetService.ts';export {WorldService} from './server/world/WorldService.ts';export {initializeStagingGrower} from './server/staging/initializeGrower.ts';export {PlantLifecycleService} from './server/gameplay/PlantLifecycleService.ts';export {GrowerAlphaService} from './server/gameplay/GrowerAlphaService.ts';export {GardenService} from './server/gameplay/GardenService.ts';export {MailService} from './server/player/MailService.ts';export {createApiRouter} from './server/api/router.ts';export {handleApiRequest} from './server/api/handler.ts';export {resolvePlantGrowth} from './server/gameplay/plantLifecycleRules.ts';`,resolveDir:process.cwd()},bundle:true,packages:'external',platform:'node',format:'esm',outfile:out})
    const {SocialService,StartingExperienceService,StartingResetService,WorldService,initializeStagingGrower,PlantLifecycleService,GrowerAlphaService,GardenService,MailService,createApiRouter,handleApiRequest,resolvePlantGrowth}=await import(pathToFileURL(out).href)
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
    await connection.query('grant insert,update,delete on player_garden_displays to starting_runtime')
    await connection.query('grant insert,update on player_profiles to starting_runtime')
    pool.on('connect',client=>{void client.query('set role starting_runtime')})
    // Close initialized pool clients so all further operations use the restricted role.
    await pool.query('set role starting_runtime')
    let clock=new Date('2026-10-06T12:00:00Z'),starting=new StartingExperienceService(db,()=>clock),world=new WorldService(db),lifecycle=new PlantLifecycleService(db,{environment:'staging',now:()=>clock}),grower=new GrowerAlphaService(db),garden=new GardenService(db)
    const id=ids[0],cmd=command=>starting.execute(id,{...command,commandId:crypto.randomUUID()})
    let state,location
    await t.test('fresh player appearance/name state and existing account compatibility',async()=>{
      state=await starting.read(id);assert.equal(state.appearanceComplete,false);assert.equal(state.nameComplete,true)
      for(const old of ids.slice(1)){const s=await starting.read(old);assert.equal(s.compatibilityComplete,true);assert.equal(s.farmTutorialComplete,true);assert.equal(s.appearanceComplete,true,'established accounts keep the creator complete');assert.deepEqual(s.appearance,{skin:0,shirt:0},'legacy checkpoint shape is not rewritten');assert.equal(resolveCharacterAppearance(s.appearance).body,0,'omitted body uses the masculine compatibility presentation')}
      await initializeStagingGrower(db,id,true);assert.equal((await starting.read(id)).appearanceComplete,false,'repeated authentication does not mark a fresh player complete')
      location=await world.read(id);assert.equal(location.areaId,'starting-spawn-tutorial')
      await assert.rejects(world.transition(id,{v:1,exitId:'to-path-1',expectedRevision:0,commandId:crypto.randomUUID()}),/appearance/)
    })
    await t.test('API rejects invalid appearance, fabricated payloads and unauthorized staging/production callers',async()=>{
      const router=createApiRouter({authenticationConfigurationFactory:()=>({identityProvider:{verify:async req=>req.getHeader('x-test-player')===id?{provider:'test',subject:id}:null},createPlayerIdentityResolver:async()=>({resolve:async()=>({playerId:id})})})})
      const request=async(body,environment='test',authorized=true)=>handleApiRequest(new Request('https://starting.test/api/v1/me/starting-experience',{method:body?'POST':'GET',headers:{'content-type':'application/json',...(authorized?{'x-test-player':id}:{})},...(body?{body:JSON.stringify(body)}:{})}),{CACTIGROW_ENVIRONMENT:environment,CACTIGROW_VERSION:'test'},undefined,{router,createRequestDatabaseContext:()=>({getDatabase:async()=>db,dispose:async()=>{}})})
      assert.equal((await request({type:'save-appearance',commandId:crypto.randomUUID(),appearance:{skin:999,shirt:0}})).status,400)
      assert.equal((await request({type:'harvest-plant',commandId:crypto.randomUUID(),entityId:'first-san-pedro',seedYield:999})).status,400)
      for (const type of ['confirm-nursery','confirm-garden','complete-tutorial']) assert.equal((await request({type,commandId:crypto.randomUUID()})).status,400)
      assert.equal((await request(null,'test',false)).status,401);assert.equal((await request(null,'production',false)).status,401);assert.equal((await request(null,'production')).status,200)
    })
    await t.test('legacy two-field appearance persists across new service instances and cannot be overwritten by a second setup',async()=>{
      const c={type:'save-appearance',appearance:{skin:2,shirt:1},commandId:crypto.randomUUID()};state=await starting.execute(id,c);assert.deepEqual((await new StartingExperienceService(db).read(id)).appearance,c.appearance);assert.deepEqual(await starting.execute(id,c),state)
      await assert.rejects(cmd({type:'save-appearance',appearance:{skin:0,shirt:0}}),/already complete/)
    })
    for (const [body,label] of [[0,'masculine'],[1,'feminine']]) await t.test(`${label} body selection persists through the actual API, checkpoint and service reload`,async()=>{
      const player=crypto.randomUUID()
      await connection.query('insert into players(id)values($1)',[player])
      await initializeStagingGrower(db,player,true)
      await connection.query('insert into player_profiles(player_id,public_id,display_name)values($1,$2,$3)',[player,crypto.randomUUID(),`Body Tester ${body}`])
      const router=createApiRouter({authenticationConfigurationFactory:()=>({identityProvider:{verify:async()=>({provider:'test',subject:player})},createPlayerIdentityResolver:async()=>({resolve:async()=>({playerId:player})})})})
      const request=async(command)=>handleApiRequest(new Request('https://starting.test/api/v1/me/starting-experience',{method:command?'POST':'GET',headers:{'content-type':'application/json'},...(command?{body:JSON.stringify(command)}:{})}),{CACTIGROW_ENVIRONMENT:'test',CACTIGROW_VERSION:'test'},undefined,{router,createRequestDatabaseContext:()=>({getDatabase:async()=>db,dispose:async()=>{}})})
      const appearance={body,skin:2,shirt:1,hair:body===1?3:1,hairColor:3,pants:1,hat:1,accessory:1},command={type:'save-appearance',appearance,commandId:crypto.randomUUID()}
      assert.equal((await request({...command,appearance:{...appearance,body:2}})).status,400)
      const saved=await request(command);assert.equal(saved.status,200)
      assert.deepEqual((await saved.json()).data.appearance,appearance)
      const read=await request();assert.equal(read.status,200);assert.deepEqual((await read.json()).data.appearance,appearance)
      assert.deepEqual((await new StartingExperienceService(db).read(player)).appearance,appearance)
      assert.equal((await request(command)).status,200,'same command replays without a duplicate save')
      assert.equal((await request({...command,appearance:{...appearance,body:1-body}})).status,409,'reused command cannot change the saved body')
      assert.equal((await request({...command,commandId:crypto.randomUUID()})).status,409,'completed players are not forced through another creator')
      const stored=(await connection.query('select payload from player_grower_events where player_id=$1 and source_command_id=$2',[player,command.commandId])).rows
      assert.equal(stored.length,1);assert.deepEqual(stored[0].payload.appearance,appearance)
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
    await t.test('dedicated pot has server-owned 15-second growth, reserves a seed, and cannot duplicate planting or collect early',async()=>{
      await exit('to-path-1');await assert.rejects(world.transition(id,{v:1,exitId:'to-cross-path-1',expectedRevision:location.revision,commandId:crypto.randomUUID()}),/tutorial pot/)
      state=await cmd({type:'plant-pot',entityId:'path-1-pot'});assert.equal(Date.parse(state.pot.readyAt)-Date.parse(state.pot.plantedAt),15000);assert.equal(state.tutorialSeedAvailable,false)
      assert.equal((await lifecycle.getProjection(id)).nursery.slots.every(s=>s.occupancy===null),true,'tutorial pot never occupies a Farm bed')
      await assert.rejects(cmd({type:'plant-pot',entityId:'path-1-pot'}));await assert.rejects(cmd({type:'collect-pot',entityId:'path-1-pot'}),/still growing/)
      assert.equal(resolvePlantGrowth(clock,'staging','echinopsis-pachanoi').readyAt.getTime()-clock.getTime(),120000)
      assert.equal(resolvePlantGrowth(clock,'production','echinopsis-pachanoi').readyAt.getTime()-clock.getTime(),300000)
      clock=new Date(clock.getTime()+14999);await assert.rejects(cmd({type:'collect-pot',entityId:'path-1-pot'}),/still growing/);clock=new Date(clock.getTime()+1);assert.equal((await starting.read(id)).spawnStage,'collect-ready');state=await cmd({type:'collect-pot',entityId:'path-1-pot'});assert.equal(state.spawnStage,'leave-zone');assert.ok((await lifecycle.getProjection(id)).ownedSpecimens.some(p=>p.specimenId===state.pot.specimenId))
      await assert.rejects(cmd({type:'collect-pot',entityId:'path-1-pot'}))
    })
    await t.test('authored Starting Zone exit records completion; physical Farm discovery starts lessons and unlocks Travel',async()=>{
      await exit('to-cross-path-1');state=await starting.read(id);assert.equal(state.spawnTutorialComplete,true);assert.equal(state.farmStage,'undiscovered')
      await exit('to-player-farm');assert.ok(location.runtimeAreaId.startsWith('farm-'));assert.ok(location.discoveredTravelDestinationIds.includes('player-farm'));assert.equal((await starting.read(id)).farmStage,'nursery')
      await assert.rejects(world.transition(id,{v:1,exitId:'to-town-p1',expectedRevision:location.revision,commandId:crypto.randomUUID()}))
      await exit('to-cross-path-1'); for (const blocked of ['to-path-1','to-path-2']) await assert.rejects(world.transition(id,{v:1,exitId:blocked,expectedRevision:location.revision,commandId:crypto.randomUUID()}),/Visit your Farm first/); await exit('to-player-farm');assert.equal((await starting.read(id)).farmStage,'nursery','re-entry does not reset quests')
    })
    await t.test('Nursery lesson requires real normal planting; Collection lesson requires persisted favorite',async()=>{
      assert.equal((await starting.read(id)).farmStage,'nursery'); clock = new Date(Date.now()+1000)
      const stack=(await lifecycle.getProjection(id)).seedStacks.find(s=>s.speciesId==='echinopsis-pachanoi');const planted=await lifecycle.plantCommoditySeed(id,crypto.randomUUID(),{speciesId:stack.speciesId,slotId:'slot-1',expectedSeedStackVersion:stack.version})
      assert.equal(Date.parse(planted.slot.occupancy.readyAt)-Date.parse(planted.slot.occupancy.plantedAt),120000)
      state=await starting.read(id);assert.equal(state.farmStage,'garden');assert.equal((await starting.read(id)).farmStage,'garden')
      await garden.execute(id,{type:'favorite',specimenId:state.tutorialParentIds[0],favorite:true,commandId:crypto.randomUUID()});state=await starting.read(id);assert.equal(state.farmStage,'lab');assert.equal(state.tutorialParentIds.length,2); await cmd({type:'visit-lab'}); state=await starting.read(id);assert.equal(state.farmStage,'research')
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
      await assert.rejects(lifecycle.breedSpecimens(id,crypto.randomUUID(),{parent1SpecimenId:second.specimenId,parent2SpecimenId:first.specimenId,expectedParent1Version:second.version,expectedParent2Version:first.version}),/guided tutorial parents/); assert.equal(first.lifecycleStatus,'owned');assert.ok(first.collectedAt);assert.equal(second.lifecycleStatus,'owned');assert.ok(second.collectedAt); const c=crypto.randomUUID(),seed=await lifecycle.breedSpecimens(id,c,command);assert.deepEqual(await lifecycle.breedSpecimens(id,c,command),seed);await assert.rejects(lifecycle.breedSpecimens(id,crypto.randomUUID(),command),/already produced/)
      assert.deepEqual(seed.seed.parentPlantIds,[first.specimenId,second.specimenId]);assert.notEqual(seed.seed.cloneLineId,first.cloneLineId);assert.ok(Object.values(seed.seed.genetics).every(v=>Number.isInteger(v)&&v>=0&&v<=100))
      await assert.rejects(lifecycle.plantBredSeed(id,crypto.randomUUID(),{slotId:'slot-2',seedId:seed.seed.seedId}),/practice offspring/)
      state=await starting.read(id);assert.equal(state.farmTutorialComplete,true);assert.equal(state.offspringSeedId,seed.seed.seedId);assert.equal((await grower.project(id)).player.skills.breedingXp,40)
      assert.deepEqual(await new StartingExperienceService(db).read(id),state);assert.ok((await connection.query('select tutorial_completed_at from player_onboarding where player_id=$1',[id])).rows[0].tutorial_completed_at)
      assert.equal((await connection.query('select count(*)::int as n from bred_seeds where owner_player_id=$1',[id])).rows[0].n,1); await exit('to-cross-path-1');await exit('to-path-2');await exit('to-cross-path-1');await exit('to-player-farm')
    })
    await t.test('established accounts can explore Cross Path without the fresh Farm gate',async()=>{
      const old=ids[2];let l=await world.read(old)
      for(const exitId of ['to-path-1','to-cross-path-1','to-path-2'])l=await world.transition(old,{v:1,exitId,expectedRevision:l.revision,commandId:crypto.randomUUID()})
      assert.equal(l.areaId,'path-2');assert.equal((await starting.read(old)).compatibilityComplete,true)
    })
    await t.test('confirmed tutorial reset preserves identity/gameplay, retires only practice material, and restores server first-time routing',async()=>{
      const reset=new StartingResetService(db,'staging'), target=ids[0], actor=ids[1]
      const request={commandId:crypto.randomUUID(),targetPlayerId:target,confirmPlayerId:target,mode:'tutorial'}
      await assert.rejects(reset.execute(target,{...request,confirmPlayerId:actor}),/Confirm/)
      await assert.rejects(reset.execute(actor,request),e=>e.status===403)
      await assert.rejects(new StartingResetService(db,'production').execute(target,request),e=>e.status===404)
      await connection.query("insert into admin_role_assignments(player_id,role,assigned_by_player_id)values($1,'OWNER',$1)",[actor])
      const preserve=async()=>{
        const result={}
        for(const table of ['players','player_profiles','player_external_identities','player_seed_stacks','player_grower_state','nursery_occupancies']){
          const key=table==='players'?'id':'player_id'
          result[table]=(await connection.query('select row_to_json(t) as value from '+table+' t where '+key+'=$1 order by row_to_json(t)::text',[target])).rows
        }
        result.economy=(await connection.query('select cultivation_xp,breeding_xp,genetics_xp,token_balance,starter_granted_at,initialized_at from player_onboarding where player_id=$1',[target])).rows
        result.genetics=(await connection.query('select row_to_json(g) as value from genetic_profiles g join clone_lines c on c.id=g.clone_line_id where c.origin_player_id=$1 order by g.clone_line_id',[target])).rows
        return result
      }
      const before=await preserve(),oldWorld=await world.read(target),oldState=await starting.read(target)
      const [result,replay]=await Promise.all([reset.execute(actor,request),reset.execute(actor,request)])
      assert.deepEqual(result,replay);assert.deepEqual(await preserve(),before)
      assert.equal(result.retiredSpecimenIds.length,2);assert.equal(result.retiredSeedIds.length,1)
      assert.equal(result.starting.compatibilityComplete,false);assert.equal(result.starting.nameComplete,true)
      assert.equal(result.starting.spawnStage,'appearance');assert.equal(result.starting.farmStage,'undiscovered')
      assert.equal(result.starting.appearanceComplete,false);assert.equal(result.starting.spawnTutorialComplete,false);assert.equal(result.starting.farmTutorialComplete,false)
      assert.deepEqual(result.starting.ownedEquipment,[]);assert.equal(result.starting.equipment.tool,null);assert.equal(result.starting.harvestingXp,0);assert.equal(result.starting.pot,null)
      assert.ok(result.starting.revision>oldState.revision);assert.ok(result.location.revision>oldWorld.revision)
      assert.equal(result.location.areaId,'starting-spawn-tutorial');assert.deepEqual(result.location.discoveredAreaIds,['starting-spawn-tutorial']);assert.deepEqual(result.location.discoveredTravelDestinationIds,[])
      assert.deepEqual(await new StartingExperienceService(db).read(target),result.starting);assert.deepEqual(await new WorldService(db).read(target),result.location)
      await assert.rejects(world.transition(target,{v:1,travelDestinationId:'player-farm',expectedRevision:result.location.revision,commandId:crypto.randomUUID()}),e=>e.status===403)
      await assert.rejects(world.transition(target,{v:1,exitId:'to-path-1',expectedRevision:oldWorld.revision,commandId:crypto.randomUUID()}),e=>e.status===409)
      const projected=await lifecycle.getProjectionV3(target)
      assert.ok(projected.ownedSpecimens.every(p=>!result.retiredSpecimenIds.includes(p.specimenId)))
      assert.ok(projected.bredSeeds.every(s=>!result.retiredSeedIds.includes(s.seedId)))
      assert.equal(projected.nursery.slots.filter(s=>s.occupancy).length,1)
      const owner=(await connection.query('select * from player_onboarding where player_id=$1',[target])).rows[0]
      assert.equal(owner.profile_id,'starting-experience-v1');assert.equal(owner.tutorial_started_at,null);assert.equal(owner.tutorial_completed_at,null)
      const audit=(await connection.query("select payload from player_grower_events where player_id=$1 and event_type='starting-experience-reset-v1'",[target])).rows
      assert.equal(audit.length,1);assert.equal(audit[0].payload.actorPlayerId,actor);assert.equal(audit[0].payload.targetPlayerId,target)
      const legacyCommand={commandId:crypto.randomUUID(),targetPlayerId:actor,confirmPlayerId:actor,mode:'tutorial'}
      assert.equal((await new StartingExperienceService(db).read(actor)).compatibilityComplete,true)
      const legacyReset=await reset.execute(actor,legacyCommand)
      assert.equal(legacyReset.starting.compatibilityComplete,false);assert.deepEqual(legacyReset.retiredSpecimenIds,[])
      // A new replay of the lesson consumes no unrelated stacked seeds and mints no second ordinary reward.
      const seedBefore=(await connection.query('select species_id,quantity from player_seed_stacks where player_id=$1 order by species_id',[target])).rows
      await starting.execute(target,{type:'save-appearance',appearance:{skin:1,shirt:2},commandId:crypto.randomUUID()})
      await starting.execute(target,{type:'talk-guide',entityId:'mara-guide',commandId:crypto.randomUUID()})
      await starting.execute(target,{type:'equip-tool',itemId:'field-knife',commandId:crypto.randomUUID()})
      await starting.execute(target,{type:'harvest-plant',entityId:'first-san-pedro',commandId:crypto.randomUUID()})
      assert.deepEqual((await connection.query('select species_id,quantity from player_seed_stacks where player_id=$1 order by species_id',[target])).rows,seedBefore)
      assert.equal((await starting.read(target)).tutorialSeedAvailable,true)
      // Retry the old reset after new progress must never reset again.
      await reset.execute(actor,request);assert.equal((await starting.read(target)).spawnStage,'plant-pot')
    })
    await t.test('full reset requires the existing authoritative name flow, preserves public identity, and gates appearance',async()=>{
      const target=ids[0],actor=ids[1], social=new SocialService(db), reset=new StartingResetService(db,'staging')
      const before=(await connection.query('select public_id,display_name from player_profiles where player_id=$1',[target])).rows[0]
      const command={commandId:crypto.randomUUID(),targetPlayerId:target,confirmPlayerId:target,mode:'full-onboarding'}
      const result=await reset.execute(actor,command)
      assert.deepEqual(result.clearedNurserySlots,['slot-1'])
      assert.equal((await connection.query('select count(*)::int as n from nursery_occupancies where player_id=$1',[target])).rows[0].n,0,'full reset clears persisted occupancy, not just UI')
      assert.ok((await lifecycle.getProjectionV3(target)).nursery.slots.every(s=>s.occupancy===null))
      assert.equal((await lifecycle.getProjectionV3(target)).ownedSpecimens.length,0,'stale tutorial Garden material stays archived')
      assert.equal(result.starting.tutorialSeedAvailable,false);assert.equal(result.starting.farmSeedAvailable,false)
      await assert.rejects(lifecycle.collectPlant(target,crypto.randomUUID(),{slotId:'slot-1',specimenId:result.retiredSpecimenIds.at(-1),expectedOccupancyVersion:1,expectedSpecimenVersion:1}),/empty/)
      await assert.rejects(new StartingResetService(db,'production').execute(target,command),e=>e.status===404)
      assert.equal(result.starting.nameComplete,false);assert.equal((await social.overview(target)).ownProfile,null)
      assert.equal((await new StartingExperienceService(db).read(target)).nameComplete,false,'new session resumes name gate')
      await assert.rejects(starting.execute(target,{type:'save-appearance',appearance:{skin:0,shirt:0},commandId:crypto.randomUUID()}),/character name first/)
      await assert.rejects(social.execute(target,{type:'set-display-name',displayName:'Admin'}),e=>e.status===400)
      await assert.rejects(social.execute(target,{type:'set-display-name',displayName:'Starting Tester 1'}),e=>e.status===409)
      assert.equal((await starting.read(target)).nameComplete,false,'failed name cannot complete onboarding')
      const selected=await social.execute(target,{type:'set-display-name',displayName:'Fresh Reset Name'})
      assert.equal(selected.ownProfile.displayName,'Fresh Reset Name');assert.equal(selected.ownProfile.publicId,before.public_id)
      assert.equal((await starting.read(target)).nameComplete,true);assert.equal((await starting.read(target)).appearanceComplete,false)
      assert.equal((await new SocialService(db).overview(target)).ownProfile.displayName,'Fresh Reset Name')
      await reset.execute(actor,command);assert.equal((await starting.read(target)).nameComplete,true,'reset replay never clears a subsequently selected name')
      await assert.rejects(reset.execute(actor,{...command,mode:'tutorial'}),e=>e.status===409)
    })
    await t.test('reset replay reaches empty Farm with zero commodity seeds; one protected practice seed uses the real Nursery lifecycle',async()=>{
      const target=ids[0],reset=new StartingResetService(db,'staging')
      const archived=(await lifecycle.getProjectionV3(target)).ownedSpecimens
      assert.deepEqual(archived,[])
      // A later partial reset must retain the full reset's archived normal growing identities.
      await reset.execute(target,{commandId:crypto.randomUUID(),targetPlayerId:target,confirmPlayerId:target,mode:'tutorial'})
      assert.ok((await lifecycle.getProjectionV3(target)).nursery.slots.every(s=>s.occupancy===null))
      await connection.query('update player_seed_stacks set quantity=0 where player_id=$1',[target])
      const action=c=>starting.execute(target,{...c,commandId:crypto.randomUUID()})
      await action({type:'save-appearance',appearance:{skin:0,shirt:0}});await action({type:'talk-guide',entityId:'mara-guide'});await action({type:'equip-tool',itemId:'field-knife'});await action({type:'harvest-plant',entityId:'first-san-pedro'})
      assert.equal((await starting.read(target)).tutorialSeedAvailable,true)
      let stack=(await lifecycle.getProjectionV3(target)).seedStacks.find(s=>s.speciesId==='echinopsis-pachanoi')
      assert.equal(stack.quantity,0,'historical ordinary reward is not minted again')
      await assert.rejects(lifecycle.plantCommoditySeedV3(target,crypto.randomUUID(),{slotId:'slot-1',speciesId:stack.speciesId,expectedSeedStackVersion:stack.version}),/No seeds/)
      await assert.rejects(lifecycle.plantCommoditySeedV3(target,crypto.randomUUID(),{slotId:'slot-1',speciesId:stack.speciesId,expectedSeedStackVersion:stack.version,tutorial:true}),/reserved Farm tutorial seed/,'Path 1 seed cannot be used in Nursery')
      const recipient=(await connection.query('select public_id from player_profiles where player_id=$1',[ids[2]])).rows[0].public_id
      await assert.rejects(new MailService(db).execute(target,{type:'send',commandId:crypto.randomUUID(),recipientPublicId:recipient,subject:'Reserved seed',text:'Cannot send tutorial material as commodity',attachment:{kind:'commodity',speciesId:stack.speciesId,quantity:1}}))
      location=await world.read(target);await exit('to-path-1');await action({type:'plant-pot',entityId:'path-1-pot'});clock=new Date(clock.getTime()+15000);await action({type:'collect-pot',entityId:'path-1-pot'});await exit('to-cross-path-1')
      assert.equal((await starting.read(target)).farmSeedAvailable,false,'no Farm material before first physical visit')
      await exit('to-player-farm');assert.equal((await starting.read(target)).farmSeedAvailable,true)
      const empty=await lifecycle.getProjectionV3(target);assert.ok(empty.nursery.slots.every(s=>s.occupancy===null));assert.equal(empty.ownedSpecimens.length,1,'only the just-collected Path 1 specimen is present')
      stack=empty.seedStacks.find(s=>s.speciesId==='echinopsis-pachanoi');const command={slotId:'slot-1',speciesId:stack.speciesId,expectedSeedStackVersion:stack.version,tutorial:true},key=crypto.randomUUID()
      await assert.rejects(new PlantLifecycleService(db,{environment:'production'}).plantCommoditySeedV3(target,crypto.randomUUID(),{...command,speciesId:'lophophora-williamsii'}),e=>e.status===409)
      const planted=await lifecycle.plantCommoditySeedV3(target,key,command);await lifecycle.plantCommoditySeedV3(target,key,command)
      assert.equal(planted.seedStack.quantity,0);assert.equal(Date.parse(planted.slot.occupancy.readyAt)-Date.parse(planted.slot.occupancy.plantedAt),120000)
      assert.equal((await starting.read(target)).farmStage,'garden');assert.equal((await starting.read(target)).farmSeedAvailable,false)
      const p=(await connection.query('select c.origin_type from clone_lines c join plant_specimens s on c.id=s.clone_line_id where s.id=$1',[planted.slot.occupancy.specimen.specimenId])).rows[0];assert.equal(p.origin_type,'starting-experience-tutorial')
      await assert.rejects(lifecycle.plantCommoditySeedV3(target,crypto.randomUUID(),{...command,slotId:'slot-2'}),/reserved Farm tutorial seed/)
      const partial=await reset.execute(target,{commandId:crypto.randomUUID(),targetPlayerId:target,confirmPlayerId:target,mode:'tutorial'})
      assert.deepEqual(partial.clearedNurserySlots,['slot-1'],'tutorial cultivation is released in either mode')
    })
    await t.test('legacy name-only profiles and established accounts retain ordinary Social behavior',async()=>{
      const legacy=crypto.randomUUID();await connection.query('insert into players(id)values($1)',[legacy])
      const profile=await new SocialService(db).execute(legacy,{type:'set-display-name',displayName:'Legacy Name Only'})
      assert.equal(profile.ownProfile.displayName,'Legacy Name Only')
      assert.equal((await connection.query('select count(*)::int as n from player_grower_events where player_id=$1',[legacy])).rows[0].n,0)
      const old=await new SocialService(db).overview(ids[2]);assert.ok(old.ownProfile)
      assert.equal((await starting.read(ids[2])).compatibilityComplete,true)
    })
    await t.test('fresh full-app staging and production browser flow: name, appearance, authored world interactions, mobile HUD, refresh, real Farm systems', { skip: !process.env.CACTIGROW_TEST_BROWSER_EXECUTABLE && 'Set CACTIGROW_TEST_BROWSER_EXECUTABLE.', timeout:360000 }, async()=>{
      for (const environment of ['staging','production']) {const playerId=crypto.randomUUID();await connection.query('insert into players(id)values($1)',[playerId]);await verifyStartingUi({database:db,playerId,handleApiRequest,createApiRouter,environment})}
    })
  } finally { await pool.end();await connection.end();await cluster.stop() }
})
