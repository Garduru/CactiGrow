import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { createServer } from 'node:net'
import { mkdir, readFile, readdir, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { drizzle } from 'drizzle-orm/node-postgres'
import { verifyDevToolsUi } from './devToolsUi.integration.mjs'

test('dev commands use authenticated ownership, atomic receipts and real PostgreSQL; real UI immediately reconciles HUD/skills/seeds', { skip: !process.env.CACTIGROW_EMBEDDED_POSTGRES_MODULE && 'Set the existing isolated embedded PostgreSQL module path.' }, async () => {
  const { default: EmbeddedPostgres } = await import(process.env.CACTIGROW_EMBEDDED_POSTGRES_MODULE)
  const probe = createServer(); await new Promise(r => probe.listen(0, '127.0.0.1', r)); const port = probe.address().port; await new Promise(r => probe.close(r))
  const cluster = new EmbeddedPostgres({ databaseDir: resolve(tmpdir(), `cactigrow-devtools-${crypto.randomUUID()}`), user: 'postgres', password: crypto.randomUUID(), port, persistent: true, postgresFlags: ['-h', '127.0.0.1'], onLog() {}, onError() {} })
  await cluster.initialise(); await cluster.start(); await cluster.createDatabase('cactigrow_local')
  const pg = cluster.getPgClient('cactigrow_local', '127.0.0.1'); await pg.connect()
  await mkdir('node_modules/.tmp', { recursive: true })
  const out = resolve(`node_modules/.tmp/devtools-db-${crypto.randomUUID()}.mjs`)
  await build({ stdin: { contents: `export {handleApiRequest} from './server/api/handler.ts';export {createApiRouter} from './server/api/router.ts';export {CactiGrowApiClient} from './src/services/api/CactiGrowApiClient.ts';export {initializeStagingGrower} from './server/staging/initializeGrower.ts';export {PlantLifecycleService} from './server/gameplay/PlantLifecycleService.ts';`, resolveDir: process.cwd() }, bundle: true, packages: 'external', platform: 'node', format: 'esm', outfile: out })
  const { handleApiRequest, createApiRouter, CactiGrowApiClient, initializeStagingGrower } = await import(pathToFileURL(out).href)
  try {
    for (const file of (await readdir('server/db/migrations')).filter(f => f.endsWith('.sql')).sort()) await pg.query(await readFile('server/db/migrations/' + file, 'utf8'))
    const ids = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()], [a, b, ui] = ids
    for (const [i, id] of ids.entries()) {
      await pg.query('insert into players(id) values($1)', [id]); await initializeStagingGrower(drizzle(pg), id)
      await pg.query('insert into player_profiles(player_id,public_id,display_name) values($1,$2,$3)', [id, crypto.randomUUID(), 'Dev Tester ' + i])
    }
    await pg.query(`create role devtools_runtime;grant usage on schema public to devtools_runtime;grant select on all tables in schema public to devtools_runtime;
      grant insert,update on player_onboarding,player_grower_state,player_seed_stacks,player_plant_lifecycle_versions,gameplay_command_receipts,plant_specimens,marketplace_listings,nursery_occupancies to devtools_runtime;
      grant delete on nursery_occupancies to devtools_runtime;
      grant insert on player_grower_events,clone_lines,genetic_profiles,clone_line_variants,bred_seeds to devtools_runtime;
      grant insert,update,delete on player_garden_specimens,player_garden_displays to devtools_runtime;`)
    const router = createApiRouter({ authenticationConfigurationFactory: () => ({ identityProvider: { verify: async request => ids.includes(request.getHeader('x-test-player')) ? { provider: 'test', subject: request.getHeader('x-test-player') } : null }, createPlayerIdentityResolver: async () => ({ resolve: async identity => ({ playerId: identity.subject }) }) }) })
    const errors = []
    const client = (id, environment = 'development') => new CactiGrowApiClient({ baseUrl: 'http://local.test', getCredentials: () => ({ 'x-test-player': id }), fetch: (url, init) => handleApiRequest(new Request(url, init), { CACTIGROW_ENVIRONMENT: environment, CACTIGROW_VERSION: 'test', HYPERDRIVE: { connectionString: `postgresql://runtime@127.0.0.1:${port}/cactigrow_local` } }, undefined, { router, createRequestDatabaseContext: () => {
      let connection, ready
      return { getDatabase: () => { if (!ready) { connection = cluster.getPgClient('cactigrow_local', '127.0.0.1'); ready = connection.connect().then(() => connection.query('set role devtools_runtime')).then(() => drizzle(connection)) }; return ready }, dispose: async () => { if (ready) { await ready; await connection.end() } } }
    }, reportUnexpectedError: e => errors.push(e) }) })
    const ca = client(a), cb = client(b)
    const command = (type, extra = {}) => ({ commandId: crypto.randomUUID(), type, ...extra })
    await assert.rejects(client(a, 'production').executeDevCommand(command('add-currency', { amount: 100 })), e => e.status === 404)
    await assert.rejects(client('invalid').executeDevCommand(command('add-currency', { amount: 100 })), e => e.status === 401)
    const xp = command('add-xp', { skillId: 'cultivation', amount: 1000 })
    const added = await ca.executeDevCommand(xp); assert.equal(added.grower.player.skills.cultivationXp, 1000)
    await ca.executeDevCommand(xp); assert.equal((await ca.getGrowerAlpha()).player.skills.cultivationXp, 1000)
    await assert.rejects(ca.executeDevCommand({ ...xp, amount: 2000 }), e => e.code === 'IDEMPOTENCY_KEY_REUSED')
    const money = command('add-currency', { amount: 1000 })
    await Promise.all([ca.executeDevCommand(money), ca.executeDevCommand(money)])
    assert.equal((await ca.getGrowerAlpha()).player.tokenBalance, 1000)
    const addSeeds = command('adjust-seeds', { speciesId: 'echinopsis-pachanoi', amount: 10 })
    const seeds = await ca.executeDevCommand(addSeeds); assert.equal(seeds.lifecycle.seedStacks.find(s => s.speciesId === addSeeds.speciesId).quantity, 14)
    await ca.executeDevCommand(addSeeds)
    await assert.rejects(ca.executeDevCommand(command('adjust-seeds', { speciesId: addSeeds.speciesId, amount: -100 })), e => e.status === 400)
    assert.equal((await ca.getPlantLifecycleV3()).seedStacks.find(s => s.speciesId === addSeeds.speciesId).quantity, 14)
    await assert.rejects(ca.executeDevCommand(command('adjust-seeds', { speciesId: 'unknown', amount: 10 })), e => e.status === 400)
    assert.equal((await cb.getGrowerAlpha()).player.tokenBalance, 0)
    const beforePlant = await ca.getPlantLifecycleV3()
    const planted = await ca.plantCommoditySeedV3({ slotId: 'slot-1', speciesId: addSeeds.speciesId, expectedSeedStackVersion: beforePlant.seedStacks.find(s => s.speciesId === addSeeds.speciesId).version }, crypto.randomUUID())
    const before = planted.slot.occupancy
    await assert.rejects(cb.executeDevCommand(command('advance-growth', { specimenId: before.specimen.specimenId, minutes: 'complete' })), e => e.status === 404)
    await assert.rejects(ca.getDevSpecimen(crypto.randomUUID()), e => e.status === 404)
    await assert.rejects(cb.getDevSpecimen(before.specimen.specimenId), e => e.status === 404)
    const accelerate = command('advance-growth', { specimenId: before.specimen.specimenId, minutes: 1 })
    const advanced = await ca.executeDevCommand(accelerate), after = advanced.lifecycle.nursery.slots[0].occupancy
    assert.equal(after.plantedAt, before.plantedAt); assert.deepEqual(after.specimen.genetics, before.specimen.genetics); assert.equal(after.specimen.cloneLineId, before.specimen.cloneLineId)
    assert.ok(Date.parse(after.readyAt) <= Date.parse(before.readyAt)); assert.equal(after.growthRuleVersion, before.growthRuleVersion)
    const replay = await ca.executeDevCommand(accelerate); assert.equal(replay.lifecycle.nursery.slots[0].occupancy.readyAt, after.readyAt)
    const completed = await ca.executeDevCommand(command('advance-growth', { specimenId: before.specimen.specimenId, minutes: 'complete' }))
    const slot = completed.lifecycle.nursery.slots[0]
    await ca.collectPlantV3({ slotId: slot.slotId, specimenId: slot.occupancy.specimen.specimenId, expectedOccupancyVersion: slot.occupancy.version, expectedSpecimenVersion: slot.occupancy.specimen.version }, crypto.randomUUID())
    assert.equal((await ca.getPlantLifecycleV3()).ownedSpecimens.length, 1)
    const id = before.specimen.specimenId
    assert.equal((await ca.getDevSpecimen(id)).npcSaleEligible, true)
    await ca.mutateGarden({ commandId: crypto.randomUUID(), type: 'favorite', specimenId: id, favorite: true })
    const favorite = await ca.getDevSpecimen(id); assert.equal(favorite.npcSaleEligible, false); assert.equal(favorite.listingEligible, false); assert.ok(favorite.npcValue > 0)
    await assert.rejects(ca.mutateGrowerAlpha(command('list-specimen', { specimenId: id, askingPrice: 100 })), e => e.status === 409)
    await verifyDevToolsUi(client(ui), ui)
    assert.deepEqual(errors, [])
  } finally { await pg.end(); await cluster.stop(); await unlink(out) }
})
