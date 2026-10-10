import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { readFile, readdir, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { createServer } from 'node:net'
import { findArea } from '../../shared/world/world.ts'
import { TOWN_NPC_ENTITY_IDS, TOWN_CONTENT, isTownContentResultV1 } from '../../shared/api/townContentV1.ts'
import { TOWN_COLLIDERS } from '../../shared/world/townGeometry.ts'

test('Town first contacts use authenticated ownership, preserved geometry and restricted real PostgreSQL', { skip: !process.env.CACTIGROW_EMBEDDED_POSTGRES_MODULE && 'Set CACTIGROW_EMBEDDED_POSTGRES_MODULE.' }, async t => {
  const { default: EmbeddedPostgres } = await import(process.env.CACTIGROW_EMBEDDED_POSTGRES_MODULE)
  const probe = createServer(); await new Promise(r => probe.listen(0, '127.0.0.1', r)); const port = probe.address().port; await new Promise(r => probe.close(r))
  const password = crypto.randomUUID(), cluster = new EmbeddedPostgres({ databaseDir: resolve(tmpdir(), `cactigrow-town-content-${crypto.randomUUID()}`), user: 'postgres', password, port, persistent: true, postgresFlags: ['-h', '127.0.0.1'], onLog() {}, onError() {} })
  await cluster.initialise(); await cluster.start(); await cluster.createDatabase('town_content_test')
  const connection = cluster.getPgClient('town_content_test', '127.0.0.1'); await connection.connect()
  const { Pool } = await import('pg'), pool = new Pool({ host: '127.0.0.1', port, user: 'postgres', password, database: 'town_content_test', max: 6 })
  try {
    for (const file of (await readdir('server/db/migrations')).filter(f => f.endsWith('.sql')).sort()) await connection.query(await readFile('server/db/migrations/' + file, 'utf8'))
    await mkdir('node_modules/.tmp', { recursive: true }); const out = resolve('node_modules/.tmp/town-content-db.mjs')
    await build({ stdin: { contents: `export { TownContentService } from './server/town/TownContentService.ts'; export { validateExplorationReach } from './server/exploration/explorationReach.ts'; export { WorldService } from './server/world/WorldService.ts'; export { initializeStagingGrower } from './server/staging/initializeGrower.ts'; export { createApiRouter } from './server/api/router.ts'; export { handleApiRequest } from './server/api/handler.ts';`, resolveDir: process.cwd() }, bundle: true, packages: 'external', platform: 'node', format: 'esm', outfile: out })
    const { TownContentService, validateExplorationReach, WorldService, initializeStagingGrower, createApiRouter, handleApiRequest } = await import(pathToFileURL(out).href)
    const { drizzle } = await import('drizzle-orm/node-postgres'), db = drizzle(pool), [a, b, c] = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()]
    for (const [index, id] of [a, b, c].entries()) {
      await connection.query('insert into players(id)values($1)', [id]); await initializeStagingGrower(db, id, false)
      await connection.query('insert into player_profiles(player_id,public_id,display_name)values($1,$2,$3)', [id, crypto.randomUUID(), 'Town Tester ' + index])
    }
    await connection.query(`create role town_runtime; grant usage on schema public to town_runtime; grant select on all tables in schema public to town_runtime;
      grant update on player_onboarding to town_runtime; grant insert on player_grower_events to town_runtime;`)
    pool.on('connect', client => { void client.query('set role town_runtime') }); await pool.query('set role town_runtime')
    let clock = new Date(Date.now() + 60_000)
    const service = () => new TownContentService(db, { environment: 'staging', now: () => clock }), world = new WorldService(db)
    const advance = (ms = 60_000) => { clock = new Date(clock.getTime() + ms) }
    const town = findArea(TOWN_CONTENT.areaId), npcs = TOWN_NPC_ENTITY_IDS.map(id => town.interactables.find(n => n.entityId === id))
    assert.equal(npcs.filter(Boolean).length, 3)
    const routeTo = (from, to) => {
      const queue = [[from, []]], seen = new Set([from])
      while (queue.length) { const [current, route] = queue.shift(); if (current === to) return route
        for (const exit of findArea(current).exits) if (!exit.blocked && exit.targetAreaId && !seen.has(exit.targetAreaId)) { seen.add(exit.targetAreaId); queue.push([exit.targetAreaId, [...route, exit.exitId]]) } }
      throw new Error('No authored route')
    }
    const enter = async (id, areaId) => {
      let location = await world.read(id)
      for (const exitId of routeTo(location.areaId, areaId)) location = await world.transition(id, { v: 1, commandId: crypto.randomUUID(), exitId, expectedRevision: location.revision })
      await connection.query("update player_grower_events set occurred_at=$3 where player_id=$1 and event_type='world-foundation-location-v1' and (payload->>'revision')::integer=$2", [id, location.revision, clock])
      return location
    }
    const talk = (location, npc = npcs[0], position = { x: npc.x, y: npc.y + 65 }) => ({ v: 1, commandId: crypto.randomUUID(), type: 'talk', entityId: npc.entityId, expectedWorldRevision: location.revision, position })
    const travelElapsed = (from, to) => {
      const navigation = validateExplorationReach({ ...town, collision: TOWN_COLLIDERS.map(r => ({ ...r })) }, from, { position: from, at: clock.toISOString() }, clock)
      const route = navigation.route(from, to); assert.ok(route?.length)
      let length = 0, previous = from
      for (const point of route) { length += Math.hypot(point.x - previous.x, point.y - previous.y); previous = point }
      return Math.ceil(length / 245 * 1000) + 1
    }
    const preserved = async id => {
      const [owner] = (await connection.query('select profile_id,cultivation_xp,breeding_xp,genetics_xp,token_balance,version from player_onboarding where player_id=$1', [id])).rows
      const seeds = (await connection.query('select species_id,quantity,version from player_seed_stacks where player_id=$1 order by species_id', [id])).rows
      const [mail] = (await connection.query('select count(*)::integer as count from mail_messages where sender_player_id=$1 or recipient_player_id=$1', [id])).rows
      return { owner, seeds, mail }
    }
    let aLocation, bLocation, firstTalk, firstMetAt

    await t.test('Town contacts are optional and GET creates no state or discovery before actual Town arrival', async () => {
      const before = await preserved(a), location = await world.read(a), result = await service().read(a)
      assert.ok(isTownContentResultV1(result)); assert.equal(result.projection.revision, 0); assert.equal(result.projection.townDiscoveredAt, null); assert.ok(result.projection.contacts.every(c => c.firstMetAt === null))
      assert.deepEqual(await preserved(a), before); assert.deepEqual(await world.read(a), location)
      await assert.rejects(service().execute(a, talk(location)), /Visit Town/)
    })
    await t.test('first authored Town discovery and Travel unlock remain owned by WorldService, without NPC gating or duplicate reward', async () => {
      const before = await preserved(a); aLocation = await enter(a, TOWN_CONTENT.areaId)
      assert.equal(aLocation.areaId, TOWN_CONTENT.areaId); assert.ok(aLocation.discoveredAreaIds.includes(TOWN_CONTENT.areaId)); assert.ok(aLocation.discoveredTravelDestinationIds.includes(town.travelDestinationId))
      const contacts = await service().read(a); assert.ok(contacts.projection.townDiscoveredAt); assert.equal(contacts.projection.revision, 0); assert.ok(contacts.projection.contacts.every(c => c.firstMetAt === null))
      assert.deepEqual(await preserved(a), before)
    })
    await t.test('talk validates actual Town revision, NPC radius, preserved building collision and elapsed movement', async () => {
      await assert.rejects(service().execute(a, talk(aLocation)), /too fast/)
      advance()
      await assert.rejects(service().execute(a, { ...talk(aLocation), expectedWorldRevision: aLocation.revision - 1 }), /location changed/)
      await assert.rejects(service().execute(a, talk(aLocation, npcs[0], { x: 1100, y: 1280 })), /Approach this Town resident/)
      const geometry = { ...town, collision: TOWN_COLLIDERS.map(r => ({ ...r })) }, anchor = { position: aLocation.position, at: new Date(clock.getTime() - 100_000).toISOString() }
      assert.throws(() => validateExplorationReach(geometry, { x: 649, y: 336 }, anchor, clock), /clear ground/)
      assert.throws(() => validateExplorationReach(geometry, { x: 1511, y: 365 }, anchor, clock), /clear ground/)
      assert.throws(() => validateExplorationReach(geometry, { x: 68, y: 750 }, anchor, clock), /clear ground/)
      assert.throws(() => validateExplorationReach(geometry, { x: 965, y: 1420 }, anchor, clock), /clear ground/)
      assert.equal((await service().read(a)).projection.revision, 0)
    })
    await t.test('Steward first contact persists once under concurrent talks and exact receipt replay, without economic changes', async () => {
      const before = await preserved(a); firstTalk = talk(aLocation)
      const results = await Promise.all([service().execute(a, firstTalk), service().execute(a, talk(aLocation))])
      assert.equal(results.filter(r => r.firstContact).length, 1); assert.ok(results.every(r => r.projection.revision === 1))
      firstMetAt = results[0].projection.contacts[0].firstMetAt; assert.ok(firstMetAt); assert.equal(results[1].projection.contacts[0].firstMetAt, firstMetAt)
      const replay = await service().execute(a, firstTalk); assert.equal(replay.projection.revision, 1); assert.equal(replay.projection.contacts[0].firstMetAt, firstMetAt)
      const count = (await connection.query("select count(*)::integer as count from player_grower_events where player_id=$1 and event_type='town-content-checkpoint-v1'", [a])).rows[0].count; assert.equal(count, 1)
      assert.deepEqual(await preserved(a), before)
      await assert.rejects(service().execute(a, { ...firstTalk, entityId: npcs[1].entityId }), /command ID/)
    })
    await t.test('successive far-apart NPC talks require actual route elapsed from the latest successful contact', async () => {
      const before = await service().read(a), command = talk(aLocation, npcs[1])
      await assert.rejects(service().execute(a, command), /too fast/)
      assert.deepEqual(await service().read(a), before)
      advance(travelElapsed(firstTalk.position, command.position))
      const result = await service().execute(a, command)
      assert.equal(result.firstContact, true); assert.equal(result.projection.revision, 2)
    })
    await t.test('Shopkeeper and Botanist first contacts are independent notes, not duplicate Shop/Research actions', async () => {
      const before = await preserved(a)
      const shop = await service().execute(a, talk(aLocation, npcs[1])); assert.equal(shop.firstContact, false); assert.equal(shop.projection.revision, 2)
      advance(travelElapsed(talk(aLocation, npcs[1]).position, talk(aLocation, npcs[2]).position))
      const botanist = await service().execute(a, talk(aLocation, npcs[2])); assert.equal(botanist.firstContact, true); assert.equal(botanist.projection.revision, 3); assert.ok(botanist.projection.contacts.every(c => c.firstMetAt))
      advance(); const again = await service().execute(a, talk(aLocation, npcs[0])); assert.equal(again.firstContact, false); assert.equal(again.projection.revision, 3); assert.equal(again.projection.contacts[0].firstMetAt, firstMetAt)
      assert.deepEqual(await preserved(a), before)
      const rewards = (await connection.query("select count(*)::integer as count from gameplay_command_receipts where player_id=$1", [a])).rows[0].count; assert.equal(rewards, 0)
    })
    await t.test('refresh and revisit retain first contact/discovery dates while Travel and another player remain unaffected', async () => {
      const before = await service().read(a), other = await service().read(b)
      await enter(a, 'path-2')
      assert.deepEqual(await service().read(a), before)
      const outside = await world.read(a); await assert.rejects(service().execute(a, talk(outside)), /Visit Town/)
      aLocation = await world.transition(a, { v: 1, commandId: crypto.randomUUID(), travelDestinationId: town.travelDestinationId, expectedRevision: outside.revision })
      assert.equal(aLocation.areaId, TOWN_CONTENT.areaId); assert.deepEqual(await service().read(a), before); assert.deepEqual(await service().read(b), other)
      assert.equal((await service().execute(a, firstTalk)).projection.revision, before.projection.revision, 'Receipt replay returns current state after a location transition')
      await connection.query("update player_grower_events set occurred_at=$3 where player_id=$1 and event_type='world-foundation-location-v1' and (payload->>'revision')::integer=$2", [a, aLocation.revision, clock])
      await assert.rejects(service().execute(a, talk(aLocation, npcs[2])), /too fast/, 'Old Town-revision talk anchors cannot supply elapsed movement on a new arrival')
    })
    await t.test('two players can talk to the same NPC concurrently with the same command UUID without stealing contact state', async () => {
      bLocation = await enter(b, TOWN_CONTENT.areaId); const cLocation = await enter(c, TOWN_CONTENT.areaId); advance()
      const sharedCommand = crypto.randomUUID(), beforeB = await preserved(b), beforeC = await preserved(c)
      const [bTalk, cTalk] = await Promise.all([service().execute(b, { ...talk(bLocation), commandId: sharedCommand }), service().execute(c, { ...talk(cLocation), commandId: sharedCommand })])
      assert.equal(bTalk.firstContact, true); assert.equal(cTalk.firstContact, true); assert.equal(bTalk.projection.revision, 1); assert.equal(cTalk.projection.revision, 1)
      assert.deepEqual(await preserved(b), beforeB); assert.deepEqual(await preserved(c), beforeC); assert.equal((await service().read(a)).projection.revision, 3)
    })
    await t.test('contact persistence failure rolls back its timestamp and receipt before safe retry', async () => {
      const cLocation = await world.read(c), command = talk(cLocation, npcs[2]), before = await service().read(c)
      advance(travelElapsed(talk(cLocation).position, command.position))
      await connection.query(`create function town_receipt_failure()returns trigger language plpgsql as $$ begin if NEW.event_type='town-content-contact-receipt-v1' and NEW.player_id='${c}' then raise exception 'Fixture receipt failure'; end if; return NEW; end $$;
        create trigger town_receipt_failure before insert on player_grower_events for each row execute function town_receipt_failure();`)
      await assert.rejects(service().execute(c, command), error => error.cause?.message === 'Fixture receipt failure')
      assert.deepEqual(await service().read(c), before)
      const count = (await connection.query('select count(*)::integer as count from player_grower_events where player_id=$1 and source_command_id=$2', [c, command.commandId])).rows[0].count; assert.equal(count, 0)
      await connection.query('drop trigger town_receipt_failure on player_grower_events; drop function town_receipt_failure()')
      assert.equal((await service().execute(c, command)).firstContact, true)
    })
    await t.test('strict API ownership rejects board/manual flags and anonymous production Town content', async () => {
      const router = createApiRouter({ authenticationConfigurationFactory: () => ({ identityProvider: { verify: async request => request.getHeader('x-test-player') === a ? { provider: 'test', subject: a } : null }, createPlayerIdentityResolver: async () => ({ resolve: async () => ({ playerId: a }) }) }) })
      let opens = 0
      const request = (environment, body, authenticated = true) => handleApiRequest(new Request('https://town.test/api/v1/me/town-content', { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(authenticated ? { 'x-test-player': a } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }), { CACTIGROW_ENVIRONMENT: environment, CACTIGROW_VERSION: 'test' }, undefined, { router, createRequestDatabaseContext: () => ({ getDatabase: async () => { opens++; return db }, dispose: async () => {} }) })
      for (const body of [null, talk(aLocation)]) assert.equal((await request('production', body, false)).status, 401)
      assert.equal(opens, 0); assert.equal((await request('test', null, false)).status, 401)
      const read = await request('test', null); assert.equal(read.status, 200); assert.ok(isTownContentResultV1((await read.json()).data))
      for (const change of [{ entityId: TOWN_CONTENT.boardEntityId }, { type: 'mark-met' }, { playerId: b }, { reward: 1000 }, { firstMetAt: clock.toISOString() }]) assert.equal((await request('test', { ...talk(aLocation), ...change })).status, 400)
      assert.ok((await new TownContentService(db, { environment: 'production' }).read(a)).projection)
    })
  } finally { await pool.end(); await connection.end(); await cluster.stop() }
})
