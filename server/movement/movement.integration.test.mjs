import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile, readdir, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { createServer } from 'node:net'
import { build } from 'esbuild'
import { movementTestNamespace } from './movementTestNamespace.mjs'
import { movementNavigation } from './movementRules.ts'
import { findArea } from '../../shared/world/world.ts'

for (const runtimeEnvironment of ['staging', 'production']) test(`${runtimeEnvironment} authenticated API: movement, interactions, exits, private Farms and safe restoration in restricted PostgreSQL`, {
  skip: !process.env.CACTIGROW_EMBEDDED_POSTGRES_MODULE && 'Set CACTIGROW_EMBEDDED_POSTGRES_MODULE.', timeout: 180000,
}, async t => {
  const { default: EmbeddedPostgres } = await import(process.env.CACTIGROW_EMBEDDED_POSTGRES_MODULE)
  const probe = createServer(); await new Promise(r => probe.listen(0, '127.0.0.1', r)); const port = probe.address().port; await new Promise(r => probe.close(r))
  const cluster = new EmbeddedPostgres({ databaseDir: resolve(tmpdir(), `cactigrow-movement-${crypto.randomUUID()}`), user: 'postgres', password: crypto.randomUUID(), port, persistent: true, postgresFlags: ['-h', '127.0.0.1'], onLog() {}, onError() {} })
  await cluster.initialise(); await cluster.start(); await cluster.createDatabase('movement_test')
  const connection = cluster.getPgClient('movement_test', '127.0.0.1'); await connection.connect()
  try {
    for (const file of (await readdir('server/db/migrations')).filter(f => f.endsWith('.sql')).sort()) await connection.query(await readFile('server/db/migrations/' + file, 'utf8'))
    await mkdir('node_modules/.tmp', { recursive: true }); const out = resolve('node_modules/.tmp/movement-db.mjs')
    await build({ stdin: { contents: `export { handleApiRequest } from './server/api/handler.ts'; export { createApiRouter } from './server/api/router.ts'; export { CactiGrowApiClient } from './src/services/api/CactiGrowApiClient.ts'; export { initializeStagingGrower } from './server/staging/initializeGrower.ts';`, resolveDir: process.cwd() }, bundle: true, packages: 'external', platform: 'node', format: 'esm', outfile: out })
    const { handleApiRequest, createApiRouter, CactiGrowApiClient, initializeStagingGrower } = await import(pathToFileURL(out).href)
    const { drizzle } = await import('drizzle-orm/node-postgres'), ids = [crypto.randomUUID(), crypto.randomUUID()]
    for (const [n, id] of ids.entries()) { await connection.query('insert into players(id) values($1)', [id]); await initializeStagingGrower(drizzle(connection), id); await connection.query('insert into player_profiles(player_id,public_id,display_name) values($1,$1,$2)', [id, 'Movement Tester ' + n]) }
    await connection.query('create role movement_runtime; grant usage on schema public to movement_runtime; grant select on all tables in schema public to movement_runtime; grant insert,update on player_onboarding to movement_runtime; grant insert on player_grower_state,player_grower_events,clone_lines,genetic_profiles,clone_line_variants to movement_runtime; grant insert,update on wild_genetic_seeds to movement_runtime; grant update on nursery_occupancies to movement_runtime; grant insert,update on player_seed_stacks,player_plant_lifecycle_versions to movement_runtime;')
    let now = Date.now(), opens = 0
    const namespace = movementTestNamespace(() => now)
    const router = createApiRouter({ authenticationConfigurationFactory: () => ({ identityProvider: { verify: async req => ids.includes(req.getHeader('x-test-player')) ? { provider: 'test', subject: req.getHeader('x-test-player') } : null }, createPlayerIdentityResolver: async () => ({ resolve: async i => ({ playerId: i.subject }) }) }) })
    const request = (id, path, body, environment = runtimeEnvironment) => handleApiRequest(new Request('https://movement.test' + path, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', 'x-test-player': id }, ...(body ? { body: JSON.stringify(body) } : {}) }), { CACTIGROW_ENVIRONMENT: environment, CACTIGROW_VERSION: 'movement-test', ...(environment === 'staging' ? {CACTIGROW_ACCESS_TEAM_DOMAIN:'test.cloudflareaccess.com',CACTIGROW_ACCESS_AUDIENCE:'test'} : {}), AREA_PRESENCE: namespace }, undefined, { router, createRequestDatabaseContext: () => {
      let ready, client
      return { getDatabase: () => { opens++; ready ??= (async () => { client = cluster.getPgClient('movement_test', '127.0.0.1'); await client.connect(); await client.query('set role movement_runtime'); return drizzle(client) })(); return ready }, dispose: async () => { if (ready) { await ready; await client.end() } } }
    } })
    const api = id => new CactiGrowApiClient({ baseUrl: 'https://movement.test', getCredentials: () => ({ 'x-test-player': id }), fetch: (url, init) => { const body = init?.body ? JSON.parse(init.body) : undefined; return request(id, new URL(url).pathname, body) } })
    const a = api(ids[0]), b = api(ids[1]); let location = await a.getWorld()
    const walk = async point => {
      let authority = await a.getMovement(), previous = authority.position
      const route = movementNavigation(location.runtimeAreaId).route(previous, point)
      assert.ok(route && Math.hypot(route.at(-1).x - point.x, route.at(-1).y - point.y) < 6, 'target must be on physically reachable ground')
      for (const target of route) {
        let remaining = Math.hypot(target.x - previous.x, target.y - previous.y)
        while (remaining > .01) {
          const amount = Math.min(120, remaining), next = { x: previous.x + (target.x - previous.x) * amount / remaining, y: previous.y + (target.y - previous.y) * amount / remaining }
          now += 500
          authority = await a.movementCheckpoint({ v: 1, expectedWorldRevision: location.revision, runtimeAreaId: location.runtimeAreaId, position: next })
          assert.equal(authority.accepted, true, authority.lastRejection)
          previous = next; remaining = Math.hypot(target.x - previous.x, target.y - previous.y)
        }
      }
      return authority
    }
    const exit = async id => {
      const source = findArea(location.areaId), gate = source.exits.find(e => e.exitId === id)
      assert.ok(gate)
      await walk(gate)
      location = await a.transitionWorld(id, location.revision, crypto.randomUUID())
      assert.deepEqual(namespace.states.get(`movement-v1:${ids[0]}`).authority.position, location.position, 'destination owner is initialized before transition returns')
      const authority = await a.getMovement()
      assert.deepEqual(authority.position, location.position, 'transition authority resets to authored destination spawn')
      assert.equal(authority.runtimeAreaId, location.runtimeAreaId)
    }
    await t.test('developer routes and unauthenticated staging/production checkpoints fail before database acquisition', async () => {
      const before = opens
      assert.equal((await request(ids[0], '/api/v1/dev/movement', undefined, 'production')).status, 404); for (const environment of ['staging','production']) assert.equal((await request('invalid', '/api/v1/me/movement', undefined, environment)).status, 401)
      assert.equal((await request('invalid', '/api/v1/me/movement')).status, 401); assert.equal(opens, before)
    })
    await t.test('remote tutorial, board/building, harvest and exit requests cannot use fabricated coordinates', async () => {
      const starting = findArea(location.areaId), cactus = starting.interactables.find(e => e.kind === 'harvestable')
      assert.equal((await request(ids[0], '/api/v1/me/world-interaction', { entityId: cactus.entityId })).status, 409)
      await assert.rejects(a.transitionWorld('to-path-1', location.revision, crypto.randomUUID()), /Reach/)
      const invalid = await a.movementCheckpoint({ v: 1, expectedWorldRevision: location.revision, runtimeAreaId: location.runtimeAreaId, position: { x: -999, y: 100 } })
      assert.equal(invalid.accepted, false); assert.equal(invalid.lastRejection, 'OUT_OF_BOUNDS')
      assert.deepEqual((await a.getWorld()).position, invalid.position)
    })
    await exit('to-path-1'); await exit('to-cross-path-1')
    await t.test('remote wild harvest rejects; nearby reward uses accepted position despite a false endpoint claim', async () => {
      await a.getExploration(); await a.startingCommand({ type: 'equip-tool', itemId: 'field-knife', commandId: crypto.randomUUID() })
      const node = findArea(location.areaId).interactables.find(e => e.resourceType)
      const command = () => ({ v: 1, commandId: crypto.randomUUID(), type: 'harvest', entityId: node.entityId, expectedWorldRevision: location.revision, position: { x: node.x, y: node.y + 50 } })
      await assert.rejects(a.explorationCommand(command()), /Approach/)
      await walk({ x: node.x, y: node.y + 50 })
      const projection = (await a.getExploration()).projection
      // Fixture preparation uses the staging-only tool; production commands still reject it.
      assert.equal((await request(ids[0], '/api/v1/dev/exploration', {v:1,commandId:crypto.randomUUID(),type:'force-wild-outcome',expectedRevision:projection.revision,outcome:'rare'}, 'staging')).status,200)
      const intent = { ...command(), position: { x: 1, y: 1 } }
      assert.equal((await request(ids[0], '/api/v1/me/exploration', {...intent,rarity:'rare'})).status,400)
      const harvest = await a.explorationCommand(intent)
      assert.ok(harvest.reward.quantity >= 3 && harvest.reward.quantity <= 10)
      assert.equal(harvest.reward.geneticLot.provenance.rarity,'rare')
      assert.deepEqual((await a.explorationCommand(intent)).reward,harvest.reward)
      assert.equal((await a.getPlantLifecycleV3()).wildSeedLots[0].quantity,3)
      const inspection = await request(ids[0], '/api/v1/dev/wild-genetics', undefined, 'staging')
      assert.equal(inspection.status,200)
      assert.equal((await inspection.json()).data.receipts.length,1)

    })
    await exit('to-player-farm')
    await t.test('owner Farm authority, impossible Area changes and nearby building admission', async () => {
      const invalid = await a.movementCheckpoint({ v: 1, expectedWorldRevision: location.revision, runtimeAreaId: `farm-${ids[1]}`, position: location.position })
      assert.equal(invalid.accepted, false); assert.equal(invalid.lastRejection, 'AREA_CHANGED')
      assert.equal((await b.getWorld()).areaId, 'starting-spawn-tutorial')
      await assert.rejects(a.worldInteraction('lab'), /Approach/)
      await walk({ x: 1500, y: 870 }); await a.worldInteraction('home')
    })
    await exit('to-cross-path-1'); await exit('to-path-2'); await exit('to-town-p1')
    await t.test('remote Town NPC and board reject; legitimate nearby NPC contact commits once', async () => {
      const npc = findArea(location.areaId).interactables.find(e => e.entityId === 'town-rosa-steward')
      const command = () => ({ v: 1, commandId: crypto.randomUUID(), type: 'talk', entityId: npc.entityId, expectedWorldRevision: location.revision, position: { x: npc.x, y: npc.y + 50 } })
      await assert.rejects(a.townContentCommand(command()), /Approach/)
      await assert.rejects(a.worldInteraction('town-community-board'), /Approach/)
      await walk({ x: npc.x, y: npc.y + 50 }); await a.worldInteraction(npc.entityId)
      const accepted = await a.townContentCommand({ ...command(), position: { x: 1, y: 1 } })
      assert.equal(accepted.firstContact, true)
    })
    await t.test('rejected coordinates never persist; durable restart and PostgreSQL fallback restore safe position', async () => {
      now += 16000
      const safe = await walk({ x: 1100, y: 1050 })
      await a.getMovement()
      const count = await connection.query("select count(*)::integer n from player_grower_events where player_id=$1 and event_type='movement-safe-location-v1'", [ids[0]])
      for (const position of [{ x: 4000, y: 100 }, { x: 2000, y: 1300 }]) assert.equal((await a.movementCheckpoint({ v: 1, expectedWorldRevision: location.revision, runtimeAreaId: location.runtimeAreaId, position })).accepted, false)
      assert.deepEqual((await api(ids[0]).getWorld()).position, safe.position)
      assert.equal((await connection.query("select count(*)::integer n from player_grower_events where player_id=$1 and event_type='movement-safe-location-v1'", [ids[0]])).rows[0].n, count.rows[0].n)
      const persisted = (await connection.query("select payload from player_grower_events where player_id=$1 and event_type='movement-safe-location-v1' order by occurred_at desc limit 1", [ids[0]])).rows[0].payload
      namespace.states.delete(`movement-v1:${ids[0]}`)
      assert.deepEqual((await a.getWorld()).position, persisted.position)
      assert.equal((await a.getWorld()).runtimeAreaId, 'town')
      await connection.query("insert into player_grower_events(id,player_id,event_type,source_command_id,occurred_at,payload) values($1,$2,'movement-safe-location-v1',$3,$4,$5)", [crypto.randomUUID(), ids[0], crypto.randomUUID(), new Date(now + 1000), { ...persisted, position: { x: -999, y: -999 } }])
      namespace.states.delete(`movement-v1:${ids[0]}`)
      const restored = await a.getWorld(), spawn = findArea(restored.areaId).spawns.find(s => s.entryId === restored.entryId)
      assert.deepEqual(restored.position, { x: spawn.x, y: spawn.y }, 'invalid persisted state falls back to the authored spawn')
    })
  } finally { await connection.end(); await cluster.stop() }
})
