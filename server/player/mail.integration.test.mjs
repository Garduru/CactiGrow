import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { registerHooks } from 'node:module'
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { createServer } from 'node:net'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'

const pgliteModule = process.env.CACTIGROW_PGLITE_MODULE
const embeddedModule = process.env.CACTIGROW_EMBEDDED_POSTGRES_MODULE

test('Mailbox authenticated API and real PostgreSQL escrow transactions', { skip: !pgliteModule && !embeddedModule && 'Set CACTIGROW_PGLITE_MODULE to an installed PGlite module for isolated SQL validation.' }, async (t) => {
  const hooks = pgliteModule ? registerHooks({ resolve(specifier, context, next) { return specifier === '@electric-sql/pglite' ? { url: pgliteModule, shortCircuit: true } : next(specifier, context) } }) : null
  let pg, cluster, drizzle
  if (embeddedModule) {
    const { default: EmbeddedPostgres } = await import(embeddedModule)
    const probe = createServer(); await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve))
    const port = probe.address().port; await new Promise((resolve) => probe.close(resolve))
    cluster = new EmbeddedPostgres({ databaseDir: resolve(tmpdir(), `cactigrow-mail-test-${crypto.randomUUID()}`), user: 'postgres', password: crypto.randomUUID(), port, persistent: true, postgresFlags: ['-h', '127.0.0.1'], onLog() {}, onError() {} })
    await cluster.initialise(); await cluster.start()
    await cluster.createDatabase('mail_test')
    const connection = cluster.getPgClient('mail_test', '127.0.0.1'); await connection.connect()
    pg = { query: (...args) => connection.query(...args), exec: (sql) => connection.query(sql), close: () => connection.end(), connection }
    ;({ drizzle } = await import('drizzle-orm/node-postgres'))
  } else {
    const { PGlite } = await import(pgliteModule); pg = new PGlite()
    ;({ drizzle } = await import('drizzle-orm/pglite'))
  }
  await mkdir('node_modules/.tmp', { recursive: true })
  const out = resolve('node_modules/.tmp/mail-test-bundle.mjs')
  await build({ stdin: { contents: `export { MailService } from './server/player/MailService.ts'; export { initializeStagingGrower } from './server/staging/initializeGrower.ts'; export { handleApiRequest } from './server/api/handler.ts'; export { createApiRouter } from './server/api/router.ts'; export { CactiGrowApiClient } from './src/services/api/CactiGrowApiClient.ts';`, resolveDir: process.cwd() }, bundle: true, packages: 'external', platform: 'node', format: 'esm', outfile: out })
  const { MailService, initializeStagingGrower, handleApiRequest, createApiRouter, CactiGrowApiClient } = await import(pathToFileURL(out).href)
  try {
    for (const file of (await readdir('server/db/migrations')).filter(f => f.endsWith('.sql')).sort()) await pg.exec(await readFile('server/db/migrations/' + file, 'utf8'))
    const database = drizzle(pg.connection ?? pg), ids = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()], publicIds = ids.map(() => crypto.randomUUID())
    const [a, b, c] = ids, [pa, pb, pc] = publicIds
    for (const [i, id] of ids.entries()) {
      await pg.query('insert into players(id) values($1)', [id]); await initializeStagingGrower(database, id)
      await pg.query('update player_onboarding set token_balance=1000 where player_id=$1', [id])
      await pg.query('insert into player_profiles(player_id,public_id,display_name) values($1,$2,$3)', [id, publicIds[i], 'Mailer ' + i])
    }
    // Reproduce existing gameplay grants plus only SELECT/INSERT/UPDATE on the additive mailbox.
    await pg.exec(`create role mail_runtime; grant usage on schema public to mail_runtime;
      grant select on player_profiles,player_blocks,mail_messages,player_onboarding,player_seed_stacks,plant_specimens,marketplace_listings,nursery_occupancies,player_garden_displays,player_garden_specimens,player_plant_lifecycle_versions,gameplay_command_receipts,player_grower_state,player_grower_events,clone_lines,genetic_profiles,clone_line_variants,bred_seeds,bred_seed_treatments,wild_genetic_seeds to mail_runtime;
      grant insert,update on mail_messages,player_onboarding,player_seed_stacks,plant_specimens,nursery_occupancies,player_plant_lifecycle_versions,gameplay_command_receipts,marketplace_listings,player_grower_state to mail_runtime;
      grant update on player_profiles to mail_runtime; grant insert,update,delete on player_garden_displays,player_garden_specimens to mail_runtime; grant insert on player_grower_events to mail_runtime;`)
    const router = createApiRouter({ authenticationConfigurationFactory: () => ({ identityProvider: { verify: async request => ids.includes(request.getHeader('x-test-player')) ? { provider:'test',subject:request.getHeader('x-test-player') } : null }, createPlayerIdentityResolver: async () => ({ resolve: async identity => ({ playerId:identity.subject }) }) }) })
    const errors = []
    const client = id => new CactiGrowApiClient({ baseUrl:'https://mail.test',getCredentials:()=>({'x-test-player':id}), fetch:(url,init)=>handleApiRequest(new Request(url,init), { CACTIGROW_ENVIRONMENT:'production',CACTIGROW_VERSION:'test' },undefined,{router,createRequestDatabaseContext:()=>{
      if (!cluster) return {getDatabase:async()=>database,dispose:async()=>{}}
      const connection=cluster.getPgClient('mail_test','127.0.0.1'); const ready=connection.connect().then(()=>connection.query('set role mail_runtime')).then(()=>drizzle(connection))
      return {getDatabase:()=>ready,dispose:async()=>{await ready;await connection.end()}}
    },reportUnexpectedError:e=>errors.push(e)}) })
    const ca=client(a),cb=client(b),cc=client(c)
    const send=(attachment=null,recipientPublicId=pb)=>({type:'send',commandId:crypto.randomUUID(),recipientPublicId,subject:'Hello',text:'Offline mail test',attachment})
    const balance=async id=>(await pg.query('select token_balance from player_onboarding where player_id=$1',[id])).rows[0].token_balance
    const stack=async id=>(await pg.query("select quantity from player_seed_stacks where player_id=$1 and species_id='echinopsis-pachanoi'",[id])).rows[0].quantity
    const alreadyClaimed=e=>e.status===409&&/already been claimed/.test(e.message)
    async function claimOnce(claim) {
      if(cluster) {
        const results=await Promise.allSettled([cb.mutateMail(claim),cb.mutateMail(claim)])
        assert.equal(results.filter(r=>r.status==='fulfilled').length,1)
        const rejected=results.filter(r=>r.status==='rejected')
        assert.equal(rejected.length,1);assert.ok(alreadyClaimed(rejected[0].reason))
      } else { await cb.mutateMail(claim);await assert.rejects(cb.mutateMail(claim),alreadyClaimed) }
      await assert.rejects(cb.mutateMail(claim),alreadyClaimed)
    }
    await t.test('Offline mail is persistent; unread/read state and recipient authorization',async()=>{
      const result=await ca.mutateMail(send()); assert.equal((await cb.getUnreadMailCount()).unreadCount,1)
      const inbox=await new MailService(database).mailbox(b);assert.equal(inbox.inbox[0].id,result.mailId);assert.equal(inbox.inbox[0].readAt,null)
      assert.equal(JSON.stringify(inbox).includes(a),false,'Internal UUIDs stay private')
      await assert.rejects(cc.mutateMail({type:'read',mailId:result.mailId}),e=>e.status===404)
      await cb.mutateMail({type:'read',mailId:result.mailId});await cb.mutateMail({type:'read',mailId:result.mailId})
      assert.equal((await cb.getUnreadMailCount()).unreadCount,0);assert.ok((await cb.getMailbox()).inbox[0].readAt)
      await assert.rejects(cb.mutateMail({type:'claim',mailId:result.mailId}),e=>e.status===409)
    })
    await t.test('Currency reserves once with concurrent send replay; concurrent claims deliver once',async()=>{
      const command=send({kind:'currency',quantity:100})
      const results=cluster?await Promise.all([ca.mutateMail(command),ca.mutateMail(command)]):[await ca.mutateMail(command),await ca.mutateMail(command)]
      assert.equal(results[0].mailId,results[1].mailId);assert.equal(await balance(a),900);assert.equal(await balance(b),1000)
      await assert.rejects(ca.mutateMail({...command,text:'Different'}),e=>e.code==='IDEMPOTENCY_KEY_REUSED')
      const claim={type:'claim',mailId:results[0].mailId}
      await claimOnce(claim)
      assert.equal(await balance(b),1100);assert.ok((await cb.getMailbox()).inbox.find(m=>m.id===claim.mailId).claimedAt)
      await assert.rejects(cc.mutateMail(claim),e=>e.status===404)
    })
    await t.test('Commodity attachment reserves and claims exactly once',async()=>{
      const command=send({kind:'commodity',speciesId:'echinopsis-pachanoi',quantity:2})
      const receipt=await ca.mutateMail(command);await ca.mutateMail(command);assert.equal(await stack(a),2);assert.equal(await stack(b),4)
      const claim={type:'claim',mailId:receipt.mailId};await claimOnce(claim)
      assert.equal(await stack(b),6)
    })
    await t.test('Invalid quantities, insufficient funds/inventory and self mail never debit',async()=>{
      for(const attachment of [{kind:'currency',quantity:1000},{kind:'commodity',speciesId:'echinopsis-pachanoi',quantity:3}])await assert.rejects(ca.mutateMail(send(attachment)),e=>e.status===409)
      for(const attachment of [{kind:'currency',quantity:-1},{kind:'currency',quantity:1.5},{kind:'currency',quantity:1000001},{kind:'commodity',speciesId:'unsupported',quantity:1}])await assert.rejects(ca.mutateMail(send(attachment)),e=>e.status===400)
      await assert.rejects(ca.mutateMail(send(null,pa)),e=>e.status===400);assert.equal(await balance(a),900);assert.equal(await stack(a),2)
      await assert.rejects(client('invalid').getMailbox(),e=>e.status===401)
    })
    async function specimen(favorite=false,listed=false) {
      const id=crypto.randomUUID(),line=crypto.randomUUID()
      await pg.query("insert into clone_lines(id,species_id,origin_type,origin_player_id,established_at,genetic_representation_version,visual_derivation_version) values($1,'echinopsis-pachanoi','commodity-seed',$2,now(),1,1)",[line,a])
      await pg.query('insert into genetic_profiles(clone_line_id,vigor,growth_speed,size,flowering,mutation_chance,establishment_rule_version) values($1,50,51,52,53,54,1)',[line])
      await pg.query("insert into clone_line_variants(clone_line_id,variant_id,origin,established_at) values($1,'shiny','random',now())",[line])
      await pg.query("insert into plant_specimens(id,owner_player_id,clone_line_id,source_type,lifecycle_status,planted_at,collected_at,visual_derivation_version) values($1,$2,$3,'commodity-seed','owned',now(),now(),1)",[id,a,line])
      await pg.query('insert into player_garden_specimens(player_id,specimen_id,favorite,tags) values($1,$2,$3,$4)',[a,id,favorite,JSON.stringify(['mail tag'])])
      if(listed)await pg.query("insert into marketplace_listings(id,seller_player_id,specimen_id,asking_price,status,created_at) values($1,$2,$3,25,'active',now())",[crypto.randomUUID(),a,id])
      return id
    }
    await t.test('Favorite, listed and unowned specimens are rejected',async()=>{
      for(const id of [await specimen(true),await specimen(false,true)])await assert.rejects(ca.mutateMail(send({kind:'specimen',specimenId:id})),e=>e.status===409)
      const id=await specimen();await assert.rejects(cc.mutateMail(send({kind:'specimen',specimenId:id})),e=>e.status===409)
    })
    await t.test('Specimen escrow blocks sale/listing/favorite/breeding; claim preserves identity, genetics, metadata and player knowledge',async()=>{
      const id=await specimen(),twin=await specimen(),before=(await pg.query('select * from plant_specimens where id=$1',[id])).rows[0]
      const researchBefore=(await pg.query('select player_id,research from player_grower_state order by player_id')).rows
      const receipt=await ca.mutateMail(send({kind:'specimen',specimenId:id}))
      assert.equal((await ca.getPlantLifecycleV3()).ownedSpecimens.some(p=>p.specimenId===id),false)
      await assert.rejects(ca.mutateMail(send({kind:'specimen',specimenId:id})),e=>e.status===409)
      for(const type of ['sell-specimen-to-npc','list-specimen'])await assert.rejects(ca.mutateGrowerAlpha({type,commandId:crypto.randomUUID(),specimenId:id,...(type==='list-specimen'?{askingPrice:25}:{})}),e=>e.status===409)
      await assert.rejects(ca.mutateGarden({type:'favorite',commandId:crypto.randomUUID(),specimenId:id,favorite:true}),e=>e.status===409)
      await assert.rejects(ca.breedSpecimens({parent1SpecimenId:id,parent2SpecimenId:twin,expectedParent1Version:1,expectedParent2Version:1},crypto.randomUUID()),e=>e.status===409)
      const claim={type:'claim',mailId:receipt.mailId};await claimOnce(claim)
      const after=(await pg.query('select * from plant_specimens where id=$1',[id])).rows[0]
      assert.equal(after.owner_player_id,b);assert.equal(after.version,before.version+1)
      for(const key of ['id','clone_line_id','source_type','planted_at','collected_at','visual_derivation_version','created_at'])assert.deepEqual(after[key],before[key])
      const projection=(await cb.getPlantLifecycleV3()).ownedSpecimens.find(p=>p.specimenId===id);assert.equal(projection.genetics.growthSpeed,51);assert.equal(projection.specialVariants[0].variantId,'shiny')
      assert.deepEqual((await cb.getGarden()).organization[id].tags,['mail tag'])
      assert.deepEqual((await pg.query('select player_id,research from player_grower_state order by player_id')).rows,researchBefore)
      assert.equal((await pg.query('select count(*)::int as total from plant_specimens where id=$1',[id])).rows[0].total,1)
    })
    await t.test('Both block directions reject new mail; existing escrow remains claimable after blocking',async()=>{
      const receipt=await cc.mutateMail(send({kind:'currency',quantity:1},pb))
      await pg.query('insert into player_blocks(blocker_player_id,blocked_player_id) values($1,$2)',[b,c])
      await assert.rejects(cc.mutateMail(send(null,pb)),e=>e.status===409);await assert.rejects(cb.mutateMail(send(null,pc)),e=>e.status===409)
      await cb.mutateMail({type:'claim',mailId:receipt.mailId})
    })
    await t.test('Recipient capacity failure preserves escrow and allows a later exactly-once claim',async()=>{
      for(const kind of ['currency','commodity']){
        const original=kind==='currency'?await balance(b):await stack(b)
        const receipt=await ca.mutateMail(send(kind==='currency'?{kind,quantity:1}:{kind,speciesId:'echinopsis-pachanoi',quantity:1}))
        const update=kind==='currency'?'update player_onboarding set token_balance=$1 where player_id=$2':"update player_seed_stacks set quantity=$1 where player_id=$2 and species_id='echinopsis-pachanoi'"
        await pg.query(update,[2147483647,b])
        const claim={type:'claim',mailId:receipt.mailId}
        await assert.rejects(cb.mutateMail(claim),e=>e.status===409&&/cannot receive/.test(e.message))
        assert.equal((await pg.query('select claimed_at from mail_messages where id=$1',[receipt.mailId])).rows[0].claimed_at,null)
        await pg.query(update,[original,b]);await cb.mutateMail(claim);await assert.rejects(cb.mutateMail(claim),alreadyClaimed)
        assert.equal(kind==='currency'?await balance(b):await stack(b),original+1)
      }
    })
    await t.test('Competing sends cannot overdraw; rate bounds serialize under sender profile lock',async()=>{
      await pg.query('update player_onboarding set token_balance=1000 where player_id=$1',[a])
      const sends=[send({kind:'currency',quantity:700},pb),send({kind:'currency',quantity:700},pc)]
      const results=cluster?await Promise.allSettled(sends.map(s=>ca.mutateMail(s))):await Promise.all(sends.map(async s=>{try{return{status:'fulfilled',value:await ca.mutateMail(s)}}catch(reason){return{status:'rejected',reason}}}))
      assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(await balance(a),300)
      // Space prior successful sends outside the test window without changing valuables.
      await pg.query("update mail_messages set sent_at=now()-interval '2 minutes' where sender_player_id=$1",[a])
      for(let i=0;i<10;i++)await ca.mutateMail(send())
      await assert.rejects(ca.mutateMail(send()),e=>e.status===409&&/limit/.test(e.message))
    })
    await t.test('Rollout command applies only 0007, refuses reruns and verifies narrow grants on a disposable environment database', {skip:!cluster}, async()=>{
      await cluster.createDatabase('cactigrow_staging')
      const owner=cluster.getPgClient('cactigrow_staging','127.0.0.1');await owner.connect()
      try {
        const migrations=(await readdir('server/db/migrations')).filter(f=>f.endsWith('.sql')&&f.slice(0,4)<'0007').sort()
        for(const file of migrations)await owner.query(await readFile('server/db/migrations/'+file,'utf8'))
        await owner.query('create schema drizzle; create table drizzle.__drizzle_migrations(id serial primary key, hash text not null, created_at bigint); create role cactigrow_staging_runtime; grant usage on schema public to cactigrow_staging_runtime; revoke create on schema public from public;')
        const journal=JSON.parse(await readFile('server/db/migrations/meta/_journal.json','utf8'))
        for(const file of migrations){const text=await readFile('server/db/migrations/'+file,'utf8');const entry=journal.entries.find(e=>e.tag===file.slice(0,-4));await owner.query('insert into drizzle.__drizzle_migrations(hash,created_at) values($1,$2)',[createHash('sha256').update(text).digest('hex'),entry.when])}
        const sentinel=crypto.randomUUID();await owner.query('insert into players(id) values($1)',[sentinel])
        const config=owner.connectionParameters
        const url=new URL('postgresql://127.0.0.1');url.port=String(config.port);url.username=config.user;url.password=config.password;url.pathname='/cactigrow_staging'
        const run=flags=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,['--experimental-strip-types','scripts/mail-rollout.ts','--environment','staging',...flags],{env:{...process.env,CACTIGROW_OWNER_DATABASE_URL:url.href},stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);child.on('error',reject);child.on('close',code=>resolve({code,output}))})
        assert.equal((await run(['--apply-migration'])).code,1)
        assert.equal((await run(['--verify'])).code,1)
        const ensured=await run(['--ensure','--confirm-database','cactigrow_staging']);assert.equal(ensured.code,0,ensured.output)
        assert.equal((await run(['--apply-migration','--confirm-database','cactigrow_staging'])).code,1)
        const repeated=await run(['--ensure','--confirm-database','cactigrow_staging']);assert.equal(repeated.code,0,repeated.output);assert.doesNotMatch(repeated.output,/Applied/)
        assert.equal((await run(['--apply-grants','--confirm-database','cactigrow_staging'])).code,0)
        assert.equal((await run(['--verify'])).code,0)
        assert.equal((await owner.query('select count(*)::int as total from players where id=$1',[sentinel])).rows[0].total,1)
        assert.equal((await owner.query('select count(*)::int as total from drizzle.__drizzle_migrations')).rows[0].total,migrations.length+1)
      }finally{await owner.end()}
    })
    assert.deepEqual(errors,[])
  } finally { await pg.close(); if(cluster)await cluster.stop();hooks?.deregister() }
})
