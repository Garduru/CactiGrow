import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile, readdir, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { createServer } from 'node:net'
import { build } from 'esbuild'

test('authenticated world transitions persist, serialize/replay, isolate owners and retain gameplay state in PostgreSQL', { skip: !process.env.CACTIGROW_EMBEDDED_POSTGRES_MODULE && 'Set CACTIGROW_EMBEDDED_POSTGRES_MODULE.' }, async () => {
  const { default: EmbeddedPostgres } = await import(process.env.CACTIGROW_EMBEDDED_POSTGRES_MODULE)
  const probe = createServer(); await new Promise(r => probe.listen(0, '127.0.0.1', r)); const port = probe.address().port; await new Promise(r => probe.close(r))
  const cluster = new EmbeddedPostgres({ databaseDir: resolve(tmpdir(), `cactigrow-world-${crypto.randomUUID()}`), user: 'postgres', password: crypto.randomUUID(), port, persistent: true, postgresFlags: ['-h', '127.0.0.1'], onLog() {}, onError() {} })
  await cluster.initialise(); await cluster.start(); await cluster.createDatabase('world_test')
  const connection = cluster.getPgClient('world_test', '127.0.0.1'); await connection.connect()
  try {
    for (const file of (await readdir('server/db/migrations')).filter(f => f.endsWith('.sql')).sort()) await connection.query(await readFile('server/db/migrations/' + file, 'utf8'))
    await mkdir('node_modules/.tmp', { recursive: true }); const out = resolve('node_modules/.tmp/world-db.mjs')
    await build({ stdin: { contents: `export { handleApiRequest } from './server/api/handler.ts'; export { createApiRouter } from './server/api/router.ts'; export { CactiGrowApiClient } from './src/services/api/CactiGrowApiClient.ts'; export { initializeStagingGrower } from './server/staging/initializeGrower.ts';`, resolveDir: process.cwd() }, bundle: true, packages: 'external', platform: 'node', format: 'esm', outfile: out })
    const { handleApiRequest, createApiRouter, CactiGrowApiClient, initializeStagingGrower } = await import(pathToFileURL(out).href)
    const { drizzle } = await import('drizzle-orm/node-postgres')
    const ids = [crypto.randomUUID(), crypto.randomUUID()]
    for (const [n, id] of ids.entries()) { await connection.query('insert into players(id) values($1)', [id]); await initializeStagingGrower(drizzle(connection), id); await connection.query('insert into player_profiles(player_id,public_id,display_name) values($1,$2,$3)', [id, crypto.randomUUID(), 'World Tester ' + n]) }
    const before = (await connection.query('select * from player_onboarding order by player_id')).rows
    await connection.query('create role world_runtime; grant usage on schema public to world_runtime; grant select on all tables in schema public to world_runtime; grant insert,update on player_onboarding to world_runtime; grant insert on player_grower_state to world_runtime; grant insert on player_grower_events to world_runtime;')
    const router = createApiRouter({ authenticationConfigurationFactory: () => ({ identityProvider: { verify: async req => ids.includes(req.getHeader('x-test-player')) ? { provider: 'test', subject: req.getHeader('x-test-player') } : null }, createPlayerIdentityResolver: async () => ({ resolve: async i => ({ playerId: i.subject }) }) }) })
    const api = (id, environment = 'staging') => new CactiGrowApiClient({ baseUrl: 'https://world.test', getCredentials: () => ({ 'x-test-player': id }), fetch: (url, init) => handleApiRequest(new Request(url, init), { CACTIGROW_ENVIRONMENT: environment, CACTIGROW_VERSION: 'test' }, undefined, { router, createRequestDatabaseContext: () => {
      const client = cluster.getPgClient('world_test', '127.0.0.1'); const ready = client.connect().then(() => client.query('set role world_runtime')).then(() => drizzle(client)); return { getDatabase: () => ready, dispose: async () => { await ready; await client.end() } }
    }, reportUnexpectedError: e => { console.error(e.message, e.cause?.message) } }) })
    const a = api(ids[0]), b = api(ids[1])
    await assert.rejects(api('invalid').getWorld(), e => e.status === 401)
    await assert.rejects(api(ids[0], 'production').getWorld(), e => e.status === 404)
    let state = await a.getWorld(); assert.equal(state.areaId, 'starting-spawn-tutorial')
    await assert.rejects(a.travelWorld('town-p1', 0, crypto.randomUUID()), e => e.status === 403)
    await assert.rejects(a.travelWorld('player-farm', 0, crypto.randomUUID()), e => e.status === 403)
    await assert.rejects(a.transitionWorld('to-player-farm', 0, crypto.randomUUID()), e => e.status === 403)
    const commandId = crypto.randomUUID()
    const raced = await Promise.all([a.transitionWorld('to-path-1', 0, commandId), a.transitionWorld('to-path-1', 0, commandId)])
    assert.deepEqual(raced[0], raced[1]); assert.equal(raced[0].revision, 1)
    await assert.rejects(a.transitionWorld('to-cross-path-1', 0, commandId), e => e.status === 409)
    await assert.rejects(a.transitionWorld('to-cross-path-1', 0, crypto.randomUUID()), e => e.status === 409)
    state = await a.transitionWorld('to-cross-path-1', 1, crypto.randomUUID()); assert.equal(state.zoneId, 'first-basin')
    state = await a.transitionWorld('to-player-farm', 2, crypto.randomUUID()); const farm = state.runtimeAreaId
    assert.ok(farm.startsWith('farm-')); assert.equal((await b.getWorld()).areaId, 'starting-spawn-tutorial')
    assert.deepEqual(await api(ids[0]).getWorld(), state)
    await assert.rejects(a.travelWorld('town-p1', state.revision, crypto.randomUUID()), e => e.status === 403)
    await assert.rejects(a.transitionWorld('to-town-p1', state.revision, crypto.randomUUID()), e => e.status === 403)
    assert.deepEqual(await a.getWorld(), state, 'fabricated Farm shortcut does not move the player')
    for (const exit of ['to-cross-path-1', 'to-path-2', 'to-town-p1', 'to-path-2', 'to-cross-path-1', 'to-path-3', 'to-path-5-under-construction']) {
      state = await a.transitionWorld(exit, state.revision, crypto.randomUUID())
      if (state.areaId === 'town-p1') {
        await assert.rejects(a.transitionWorld('to-player-farm', state.revision, crypto.randomUUID()), e => e.status === 403)
        assert.deepEqual(await a.getWorld(), state, 'fabricated Town shortcut does not move the player')
      }
    }
    await assert.rejects(a.transitionWorld('future-route', state.revision, crypto.randomUUID()), /under construction/)
    assert.deepEqual(await a.getWorld(), state)
    const discovery = structuredClone(state.discoveredTravelDestinationIds)
    const travelCommand = crypto.randomUUID(), travelRevision = state.revision
    state = await a.travelWorld('player-farm', travelRevision, travelCommand)
    assert.equal(state.runtimeAreaId, farm)
    assert.equal(state.entryId, 'from-cross-path-1')
    assert.deepEqual(state.discoveredTravelDestinationIds, discovery)
    assert.deepEqual(await api(ids[0]).getWorld(), state, 'new authenticated client restores discovery after logout/login')
    assert.deepEqual(await a.travelWorld('player-farm', travelRevision, travelCommand), state)
    await assert.rejects(a.travelWorld('town-p1', travelRevision, travelCommand), e => e.status === 409)
    await assert.rejects(b.travelWorld('player-farm', 0, crypto.randomUUID()), e => e.status === 403)
    state = await a.travelWorld('town-p1', state.revision, crypto.randomUUID())
    assert.equal(state.entryId, 'from-path-2')
    await assert.rejects(a.travelWorld('path-2', state.revision, crypto.randomUUID()), e => e.status === 403)
    assert.deepEqual((await connection.query('select * from player_onboarding order by player_id')).rows, before)
    assert.equal((await connection.query('select count(*)::integer as n from player_grower_events where player_id=$1', [ids[0]])).rows[0].n, state.revision)
    await connection.query("update player_grower_events set payload=jsonb_set(payload,'{position}','{\"x\":100,\"y\":100}') where player_id=$1 and (payload->>'revision')::integer=$2", [ids[0], state.revision])
    assert.deepEqual((await a.getWorld()).position, state.position, 'restoration uses current authored spawn coordinates')
    await connection.query("update player_grower_events set payload=jsonb_set(payload,'{areaId}','\"removed-area\"') where player_id=$1 and (payload->>'revision')::integer=$2", [ids[0], state.revision])
    const fallback = await a.getWorld(); assert.equal(fallback.areaId, 'starting-spawn-tutorial'); assert.equal(fallback.revision, state.revision)
  } finally { await connection.end(); await cluster.stop() }
})
