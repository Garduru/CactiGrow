import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { readFile, readdir, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { createServer } from 'node:net'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { findArea } from '../../shared/world/world.ts'
import { isExplorationCommandV1, isExplorationResultV1 } from '../../shared/api/explorationV1.ts'
import { isPlantLifecycleProjectionV3 } from '../../shared/api/plantLifecycleV3.ts'
import { isMailAttachment } from '../../shared/api/mailV1.ts'
import { isGrowerAlphaCommandV1 } from '../../shared/api/growerAlphaV1.ts'
import { verifyWildGeneticsUi } from './wildGeneticsUi.mjs'
import { reconcilePlanting } from '../../src/app/reconcilePlanting.ts'

for (const environment of ['staging','production']) test(`${environment}: Wild genetics uses actual PostgreSQL, lifecycle, research and breeding with authoritative harvest receipts`, { skip: !process.env.CACTIGROW_EMBEDDED_POSTGRES_MODULE && 'Set CACTIGROW_EMBEDDED_POSTGRES_MODULE.' }, async t => {
  const { default: EmbeddedPostgres } = await import(process.env.CACTIGROW_EMBEDDED_POSTGRES_MODULE)
  const probe = createServer(); await new Promise(r => probe.listen(0, '127.0.0.1', r)); const port = probe.address().port; await new Promise(r => probe.close(r))
  const password = crypto.randomUUID(), cluster = new EmbeddedPostgres({ databaseDir: resolve(tmpdir(), `cactigrow-wild-${crypto.randomUUID()}`), user: 'postgres', password, port, persistent: true, postgresFlags: ['-h', '127.0.0.1'], onLog() {}, onError() {} })
  await cluster.initialise(); await cluster.start(); await cluster.createDatabase('wild_test')
  const connection = cluster.getPgClient('wild_test', '127.0.0.1'); await connection.connect()
  const { Pool } = await import('pg'), pool = new Pool({ host: '127.0.0.1', port, user: 'postgres', password, database: 'wild_test', max: 6 })
  try {
    for (const file of (await readdir('server/db/migrations')).filter(f => f.endsWith('.sql')).sort()) await connection.query(await readFile('server/db/migrations/' + file, 'utf8'))
    await mkdir('node_modules/.tmp', { recursive: true }); const out = resolve('node_modules/.tmp/wild-genetics-db.mjs')
    await build({ stdin: { contents: `export {ExplorationService} from './server/exploration/ExplorationService.ts'; export {StartingExperienceService} from './server/starting/StartingExperienceService.ts'; export {WorldService} from './server/world/WorldService.ts'; export {initializeStagingGrower} from './server/staging/initializeGrower.ts'; export {PlantLifecycleService} from './server/gameplay/PlantLifecycleService.ts'; export {GrowerAlphaService} from './server/gameplay/GrowerAlphaService.ts'; export {MarketplaceService} from './server/gameplay/MarketplaceService.ts'; export {MailService} from './server/player/MailService.ts'; export {GardenService} from './server/gameplay/GardenService.ts'; export {createApiRouter} from './server/api/router.ts'; export {handleApiRequest} from './server/api/handler.ts'; export {WILD_SOURCES,resolveWildSeed,resolveWildFind} from './server/exploration/wildSources.ts';`, resolveDir: process.cwd() }, bundle: true, packages: 'external', platform: 'node', format: 'esm', outfile: out })
    const { ExplorationService, StartingExperienceService, WorldService, initializeStagingGrower, PlantLifecycleService, GrowerAlphaService, MarketplaceService, MailService, GardenService, createApiRouter, handleApiRequest, WILD_SOURCES, resolveWildSeed, resolveWildFind } = await import(pathToFileURL(out).href)
    const { drizzle } = await import('drizzle-orm/node-postgres'), db = drizzle(pool), [a, b] = [crypto.randomUUID(), crypto.randomUUID()]
    for (const [index, id] of [a, b].entries()) {
      await connection.query('insert into players(id)values($1)', [id]); await initializeStagingGrower(db, id, false)
      await connection.query('insert into player_profiles(player_id,public_id,display_name)values($1,$2,$3)', [id, crypto.randomUUID(), 'Wild Tester ' + index])
    }
    // Match existing cultivation grants plus only SELECT/INSERT/UPDATE on the new table.
    await connection.query(`create role wild_runtime; grant usage on schema public to wild_runtime; grant select on all tables in schema public to wild_runtime;
      grant insert,update on player_onboarding,player_seed_stacks,player_plant_lifecycle_versions,player_grower_state,gameplay_command_receipts,nursery_occupancies,plant_specimens,bred_seeds,wild_genetic_seeds,marketplace_listings,mail_messages to wild_runtime;
      grant insert on player_grower_events,clone_lines,genetic_profiles,clone_line_variants to wild_runtime;
      grant update on player_profiles to wild_runtime;
      grant delete on nursery_occupancies,player_garden_displays,player_garden_specimens to wild_runtime;`)
    pool.on('connect', client => { void client.query('set role wild_runtime') }); await pool.query('set role wild_runtime')
    let clock = new Date(Date.now() + 60_000), rarityRolls = 0, geneticRandom = 0.5
    const positions = new Map(), authority = { async read(id, location) { return { v: 1, ...location, runtimeAreaId: location.areaId, worldRevision: location.revision, revision: 1, position: positions.get(id) ?? location.position, accepted: true } } }
    const service = () => new ExplorationService(db, { environment, now: () => clock, movement: authority, rollYield: () => 6, random: () => { rarityRolls++; return geneticRandom } })
    const starting = new StartingExperienceService(db, () => clock), world = new WorldService(db), lifecycle = () => new PlantLifecycleService(db, { environment, now: () => clock }), grower = new GrowerAlphaService(db, () => clock)
    const advance = (ms = 60_000) => { clock = new Date(clock.getTime() + ms) }
    const routeTo = (from, to) => {
      const queue = [[from, []]], seen = new Set([from])
      while (queue.length) { const [current, route] = queue.shift(); if (current === to) return route; for (const exit of findArea(current).exits) if (!exit.blocked && exit.targetAreaId && !seen.has(exit.targetAreaId)) { seen.add(exit.targetAreaId); queue.push([exit.targetAreaId, [...route, exit.exitId]]) } }
      throw Error('No authored route')
    }
    const enter = async (id, areaId) => { let location = await world.read(id); for (const exitId of routeTo(location.areaId, areaId)) location = await world.transition(id, { v: 1, commandId: crypto.randomUUID(), exitId, expectedRevision: location.revision }); return location }
    const cmd = (location, node, type = 'harvest') => ({ v: 1, commandId: crypto.randomUUID(), type, expectedWorldRevision: location.revision, position: { x: node.x, y: node.y }, ...(type === 'discover-landmark' ? { landmarkId: node.landmarkId } : { entityId: node.entityId }) })
    const force = async (id, outcome) => { const state = await service().read(id); return new ExplorationService(db,{environment:'staging',now:()=>clock}).reset(id, { v: 1, commandId: crypto.randomUUID(), type: 'force-wild-outcome', expectedRevision: state.projection.revision, outcome }) }
    const resetCooldown = async id => { const state = await service().read(id); return new ExplorationService(db,{environment:'staging',now:()=>clock}).reset(id, { v: 1, commandId: crypto.randomUUID(), type: 'reset-cooldowns', expectedRevision: state.projection.revision }) }
    const quantity = async (id, species) => (await connection.query('select quantity from player_seed_stacks where player_id=$1 and species_id=$2', [id, species])).rows[0]?.quantity ?? 0
    for (const id of [a, b]) { await service().read(id); await starting.execute(id, { type: 'equip-tool', itemId: 'field-knife', commandId: crypto.randomUUID() }) }
    let location = await enter(a, 'cross-path-1'), node = findArea(location.areaId).interactables.find(n => n.entityId === 'cross-wild-san-pedro')
    positions.set(a, node); positions.set(b, node)
    let lot, firstHarvest, planted, collected

    await t.test('1-2 normal harvest preserves exact commodity quantity and XP', async () => {
      await force(a, 'normal'); const before = await quantity(a, node.speciesId), result = await service().execute(a, cmd(location, node))
      assert.deepEqual(result.reward, { name: node.displayName, speciesId: node.speciesId, quantity: 6, harvestingXp: 10 }); assert.equal(await quantity(a, node.speciesId), before + 6)
    })
    await t.test('3-5 server controls rarity and accepts only actual authoritative proximity', async () => {
      const command = cmd(location, node)
      for (const key of ['rarity', 'outcome', 'geneticLot', 'quantity', 'specialReward']) assert.equal(isExplorationCommandV1({ ...command, [key]: 'rare' }), false)
      await resetCooldown(a); await starting.execute(a, { type: 'equip-tool', itemId: null, commandId: crypto.randomUUID() }); const noToolRolls = rarityRolls
      await assert.rejects(service().execute(a, command), /Field Knife/); assert.equal(rarityRolls, noToolRolls)
      await starting.execute(a, { type: 'equip-tool', itemId: 'field-knife', commandId: crypto.randomUUID() })
      await resetCooldown(a); await force(a, 'rare'); positions.set(a, { x: node.x + 1000, y: node.y }); const before = rarityRolls
      await assert.rejects(service().execute(a, command), /Approach/); assert.equal(rarityRolls, before)
      positions.set(a, node)
      const legacy = new ExplorationService(db, { environment, now: () => new Date(clock.getTime() + 999999), rollYield: () => 6, random: () => { throw Error('must not roll without authority') } })
      const noAuthority = await legacy.execute(a, command); assert.equal(noAuthority.reward.geneticLot, undefined)
      await resetCooldown(a)
    })
    await t.test('6-9 rare receipt is exactly once, stable provenance and persistent clone identity', async () => {
      firstHarvest = cmd(location, node); const [one, two] = await Promise.all([service().execute(a, firstHarvest), service().execute(a, firstHarvest)])
      lot = one.reward.geneticLot; assert.ok(lot); assert.deepEqual(two.reward, one.reward); assert.equal(isExplorationResultV1(one), true)
      assert.equal(lot.provenance.sourceNodeId, node.entityId); assert.equal(lot.provenance.areaId, location.areaId); assert.equal(lot.provenance.rarity, 'rare'); assert.equal(lot.quantity, 3)
      const before = rarityRolls; assert.deepEqual((await service().execute(a, firstHarvest)).reward, one.reward); assert.equal(rarityRolls, before)
      assert.equal((await connection.query("select count(*)::int n from player_grower_events where player_id=$1 and source_command_id=$2 and event_type='wild-genetic-harvest-receipt-v1'", [a, firstHarvest.commandId])).rows[0].n, 1)
      const rows = (await connection.query('select * from wild_genetic_seeds where lot_id=$1', [lot.lotId])).rows; assert.equal(rows.length, 3); assert.equal(new Set(rows.map(s => s.clone_line_id)).size, 3)
      await assert.rejects(service().execute(a, { ...firstHarvest, position: { x: node.x + 1, y: node.y } }), /already used/)
      const inventory = await lifecycle().getProjectionV3(a); assert.equal(isPlantLifecycleProjectionV3(inventory), true); assert.deepEqual(inventory.wildSeedLots[0], lot); assert.equal('genetics' in inventory.wildSeedLots[0], false)
    })
    await t.test('10-12 normal Nursery growth preserves resolved genes and provenance across restart and collection', async () => {
      const seed = (await connection.query('select clone_line_id,genetic_features from wild_genetic_seeds where id=$1', [lot.seedIds[0]])).rows[0], genetics = (await connection.query('select * from genetic_profiles where clone_line_id=$1', [seed.clone_line_id])).rows[0]
      const before = await lifecycle().getProjectionV3(a), key = crypto.randomUUID(); const [one, two] = await Promise.all([lifecycle().plantWildSeedV3(a, key, { slotId: 'slot-1', seedId: lot.seedIds[0] }), lifecycle().plantWildSeedV3(a, key, { slotId: 'slot-1', seedId: lot.seedIds[0] })]); planted = one; assert.deepEqual(two, one)
      await assert.rejects(lifecycle().plantWildSeedV3(a, crypto.randomUUID(), { slotId: 'slot-2', seedId: lot.seedIds[0] }), /already been planted/)
      const reconciled = reconcilePlanting(before, planted); assert.equal(reconciled.wildSeedLots[0].quantity, 2); assert.deepEqual(reconciled.seedStacks, before.seedStacks); assert.deepEqual(reconciled.bredSeeds, before.bredSeeds)
      const occupancy = planted.slot.occupancy; assert.equal(occupancy.specimen.cloneLineId, seed.clone_line_id); assert.deepEqual(occupancy.specimen.wildOrigin, lot.provenance); assert.deepEqual(occupancy.specimen.geneticFeatures, seed.genetic_features)
      assert.equal(occupancy.specimen.genetics.vigor, genetics.vigor); assert.equal(Date.parse(occupancy.readyAt) - Date.parse(occupancy.plantedAt), (environment === 'production' ? 300000 : 120000))
      await assert.rejects(lifecycle().plantWildSeedV3(b, crypto.randomUUID(), { slotId: 'slot-2', seedId: lot.seedIds[1] }), /not owned/)
      await assert.rejects(lifecycle().collectPlantV3(a, crypto.randomUUID(), { slotId: 'slot-1', specimenId: occupancy.specimen.specimenId, expectedOccupancyVersion: 1, expectedSpecimenVersion: 1 }), /ready|mature/i)
      const reload = await lifecycle().getProjectionV3(a); assert.deepEqual(reload.nursery.slots[0].occupancy.specimen, occupancy.specimen); assert.equal(reload.wildSeedLots[0].quantity, 2)
      advance((environment === 'production' ? 300000 : 120000)); collected = (await lifecycle().collectPlantV3(a, crypto.randomUUID(), { slotId: 'slot-1', specimenId: occupancy.specimen.specimenId, expectedOccupancyVersion: 1, expectedSpecimenVersion: 1 })).specimen
      assert.deepEqual(collected.genetics, occupancy.specimen.genetics); assert.deepEqual(collected.wildOrigin, lot.provenance); assert.deepEqual(collected.geneticFeatures, occupancy.specimen.geneticFeatures)
    })
    await t.test('13-15 real Research, Collection and Breeding consume actual wild genotype', async () => {
      const observed = await grower.execute(a, { type: 'observe-specimen', commandId: crypto.randomUUID(), specimenId: collected.specimenId }); assert.ok(observed.research.records[collected.cloneLineId]); assert.notEqual(observed.research.records[collected.cloneLineId].analysisDepth, 'fully-characterized')
      const projection = await lifecycle().getProjectionV3(a); assert.equal(projection.ownedSpecimens.some(s => s.specimenId === collected.specimenId && s.wildOrigin.sourceNodeId === node.entityId), true)
      const sibling = await lifecycle().plantWildSeedV3(a, crypto.randomUUID(), { slotId: 'slot-2', seedId: lot.seedIds[1] }); advance((environment === 'production' ? 300000 : 120000))
      const second = (await lifecycle().collectPlantV3(a, crypto.randomUUID(), { slotId: 'slot-2', specimenId: sibling.slot.occupancy.specimen.specimenId, expectedOccupancyVersion: 1, expectedSpecimenVersion: 1 })).specimen
      const bred = await lifecycle().breedSpecimens(a, crypto.randomUUID(), { parent1SpecimenId: collected.specimenId, parent2SpecimenId: second.specimenId, expectedParent1Version: collected.version, expectedParent2Version: second.version })
      assert.deepEqual(bred.seed.parentPlantIds, [collected.specimenId, second.specimenId]); assert.notEqual(bred.seed.cloneLineId, collected.cloneLineId)
    })
    await t.test('16 siblings use existing inheritance variation, bounded stats and independent Shiny probability', async () => {
      let n = 0; const random = () => ((++n * 37) % 997) / 997, source = WILD_SOURCES[0]
      const siblings = Array.from({ length: 20 }, () => resolveWildSeed(source, 'rare', clock, random)); assert.ok(new Set(siblings.map(s => JSON.stringify(s.genetics))).size > 1)
      for (const s of siblings) assert.ok(Object.values(s.genetics).every(v => Number.isInteger(v) && v >= 0 && v <= 100))
      assert.ok(siblings.some(s => s.geneticFeatures.some(f => f.featureId === 'variegation')))
      assert.equal(resolveWildFind(() => 0), 'rare'); assert.equal(resolveWildFind(() => 0.01), 'uncommon'); assert.equal(resolveWildFind(() => 0.09), 'normal')
      assert.throws(() => resolveWildFind(() => 1), /Invalid/)
    })
    await t.test('17-19 Shop, Marketplace and Mail cannot create or flatten a wild lot', async () => {
      await assert.rejects(grower.execute(a, { type: 'buy-shop-seeds', commandId: crypto.randomUUID(), itemId: lot.lotId, quantity: 1 }), /catalog|available|item/i)
      await assert.rejects(grower.execute(a, { type: 'list-specimen', commandId: crypto.randomUUID(), specimenId: lot.seedIds[2], askingPrice: 1 }), /not found/i)
      assert.equal(isGrowerAlphaCommandV1({ type: 'list-wild-seed-lot', commandId: crypto.randomUUID(), lotId: lot.lotId, askingPrice: 1 }), false)
      assert.equal(isMailAttachment({ kind: 'wild-seed-lot', lotId: lot.lotId }), false); assert.equal(isMailAttachment({ kind: 'commodity', speciesId: node.speciesId, quantity: 1, lotId: lot.lotId }), false)
    })
    await t.test('20-21 cooldown blocks rerolls and resources remain player-personal', async () => {
      // Production growth can outlast the original harvest cooldown. Establish a fresh one.
      await resetCooldown(a); await force(a, 'normal'); await service().execute(a, cmd(location, node))
      const before = rarityRolls; await assert.rejects(service().execute(a, cmd(location, node)), /recovering/); assert.equal(rarityRolls, before)
      const bLocation = await enter(b, location.areaId); await force(b, 'uncommon'); const result = await service().execute(b, cmd(bLocation, node)); assert.equal(result.reward.geneticLot.provenance.rarity, 'uncommon'); assert.notEqual(result.reward.geneticLot.lotId, lot.lotId)
    })
    await t.test('22 Field Survey remains based on legitimate ordinary harvests, never rare RNG', async () => {
      const record = await service().read(a); assert.ok(record.fieldSurvey); assert.equal(JSON.stringify(record.fieldSurvey).includes(lot.lotId), false)
      assert.equal(record.reward, undefined)
    })
    await t.test('23 production Dev Tools reject before auth/database', async () => {
      let opens = 0; const router = createApiRouter(), env = { CACTIGROW_ENVIRONMENT: 'production', CACTIGROW_VERSION: 'test' }
      for (const path of ['/api/v1/dev/wild-genetics', '/api/v1/dev/exploration']) {
        const response = await handleApiRequest(new Request('https://wild.test' + path, { method: path.includes('commands') ? 'POST' : 'GET' }), env, undefined, { router, createRequestDatabaseContext: () => ({ getDatabase: async () => { opens++; throw Error('must not acquire') }, dispose: async () => {} }) }); assert.equal(response.status, 404)
      }
      assert.equal(opens, 0)
    })
    await t.test('special authored sources give at most one lot per player, discovery gives no seeds', async () => {
      location = await enter(a, 'the-first-basin'); const area = findArea(location.areaId), source = WILD_SOURCES.find(s => s.special && s.speciesId === 'lophophora-williamsii'); node = area.interactables.find(n => n.entityId === source.nodeId)
      const landmark = area.landmarks.find(l => l.landmarkId === source.landmarkId); positions.set(a, landmark)
      const before = (await connection.query('select count(*)::int n from wild_genetic_seeds where owner_player_id=$1', [a])).rows[0].n
      const discovered = await service().execute(a, cmd(location, landmark, 'discover-landmark')); assert.ok(discovered.projection.populations.some(p => p.populationId === source.populationId && p.observedAt && !p.collectedAt))
      assert.equal((await connection.query('select count(*)::int n from wild_genetic_seeds where owner_player_id=$1', [a])).rows[0].n, before)
      positions.set(a, node); await force(a, 'rare'); const result = await service().execute(a, cmd(location, node)); assert.ok(result.reward.geneticLot); assert.equal(result.reward.geneticLot.speciesId, 'lophophora-williamsii')
      await resetCooldown(a); await force(a, 'rare'); const repeated = await service().execute(a, cmd(location, node)); assert.equal(repeated.reward.geneticLot, undefined); assert.equal(repeated.reward.quantity, 6)
      assert.ok((await service().read(a)).projection.populations.some(p => p.populationId === source.populationId && p.collectedAt))
    })
    await t.test('persistence failure rolls back lot, genetic identity, receipt, seeds, XP and cooldown', async () => {
      await resetCooldown(a); node = findArea(location.areaId).interactables.find(n => n.entityId === 'basin-san-pedro-entrance'); positions.set(a, node); await force(a, 'rare')
      const command = cmd(location, node), before = await quantity(a, node.speciesId), state = await service().read(a), count = (await connection.query('select count(*)::int n from wild_genetic_seeds')).rows[0].n
      await connection.query(`create function reject_wild_receipt()returns trigger language plpgsql as $$begin if new.event_type='first-basin-exploration-checkpoint-v1' and new.source_command_id='${command.commandId}'::uuid then raise exception 'isolated wild rollback'; end if; return new; end$$; create trigger reject_wild_receipt before insert on player_grower_events for each row execute function reject_wild_receipt();`)
      await assert.rejects(service().execute(a, command), e => /isolated wild rollback/.test(e.cause?.message)); await connection.query('drop trigger reject_wild_receipt on player_grower_events; drop function reject_wild_receipt()')
      assert.equal(await quantity(a, node.speciesId), before); assert.equal((await connection.query('select count(*)::int n from wild_genetic_seeds')).rows[0].n, count); assert.deepEqual((await service().read(a)).projection, state.projection)
    })
    await t.test('actual Inventory, Nursery picker, Details and Collection render provenance without hidden seed genes', async () => {
      await verifyWildGeneticsUi(await lifecycle().getProjectionV3(a), await grower.project(a), await new GardenService(db).project(a))
    })
    await t.test('grown wild specimens retain genotype and provenance through existing Marketplace and Mail transfers', async () => {
      const listing = await grower.execute(a, { type: 'list-specimen', commandId: crypto.randomUUID(), specimenId: collected.specimenId, askingPrice: 1 })
      const id = listing.marketplaceListings.find(l => l.plantId === collected.specimenId && l.status === 'active').id
      const browse = await new MarketplaceService(db).browse(b); assert.ok(browse.listings.some(l => l.id === id)); assert.equal(browse.listings.find(l => l.id === id).knowledge.carrierFeatures.length, 0)
      await connection.query('update player_onboarding set token_balance=10 where player_id=$1', [b])
      await grower.execute(b, { type: 'buy-marketplace-listing', commandId: crypto.randomUUID(), listingId: id })
      const received = (await lifecycle().getProjectionV3(b)).ownedSpecimens.find(s => s.specimenId === collected.specimenId)
      assert.deepEqual(received.genetics, collected.genetics); assert.deepEqual(received.geneticFeatures, collected.geneticFeatures); assert.deepEqual(received.wildOrigin, collected.wildOrigin)
      assert.equal((await grower.project(b)).research.records[collected.cloneLineId], undefined)
      const recipient = (await connection.query('select public_id from player_profiles where player_id=$1', [a])).rows[0].public_id, mail = new MailService(db)
      const sent = await mail.execute(b, { type: 'send', commandId: crypto.randomUUID(), recipientPublicId: recipient, subject: 'Wild specimen', text: 'Disposable transfer fixture', attachment: { kind: 'specimen', specimenId: collected.specimenId } })
      await mail.execute(a, { type: 'claim', mailId: sent.mailId })
      const returned = (await lifecycle().getProjectionV3(a)).ownedSpecimens.find(s => s.specimenId === collected.specimenId)
      assert.deepEqual(returned.geneticFeatures, collected.geneticFeatures); assert.deepEqual(returned.wildOrigin, collected.wildOrigin); assert.ok((await grower.project(a)).research.records[collected.cloneLineId])
    })
    await t.test(`${environment} rollout applies only 0008 once, preserves existing rows/tracking and rejects other targets`, async () => {
      const database = environment === 'production' ? 'cactigrow' : 'cactigrow_staging', runtime = database + '_runtime', ownerRole = database + '_owner', script = environment === 'production' ? 'scripts/wild-genetics-production-rollout.ts' : 'scripts/wild-genetics-rollout.ts'
      await cluster.createDatabase(database); const owner = cluster.getPgClient(database, '127.0.0.1'); await owner.connect()
      try {
        const files = (await readdir('server/db/migrations')).filter(f => f.endsWith('.sql') && f.slice(0, 4) < '0008').sort()
        const journal = JSON.parse(await readFile('server/db/migrations/meta/_journal.json', 'utf8'))
        for (const file of files) await owner.query(await readFile('server/db/migrations/' + file, 'utf8'))
        await owner.query(`create schema drizzle; create table drizzle.__drizzle_migrations(id serial primary key,hash text not null,created_at bigint);create role ${runtime};grant usage on schema public to ${runtime};revoke create on schema public from public;`)
        for (const file of files) { const sql = await readFile('server/db/migrations/' + file, 'utf8'), entry = journal.entries.find(e => e.tag === file.slice(0, -4)); await owner.query('insert into drizzle.__drizzle_migrations(hash,created_at)values($1,$2)', [createHash('sha256').update(sql).digest('hex'), entry.when]) }
        const sentinel = crypto.randomUUID(); await owner.query('insert into players(id)values($1)', [sentinel])
        const config = owner.connectionParameters, url = new URL('postgresql://127.0.0.1'); url.port = String(config.port); url.username = ownerRole; url.password = config.password; url.pathname = '/' + database
        const roleSql = await owner.query("select format('create role %I login superuser password %L',$1::text,$2::text) as sql", [ownerRole, config.password]); await owner.query(roleSql.rows[0].sql)
        const run = (flags, connectionUrl = url.href, approval = '0008') => new Promise((resolve, reject) => { const child = spawn(process.execPath, ['--experimental-strip-types', script, ...flags], { env: { ...process.env, CACTIGROW_OWNER_DATABASE_URL: connectionUrl, CACTIGROW_PRODUCTION_MIGRATION_CONFIRM: approval }, stdio: ['ignore', 'pipe', 'pipe'] }); let output = ''; child.stdout.on('data', chunk => output += chunk); child.stderr.on('data', chunk => output += chunk); child.on('error', reject); child.on('close', code => resolve({ code, output })) })
        for (const role of ['postgres', environment === 'production' ? 'cactigrow_staging_owner' : 'cactigrow_owner', 'cactigrow_runtime', 'cactigrow_staging_runtime']) { const rejected = new URL(url); rejected.username = role; assert.equal((await run(['--ensure', '--confirm-database', database], rejected.href)).code, 1) }
        const switched = new URL(url); switched.searchParams.set('options', '-c role=postgres'); const mismatch = await run(['--ensure', '--confirm-database', database], switched.href); assert.equal(mismatch.code, 1); assert.match(mismatch.output, /identity mismatch/)
        const identity = await run(['--check-connection']); assert.equal(identity.code, 0, identity.output); assert.match(identity.output, new RegExp('current_user=' + ownerRole))
        assert.equal((await owner.query("select to_regclass('public.wild_genetic_seeds') is not null as present")).rows[0].present, false)
        assert.equal((await owner.query('select count(*)::int n from drizzle.__drizzle_migrations')).rows[0].n, files.length)
        assert.equal((await run(['--verify'])).code, 1); assert.equal((await run(['--ensure'])).code, 1)
        if (environment === 'production') { const unapproved = await run(['--ensure', '--confirm-database', database], url.href, ''); assert.equal(unapproved.code, 1); assert.match(unapproved.output, /explicit production migration approval/); assert.equal((await owner.query("select to_regclass('public.wild_genetic_seeds') is not null as present")).rows[0].present, false) }
        const applied = await run(['--ensure', '--confirm-database', database]); assert.equal(applied.code, 0, applied.output)
        const repeated = await run(['--ensure', '--confirm-database', database]); assert.equal(repeated.code, 0, repeated.output); assert.doesNotMatch(repeated.output, /Applied/)
        assert.equal((await run(['--verify'])).code, 0); assert.equal((await run(['--ensure', '--confirm-database', environment === 'production' ? 'cactigrow_staging' : 'cactigrow'])).code, 1)
        assert.equal((await owner.query('select count(*)::int n from players where id=$1', [sentinel])).rows[0].n, 1)
        assert.equal((await owner.query('select count(*)::int n from drizzle.__drizzle_migrations')).rows[0].n, files.length + 1)
      } finally { await owner.end() }
    })
  } finally { await pool.end(); await connection.end(); await cluster.stop() }
})
