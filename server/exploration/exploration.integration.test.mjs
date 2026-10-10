import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { readFile, readdir, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { createServer } from 'node:net'
import { WORLD, findArea } from '../../shared/world/world.ts'
import { isExplorationCommandV1, isExplorationResultV1 } from '../../shared/api/explorationV1.ts'
import { NavigationMap } from '../../src/game-world/navigation/NavigationMap.ts'

test('First Basin Exploration: real restricted PostgreSQL, personal resources, discoveries and narrow resets', { skip: !process.env.CACTIGROW_EMBEDDED_POSTGRES_MODULE && 'Set CACTIGROW_EMBEDDED_POSTGRES_MODULE.' }, async t => {
  const { default: EmbeddedPostgres } = await import(process.env.CACTIGROW_EMBEDDED_POSTGRES_MODULE)
  const probe = createServer(); await new Promise(r => probe.listen(0, '127.0.0.1', r)); const port = probe.address().port; await new Promise(r => probe.close(r))
  const password = crypto.randomUUID(), cluster = new EmbeddedPostgres({ databaseDir: resolve(tmpdir(), `cactigrow-exploration-${crypto.randomUUID()}`), user: 'postgres', password, port, persistent: true, postgresFlags: ['-h', '127.0.0.1'], onLog() {}, onError() {} })
  await cluster.initialise(); await cluster.start(); await cluster.createDatabase('exploration_test')
  const connection = cluster.getPgClient('exploration_test', '127.0.0.1'); await connection.connect()
  const { Pool } = await import('pg'), pool = new Pool({ host: '127.0.0.1', port, user: 'postgres', password, database: 'exploration_test', max: 6 })
  try {
    for (const file of (await readdir('server/db/migrations')).filter(f => f.endsWith('.sql')).sort()) await connection.query(await readFile('server/db/migrations/' + file, 'utf8'))
    await mkdir('node_modules/.tmp', { recursive: true }); const out = resolve('node_modules/.tmp/exploration-db.mjs')
    await build({ stdin: { contents: `export { ExplorationService } from './server/exploration/ExplorationService.ts'; export {validateExplorationReach} from './server/exploration/explorationReach.ts'; export { StartingExperienceService } from './server/starting/StartingExperienceService.ts'; export { StartingResetService } from './server/starting/StartingResetService.ts'; export { WorldService } from './server/world/WorldService.ts'; export { initializeStagingGrower } from './server/staging/initializeGrower.ts'; export { PlantLifecycleService } from './server/gameplay/PlantLifecycleService.ts'; export { createApiRouter } from './server/api/router.ts'; export { handleApiRequest } from './server/api/handler.ts';`, resolveDir: process.cwd() }, bundle: true, packages: 'external', platform: 'node', format: 'esm', outfile: out })
    const { ExplorationService, validateExplorationReach, StartingExperienceService, StartingResetService, WorldService, initializeStagingGrower, PlantLifecycleService, createApiRouter, handleApiRequest } = await import(pathToFileURL(out).href)
    const { drizzle } = await import('drizzle-orm/node-postgres'), db = drizzle(pool), ids = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()]
    for (const [index, id] of ids.entries()) {
      await connection.query('insert into players(id)values($1)', [id]); await initializeStagingGrower(db, id, index === 2)
      await connection.query('insert into player_profiles(player_id,public_id,display_name)values($1,$2,$3)', [id, crypto.randomUUID(), 'Basin Tester ' + index])
    }
    await connection.query(`create role exploration_runtime; grant usage on schema public to exploration_runtime; grant select on all tables in schema public to exploration_runtime;
      grant insert,update on player_onboarding,player_seed_stacks,player_plant_lifecycle_versions to exploration_runtime;
      grant insert on player_grower_events,player_grower_state to exploration_runtime;`)
    pool.on('connect', client => { void client.query('set role exploration_runtime') }); await pool.query('set role exploration_runtime')
    let clock = new Date(Date.now() + 60_000)
    const service = () => new ExplorationService(db, { environment: 'staging', now: () => clock, rollYield: () => 6 }), world = new WorldService(db), starting = new StartingExperienceService(db, () => clock), lifecycle = new PlantLifecycleService(db, { environment: 'staging', now: () => clock })
    const advance = (ms = 60_000) => { clock = new Date(clock.getTime() + ms) }
    const routeTo = (from, to) => {
      const queue = [[from, []]], seen = new Set([from])
      while (queue.length) {
        const [current, route] = queue.shift(); if (current === to) return route
        for (const exit of findArea(current).exits) if (!exit.blocked && exit.targetAreaId && !seen.has(exit.targetAreaId)) { seen.add(exit.targetAreaId); queue.push([exit.targetAreaId, [...route, exit.exitId]]) }
      }
      throw new Error('No authored route')
    }
    const enter = async (id, areaId) => {
      let location = await world.read(id)
      for (const exitId of routeTo(location.areaId, areaId)) location = await world.transition(id, { v: 1, commandId: crypto.randomUUID(), exitId, expectedRevision: location.revision })
      // Fixture clock for the actual persisted entry event; no client timestamp is accepted by commands.
      await connection.query("update player_grower_events set occurred_at=$3 where player_id=$1 and event_type='world-foundation-location-v1' and (payload->>'revision')::integer=$2", [id, location.revision, clock])
      return location
    }
    const command = (location, type, target, position = target) => ({ v: 1, commandId: crypto.randomUUID(), type, expectedWorldRevision: location.revision, position: { x: position.x, y: position.y }, ...(type === 'discover-landmark' ? { landmarkId: target.landmarkId } : { entityId: target.entityId }) })
    const quantity = async (id, speciesId) => (await connection.query('select quantity from player_seed_stacks where player_id=$1 and species_id=$2', [id, speciesId])).rows[0]?.quantity ?? 0
    const [a, b, fresh] = ids, cross = findArea('cross-path-1'), crossNode = cross.interactables.find(n => n.kind === 'harvestable' && !n.tutorial)
    let aLocation, bLocation, firstHarvest, readyAt

    await t.test('established compatibility grants one owned knife under concurrent reads, without equipping or starter refill', async () => {
      const before = await quantity(a, crossNode.speciesId), [first, second] = await Promise.all([service().read(a), service().read(a)])
      assert.deepEqual(first.starting.ownedEquipment, ['field-knife']); assert.deepEqual(second.starting.ownedEquipment, ['field-knife'])
      assert.equal(first.starting.equipment.tool, null); assert.equal(first.starting.harvestingXp, 0); assert.equal(await quantity(a, crossNode.speciesId), before)
      assert.equal(first.starting.revision, second.starting.revision); assert.ok(isExplorationResultV1(first))
      assert.deepEqual((await service().read(fresh)).starting.ownedEquipment, [], 'fresh incomplete players receive no compatibility tool')
      await starting.execute(a, { type: 'equip-tool', itemId: 'field-knife', commandId: crypto.randomUUID() })
    })
    await t.test('strict contracts and production developer gates reject before DB acquisition', async () => {
      const router = createApiRouter({ authenticationConfigurationFactory: () => ({ identityProvider: { verify: async request => request.getHeader('x-test-player') === a ? { provider: 'test', subject: a } : null }, createPlayerIdentityResolver: async () => ({ resolve: async () => ({ playerId: a }) }) }) })
      let opens = 0
      const request = (path, environment, body, authenticated = true) => handleApiRequest(new Request('https://exploration.test' + path, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(authenticated ? { 'x-test-player': a } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }), { CACTIGROW_ENVIRONMENT: environment, CACTIGROW_VERSION: 'test', ...(environment === 'staging' ? { CACTIGROW_ACCESS_TEAM_DOMAIN: 'test.cloudflareaccess.com', CACTIGROW_ACCESS_AUDIENCE: 'test' } : {}) }, undefined, { router, createRequestDatabaseContext: () => ({ getDatabase: async () => { opens++; return db }, dispose: async () => {} }) })
      for (const path of ['/api/v1/dev/exploration']) for (const body of [null, { v: 1, commandId: crypto.randomUUID(), type: 'reset-cooldowns', expectedRevision: 0 }]) assert.equal((await request(path, 'production', body)).status, 404)
      assert.equal(opens, 0); assert.equal((await request('/api/v1/me/exploration', 'test', null, false)).status, 401)
      const invalid = { v: 1, commandId: crypto.randomUUID(), type: 'harvest', entityId: crossNode.entityId, expectedWorldRevision: 0, position: { x: 330, y: 940 }, quantity: 1000 }
      assert.equal(isExplorationCommandV1(invalid), false); assert.equal((await request('/api/v1/me/exploration', 'test', invalid)).status, 400)
      assert.equal((await request('/api/v1/dev/exploration', 'staging', { v: 1, commandId: crypto.randomUUID(), type: 'reset-cooldowns', expectedRevision: 0, targetPlayerId: b })).status, 400)
      assert.equal((await request('/api/v1/dev/exploration', 'staging', null)).status, 200)
      const restored = await request('/api/v1/me/exploration/entry', 'test', { v: 1, commandId: crypto.randomUUID(), expectedWorldRevision: 0 }); assert.equal(restored.status, 200); assert.ok(isExplorationResultV1((await restored.json()).data))
      assert.ok((await new ExplorationService(db, { environment: 'production' }).read(a)).projection)
    })
    await t.test('server rejects stale Area revision, foreign target, blocked ground and impossible instant reach', async () => {
      aLocation = await enter(a, cross.areaId)
      await assert.rejects(service().execute(a, command(aLocation, 'harvest', crossNode)), /too fast/)
      advance()
      await assert.rejects(service().execute(a, { ...command(aLocation, 'harvest', crossNode), expectedWorldRevision: aLocation.revision - 1 }), /location changed/)
      const foreign = findArea('path-2').interactables.find(n => n.kind === 'harvestable')
      await assert.rejects(service().execute(a, command(aLocation, 'harvest', foreign)), /Approach/)
      const rock = cross.collision[0]
      assert.throws(() => validateExplorationReach(cross, { x: rock.x, y: rock.y }, { position: aLocation.position, at: new Date(clock.getTime() - 100_000).toISOString() }, clock), /clear ground/)
      const isolated = { ...cross, areaId: 'isolated-server-test', width: 1000, height: 1000, collision: [{ x: 500, y: 500, width: 100, height: 1000 }] }
      assert.throws(() => validateExplorationReach(isolated, { x: 800, y: 500 }, { position: { x: 200, y: 500 }, at: new Date(clock.getTime() - 100_000).toISOString() }, clock), /cannot be reached/)
    })
    await t.test('invalid tool and incomplete onboarding reject, while accepted Cross Path tutorial gating remains', async () => {
      bLocation = await enter(b, cross.areaId); advance()
      await service().read(b)
      await assert.rejects(service().execute(b, command(bLocation, 'harvest', crossNode)), /Equip your Field Knife/)
      await assert.rejects(service().execute(fresh, command({ revision: 0 }, 'harvest', crossNode)), /Farm introduction/)
      await connection.query("insert into player_grower_events(id,player_id,event_type,source_command_id,occurred_at,payload)values($1,$2,'world-foundation-location-v1',$3,$4,$5)", [crypto.randomUUID(), fresh, crypto.randomUUID(), clock, { ...aLocation, revision: 0 }])
      await assert.rejects(world.transition(fresh, { v: 1, commandId: crypto.randomUUID(), expectedRevision: 0, exitId: 'to-path-3' }), /appearance/)
      await starting.execute(b, { type: 'equip-tool', itemId: 'field-knife', commandId: crypto.randomUUID() })
    })
    await t.test('successful wild reward is ordinary Inventory, XP/cooldown/receipt commit atomically and survive new service instances', async () => {
      const before = await quantity(a, crossNode.speciesId), oldXp = (await starting.read(a)).harvestingXp
      firstHarvest = command(aLocation, 'harvest', crossNode)
      const result = await service().execute(a, firstHarvest)
      assert.deepEqual(result.reward, { name: crossNode.displayName, speciesId: crossNode.speciesId, quantity: 6, harvestingXp: 10 })
      assert.equal(await quantity(a, crossNode.speciesId), before + 6); assert.equal(result.starting.harvestingXp, oldXp + 10)
      assert.equal(result.starting.tutorialSeedAvailable, false); assert.equal(result.starting.farmSeedAvailable, false)
      readyAt = result.projection.nodes.find(n => n.entityId === crossNode.entityId).readyAt
      assert.equal(Date.parse(readyAt) - clock.getTime(), crossNode.respawnSeconds * 1000)
      const projection = await lifecycle.getProjectionV3(a)
      assert.equal(projection.seedStacks.find(n => n.speciesId === crossNode.speciesId).quantity, before + 6)
      assert.equal((await service().read(a)).projection.nodes.find(n => n.entityId === crossNode.entityId).readyAt, readyAt)
      const replay = await service().execute(a, firstHarvest); assert.equal(replay.starting.harvestingXp, oldXp + 10); assert.equal(await quantity(a, crossNode.speciesId), before + 6)
      await assert.rejects(service().execute(a, { ...firstHarvest, position: { x: crossNode.x + 1, y: crossNode.y } }), /already used/)
      assert.equal((await connection.query("select count(*)::int n from player_grower_events where player_id=$1 and source_command_id=$2 and event_type='first-basin-exploration-checkpoint-v1'", [a, firstHarvest.commandId])).rows[0].n, 1)
    })
    await t.test('refresh and a new command cannot duplicate the cooldown harvest; exact server respawn allows a fresh reward', async () => {
      await assert.rejects(service().execute(a, command(aLocation, 'harvest', crossNode)), /recovering/)
      clock = new Date(Date.parse(readyAt) - 1); await assert.rejects(service().execute(a, command(aLocation, 'harvest', crossNode)), /recovering/)
      clock = new Date(readyAt); const before = await quantity(a, crossNode.speciesId)
      const result = await service().execute(a, command(aLocation, 'harvest', crossNode)); assert.equal(await quantity(a, crossNode.speciesId), before + 6); assert.equal(result.reward.quantity, 6)
    })
    await t.test('two personal players harvest the same node once each; competing commands for one player award only once', async () => {
      const before = await quantity(b, crossNode.speciesId)
      const commands = [command(bLocation, 'harvest', crossNode), command(bLocation, 'harvest', crossNode)]
      const outcomes = await Promise.allSettled(commands.map(c => service().execute(b, c)))
      assert.equal(outcomes.filter(o => o.status === 'fulfilled').length, 1); assert.equal(outcomes.filter(o => o.status === 'rejected').length, 1)
      assert.equal(await quantity(b, crossNode.speciesId), before + 6); assert.equal((await starting.read(b)).harvestingXp, 10)
      const winner = commands[outcomes.findIndex(o => o.status === 'fulfilled')]
      await Promise.all([service().execute(b, winner), service().execute(b, winner)]); assert.equal(await quantity(b, crossNode.speciesId), before + 6)
      assert.notEqual((await service().read(a)).projection.nodes.find(n => n.entityId === crossNode.entityId).readyAt, null)
      assert.notEqual((await service().read(b)).projection.nodes.find(n => n.entityId === crossNode.entityId).readyAt, null)
    })
    await t.test('server anchors successive different nodes and rejects impossible rapid jumps', async () => {
      aLocation = await enter(a, 'path-2'); advance()
      const nodes = findArea('path-2').interactables.filter(n => n.kind === 'harvestable')
      await service().execute(a, command(aLocation, 'harvest', nodes[0]))
      await assert.rejects(service().execute(a, command(aLocation, 'harvest', nodes[1])), /too fast/)
      advance(); await service().execute(a, command(aLocation, 'harvest', nodes[1]))
    })
    await t.test('same-revision relogin restores only the entry reach window, preserving cooldowns/XP and replay cannot re-anchor', async () => {
      const area = findArea('path-2'), note = area.interactables.find(n => n.kind === 'inspectable'), before = await service().read(a)
      await assert.rejects(service().execute(a, command(aLocation, 'inspect', note)), /too fast/)
      const restore = { v: 1, commandId: crypto.randomUUID(), expectedWorldRevision: aLocation.revision }
      const restored = await service().restoreEntry(a, restore)
      assert.deepEqual(restored.projection.nodes, before.projection.nodes); assert.deepEqual(restored.projection.landmarks, before.projection.landmarks); assert.deepEqual(restored.starting, before.starting)
      const navigation = new NavigationMap(area.width, area.height, area.collision), route = navigation.route(aLocation.position, note)
      let length = 0, from = aLocation.position
      for (const point of route) { length += Math.hypot(point.x - from.x, point.y - from.y); from = point }
      advance(Math.ceil(length / 245 * 1000) + 500)
      const inspected = await service().execute(a, command(aLocation, 'inspect', note)); assert.ok(inspected.projection.notes.find(n => n.noteId === note.noteId).discoveredAt)
      const replay = await service().restoreEntry(a, restore); assert.equal(replay.projection.revision, inspected.projection.revision)
      const saved = (await connection.query("select payload from player_grower_events where player_id=$1 and event_type='first-basin-exploration-checkpoint-v1' order by (payload->>'revision')::integer desc limit 1", [a])).rows[0].payload
      assert.deepEqual(saved.anchor.position, { x: note.x, y: note.y }, 'retry does not reset a later movement anchor')
      assert.deepEqual(replay.projection.nodes, before.projection.nodes); assert.deepEqual(replay.starting, before.starting)
      await assert.rejects(service().restoreEntry(a, { ...restore, commandId: crypto.randomUUID(), expectedWorldRevision: aLocation.revision - 1 }), /location changed/)
    })
    await t.test('five authored Basin landmarks persist separately from Travel, replay gives no reward and never discovers another player', async () => {
      aLocation = await enter(a, 'the-first-basin'); bLocation = await enter(b, 'the-first-basin'); advance()
      const area = findArea('the-first-basin'), beforeXp = (await starting.read(a)).harvestingXp, travel = structuredClone(aLocation.discoveredTravelDestinationIds)
      const navigation = new NavigationMap(area.width, area.height, area.collision)
      for (const landmark of area.landmarks) {
        const position = navigation.route(aLocation.position, landmark).at(-1)
        advance(); const c = command(aLocation, 'discover-landmark', landmark, position)
        const result = await service().execute(a, c); assert.equal(result.reward, undefined)
        const at = result.projection.landmarks.find(n => n.landmarkId === landmark.landmarkId).discoveredAt
        assert.ok(at); await service().execute(a, c); advance(); const duplicate = await service().execute(a, command(aLocation, 'discover-landmark', landmark, position))
        assert.equal(duplicate.projection.landmarks.find(n => n.landmarkId === landmark.landmarkId).discoveredAt, at)
      }
      assert.equal((await service().read(a)).projection.landmarks.filter(n => n.areaId === area.areaId && n.discoveredAt).length, 5)
      assert.equal((await service().read(b)).projection.landmarks.filter(n => n.discoveredAt).length, 0)
      assert.equal((await starting.read(a)).harvestingXp, beforeXp); assert.deepEqual((await world.read(a)).discoveredTravelDestinationIds, travel)
    })
    await t.test('Basin Cave formation records both the sixth landmark and a persistent flavor note without a resource reward', async () => {
      aLocation = await enter(a, 'basin-cave'); advance()
      const area = findArea('basin-cave'), landmark = area.landmarks[0], formation = area.interactables.find(n => n.kind === 'inspectable')
      const discovered = await service().execute(a, command(aLocation, 'discover-landmark', landmark)); assert.ok(discovered.projection.landmarks.find(n => n.landmarkId === landmark.landmarkId).discoveredAt)
      const inspected = await service().execute(a, command(aLocation, 'inspect', formation)); assert.equal(inspected.reward, undefined)
      const note = inspected.projection.notes.find(n => n.noteId === formation.noteId); assert.ok(note.discoveredAt)
      assert.equal((await service().read(a)).projection.notes.find(n => n.noteId === formation.noteId).discoveredAt, note.discoveredAt)
      assert.equal((await service().read(b)).projection.notes.find(n => n.noteId === formation.noteId).discoveredAt, null)
    })
    await t.test('blocked Path 5 can be inspected and its expansion remains blocked', async () => {
      aLocation = await enter(a, 'path-5-under-construction'); advance()
      const area = findArea(aLocation.areaId), marker = area.interactables.find(n => n.kind === 'inspectable')
      assert.equal(marker.description, 'Route under construction.'); await service().execute(a, command(aLocation, 'inspect', marker))
      await assert.rejects(world.transition(a, { v: 1, commandId: crypto.randomUUID(), expectedRevision: aLocation.revision, exitId: 'future-route' }), /Route under construction/)
      assert.equal((await world.read(a)).areaId, area.areaId)
    })
    await t.test('bounded own discovery/cooldown resets preserve seeds, XP, notes, equipment, world and the other player', async () => {
      const before = await service().read(a), other = await service().read(b), inventory = await lifecycle.getProjectionV3(a), location = await world.read(a)
      const landmarks = { v: 1, commandId: crypto.randomUUID(), type: 'reset-landmarks', expectedRevision: before.projection.revision }
      const [result, replay] = await Promise.all([service().reset(a, landmarks), service().reset(a, landmarks)])
      assert.deepEqual(result, replay); assert.equal(result.projection.landmarks.filter(n => n.discoveredAt).length, 0); assert.deepEqual(result.projection.notes, before.projection.notes)
      assert.deepEqual(result.starting, before.starting); assert.deepEqual((await lifecycle.getProjectionV3(a)).seedStacks, inventory.seedStacks); assert.deepEqual(await world.read(a), location)
      const cooldowns = await service().reset(a, { v: 1, commandId: crypto.randomUUID(), type: 'reset-cooldowns', expectedRevision: result.projection.revision })
      assert.ok(cooldowns.projection.nodes.every(n => n.readyAt === null)); assert.deepEqual(cooldowns.starting, before.starting); assert.deepEqual((await service().read(b)).projection, other.projection)
      await assert.rejects(service().reset(a, { ...landmarks, commandId: crypto.randomUUID() }), /state changed/)
      await assert.rejects(new ExplorationService(db, { environment: 'production' }).reset(a, landmarks), e => e.status === 404)
    })
    await t.test('tutorial reset preserves ordinary wild XP/seeds, while its controlled normal reward is separate and remains once-account', async () => {
      // Accepted tutorial reset needs the same existing narrow occupancy/display privileges as normal tooling.
      await connection.query('grant update on player_profiles to exploration_runtime; grant delete,update on nursery_occupancies,player_garden_displays to exploration_runtime')
      const before = await starting.read(a), seedBefore = await quantity(a, 'echinopsis-pachanoi')
      const reset = new StartingResetService(db, 'staging')
      const first = await reset.execute(a, { commandId: crypto.randomUUID(), targetPlayerId: a, confirmPlayerId: a, mode: 'tutorial' })
      assert.equal(first.starting.harvestingXp, before.harvestingXp); assert.equal(await quantity(a, 'echinopsis-pachanoi'), seedBefore)
      assert.equal(first.starting.equipment.tool, null); assert.deepEqual(first.starting.ownedEquipment, [])
      for (const c of [{ type: 'save-appearance', appearance: { skin: 0, shirt: 0 } }, { type: 'talk-guide', entityId: 'mara-guide' }, { type: 'equip-tool', itemId: 'field-knife' }, { type: 'harvest-plant', entityId: 'first-san-pedro' }]) await starting.execute(a, { ...c, commandId: crypto.randomUUID() })
      assert.equal((await starting.read(a)).harvestingXp, before.harvestingXp + 10)
      assert.equal(await quantity(a, 'echinopsis-pachanoi'), seedBefore + 2, 'wild XP does not suppress the first tutorial economic credit')
      await reset.execute(a, { commandId: crypto.randomUUID(), targetPlayerId: a, confirmPlayerId: a, mode: 'tutorial' })
      assert.equal((await starting.read(a)).harvestingXp, before.harvestingXp, 'reset removes tutorial XP while preserving normal wild XP')
      for (const c of [{ type: 'save-appearance', appearance: { skin: 0, shirt: 0 } }, { type: 'talk-guide', entityId: 'mara-guide' }, { type: 'equip-tool', itemId: 'field-knife' }, { type: 'harvest-plant', entityId: 'first-san-pedro' }]) await starting.execute(a, { ...c, commandId: crypto.randomUUID() })
      assert.equal(await quantity(a, 'echinopsis-pachanoi'), seedBefore + 2, 'subsequent tutorial reset never repeats its normal seed credit')
    })
    await t.test('unexpected reward persistence failure rolls back normal seeds, XP, cooldown and both event receipts', async () => {
      bLocation = await enter(b, 'path-4'); advance()
      const target = findArea('path-4').interactables.find(n => n.kind === 'harvestable'), beforeSeeds = await quantity(b, target.speciesId), before = await service().read(b), c = command(bLocation, 'harvest', target)
      await connection.query(`create function reject_exploration_receipt()returns trigger language plpgsql as $$begin if new.event_type='first-basin-exploration-checkpoint-v1' and new.source_command_id='${c.commandId}'::uuid then raise exception 'isolated rollback fixture'; end if; return new; end$$; create trigger reject_exploration_receipt before insert on player_grower_events for each row execute function reject_exploration_receipt();`)
      await assert.rejects(service().execute(b, c), e => /isolated rollback fixture/.test(e.cause?.message))
      await connection.query('drop trigger reject_exploration_receipt on player_grower_events; drop function reject_exploration_receipt()')
      assert.equal(await quantity(b, target.speciesId), beforeSeeds); assert.deepEqual((await service().read(b)).starting, before.starting); assert.deepEqual((await service().read(b)).projection, before.projection)
      assert.equal((await connection.query('select count(*)::int n from player_grower_events where player_id=$1 and source_command_id=$2', [b, c.commandId])).rows[0].n, 0)
    })
    assert.equal(WORLD.areas.length, 11)
  } finally { await pool.end(); await connection.end(); await cluster.stop() }
})
