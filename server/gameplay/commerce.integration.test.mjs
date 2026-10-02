import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { registerHooks } from 'node:module'
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { createServer } from 'node:net'

const pgliteModule = process.env.CACTIGROW_PGLITE_MODULE
const embeddedModule = process.env.CACTIGROW_EMBEDDED_POSTGRES_MODULE

test('Commerce authenticated API and PostgreSQL transactions preserve balances, ownership and receipts', { skip: !pgliteModule && !embeddedModule && 'Set CACTIGROW_PGLITE_MODULE to an installed PGlite module for isolated SQL validation.' }, async () => {
  const hooks = pgliteModule ? registerHooks({ resolve(specifier, context, next) { return specifier === '@electric-sql/pglite' ? { url: pgliteModule, shortCircuit: true } : next(specifier, context) } }) : null
  let pg, cluster, drizzle
  if (embeddedModule) {
    const { default: EmbeddedPostgres } = await import(embeddedModule)
    const probe = createServer(); await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve))
    const port = probe.address().port; await new Promise((resolve) => probe.close(resolve))
    cluster = new EmbeddedPostgres({ databaseDir: resolve(tmpdir(), `cactigrow-commerce-test-${crypto.randomUUID()}`), user: 'postgres', password: crypto.randomUUID(), port, persistent: true, postgresFlags: ['-h', '127.0.0.1'], onLog() {}, onError() {} })
    await cluster.initialise(); await cluster.start()
    await cluster.createDatabase('commerce_test')
    const connection = cluster.getPgClient('commerce_test', '127.0.0.1'); await connection.connect()
    pg = { query: (...args) => connection.query(...args), exec: (sql) => connection.query(sql), close: () => connection.end(), connection }
    ;({ drizzle } = await import('drizzle-orm/node-postgres'))
  } else {
    const { PGlite } = await import(pgliteModule); pg = new PGlite()
    ;({ drizzle } = await import('drizzle-orm/pglite'))
  }
  await mkdir('node_modules/.tmp', { recursive: true })
  const out = resolve('node_modules/.tmp/commerce-test-bundle.mjs')
  await build({ stdin: { contents: `export { GrowerAlphaService } from './server/gameplay/GrowerAlphaService.ts'; export { MarketplaceService } from './server/gameplay/MarketplaceService.ts'; export { PlantLifecycleService } from './server/gameplay/PlantLifecycleService.ts'; export { initializeStagingGrower } from './server/staging/initializeGrower.ts'; export { handleApiRequest } from './server/api/handler.ts'; export { createApiRouter } from './server/api/router.ts'; export { CactiGrowApiClient } from './src/services/api/CactiGrowApiClient.ts'; export { isGrowerAlphaCommandV1 } from './shared/api/growerAlphaV1.ts';`, resolveDir: process.cwd() }, bundle: true, packages: 'external', platform: 'node', format: 'esm', outfile: out })
  const { GrowerAlphaService, MarketplaceService, PlantLifecycleService, initializeStagingGrower, handleApiRequest, createApiRouter, CactiGrowApiClient, isGrowerAlphaCommandV1 } = await import(pathToFileURL(out).href)
  try {
    for (const file of (await readdir('server/db/migrations')).filter((f) => f.endsWith('.sql')).sort()) await pg.exec(await readFile('server/db/migrations/' + file, 'utf8'))
    const database = drizzle(pg.connection ?? pg)
    const ids = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()]
    const [a, b, c] = ids
    for (const [i, id] of ids.entries()) {
      await pg.query('insert into players(id) values ($1)', [id]); await initializeStagingGrower(database, id)
      await pg.query('update player_onboarding set token_balance=1000 where player_id=$1', [id])
      await pg.query('insert into player_profiles(player_id,public_id,display_name) values($1,$2,$3)', [id, crypto.randomUUID(), 'Trader ' + i])
    }
    // Existing runtime table permissions, never production grants.
    await pg.exec(`create role commerce_runtime; grant usage on schema public to commerce_runtime; grant select on all tables in schema public to commerce_runtime;
      grant insert,update on player_onboarding,player_grower_state,player_seed_stacks,player_plant_lifecycle_versions,gameplay_command_receipts,plant_specimens,marketplace_listings,nursery_occupancies to commerce_runtime;
      grant insert on player_grower_events to commerce_runtime; grant insert,update,delete on player_garden_displays,player_garden_specimens to commerce_runtime;`)
    const router = createApiRouter({ authenticationConfigurationFactory: () => ({
      identityProvider: { verify: async (request) => ids.includes(request.getHeader('x-test-player')) ? { provider: 'test', subject: request.getHeader('x-test-player') } : null },
      createPlayerIdentityResolver: async () => ({ resolve: async (identity) => ({ playerId: identity.subject }) }),
    }) })
    const errors = []
    const client = (id) => new CactiGrowApiClient({ baseUrl: 'https://commerce.test', getCredentials: () => ({ 'x-test-player': id }), fetch: (url, init) => handleApiRequest(new Request(url, init), { CACTIGROW_ENVIRONMENT: 'production', CACTIGROW_VERSION: 'test' }, undefined, { router, createRequestDatabaseContext: () => {
      if (!cluster) return { getDatabase: async () => database, dispose: async () => {} }
      const connection = cluster.getPgClient('commerce_test', '127.0.0.1')
      const ready = connection.connect().then(() => connection.query('set role commerce_runtime')).then(() => drizzle(connection))
      return { getDatabase: () => ready, dispose: async () => { await ready; await connection.end() } }
    }, reportUnexpectedError: (e) => errors.push(e) }) })
    const ca = client(a), cb = client(b), cc = client(c)
    const command = (type, extra = {}) => ({ type, commandId: crypto.randomUUID(), ...extra })
    const balance = async (id) => (await pg.query('select token_balance from player_onboarding where player_id=$1', [id])).rows[0].token_balance
    const stack = async (id) => (await pg.query("select quantity from player_seed_stacks where player_id=$1 and species_id='echinopsis-pachanoi'", [id])).rows[0].quantity
    await pg.exec('set role commerce_runtime')
    await assert.rejects(client('invalid').getShopCatalog(), (e) => e.status === 401)
    const catalog = await ca.getShopCatalog(); assert.equal(catalog.items.length, 2)
    const buy = command('buy-shop-seeds', { itemId: catalog.items[0].id, quantity: 2 })
    assert.equal(isGrowerAlphaCommandV1({ ...buy, price: 1 }), false)
    const purchased = await ca.mutateGrowerAlpha(buy); assert.equal(purchased.player.tokenBalance, 950); assert.equal(await stack(a), 6); assert.equal(purchased.commerceInventory.seedStacks.find((s) => s.speciesId === 'echinopsis-pachanoi').quantity, 6)
    await ca.mutateGrowerAlpha(buy); assert.equal(await balance(a), 950); assert.equal(await stack(a), 6)
    await assert.rejects(ca.mutateGrowerAlpha({ ...buy, quantity: 3 }), (e) => e.code === 'IDEMPOTENCY_KEY_REUSED')
    for (const quantity of [0, -1, 101, 1.5]) await assert.rejects(ca.mutateGrowerAlpha(command('buy-shop-seeds', { itemId: buy.itemId, quantity })), (e) => e.status === 400)
    await assert.rejects(ca.mutateGrowerAlpha(command('buy-shop-seeds', { itemId: 'invalid', quantity: 1 })), (e) => e.status === 400)
    await assert.rejects(ca.mutateGrowerAlpha(command('buy-shop-seeds', { itemId: buy.itemId, quantity: 100 })), (e) => e.status === 409)
    assert.equal(await balance(a), 950); assert.equal(await stack(a), 6)
    await pg.exec('reset role')
    const specimen = crypto.randomUUID(), clone = crypto.randomUUID()
    const stamp = new Date('2026-01-01T00:00:00Z')
    await pg.query("insert into clone_lines(id,species_id,origin_type,origin_player_id,established_at,genetic_representation_version,visual_derivation_version) values($1,'echinopsis-pachanoi','commodity-seed',$2,$3,1,1)", [clone, a, stamp])
    await pg.query('insert into genetic_profiles(clone_line_id,vigor,growth_speed,size,flowering,mutation_chance,establishment_rule_version) values($1,50,50,50,50,50,1)', [clone])
    await pg.query("insert into plant_specimens(id,owner_player_id,clone_line_id,source_type,lifecycle_status,planted_at,collected_at,visual_derivation_version) values($1,$2,$3,'commodity-seed','owned',$4,$4,1)", [specimen, a, clone, stamp])
    const parent = crypto.randomUUID()
    await pg.query("insert into plant_specimens(id,owner_player_id,clone_line_id,source_type,lifecycle_status,planted_at,collected_at,visual_derivation_version) values($1,$2,$3,'commodity-seed','sold',$4,$4,1)", [parent, a, clone, stamp])
    await pg.query("insert into bred_seeds(id,owner_player_id,clone_line_id,parent_1_specimen_id,parent_2_specimen_id,parent_1_species_id,parent_2_species_id,is_hybrid,genetic_features,status,created_at,planted_at,planted_specimen_id) values($1,$2,$3,$4,$5,'echinopsis-pachanoi','echinopsis-pachanoi',false,'[]','planted',$6,$6,$4)", [crypto.randomUUID(), a, clone, specimen, parent, stamp])
    await pg.query('insert into player_garden_specimens(player_id,specimen_id,favorite) values($1,$2,true)', [a, specimen])
    await pg.exec('set role commerce_runtime')
    for (const type of ['list-specimen', 'sell-specimen-to-npc']) await assert.rejects(ca.mutateGrowerAlpha(command(type, { specimenId: specimen, ...(type === 'list-specimen' ? { askingPrice: 450 } : {}) })), (e) => e.status === 409 && /Unfavorite/.test(e.message))
    await pg.query('update player_garden_specimens set favorite=false where specimen_id=$1', [specimen])
    await assert.rejects(cb.mutateGrowerAlpha(command('list-specimen', { specimenId: specimen, askingPrice: 450 })), (e) => e.status === 404)
    const listed = await ca.mutateGrowerAlpha(command('list-specimen', { specimenId: specimen, askingPrice: 450 }))
    const listingId = listed.marketplaceListings.find((l) => l.status === 'active').id
    await assert.rejects(ca.mutateGrowerAlpha(command('list-specimen', { specimenId: specimen, askingPrice: 500 })), (e) => e.status === 409)
    await assert.rejects(ca.mutateGrowerAlpha(command('sell-specimen-to-npc', { specimenId: specimen })), (e) => e.status === 409)
    const browsing = await cb.getMarketplace(); assert.equal(browsing.listings[0].seller.displayName, 'Trader 0'); assert.equal(browsing.listings[0].knowledge.quantitativeGenetics, undefined)
    if (process.env.CACTIGROW_COMMERCE_FIXTURE_PATH) await writeFile(process.env.CACTIGROW_COMMERCE_FIXTURE_PATH, JSON.stringify({
      shop: catalog, market: browsing, grower: await cb.getGrowerAlpha(), plants: await cb.getPlantLifecycleV3(), garden: await cb.getGarden(),
      sellerPlants: await ca.getPlantLifecycleV3(), sellerGrower: await ca.getGrowerAlpha(), sellerGarden: await ca.getGarden(),
    }))
    assert.equal(JSON.stringify(browsing).includes(a), false); assert.equal(JSON.stringify(browsing).includes('ownerPlayerId'), false)
    await pg.exec('reset role')
    await pg.query("update player_profiles set display_name='Renamed Trader' where player_id=$1", [a])
    await pg.exec('set role commerce_runtime')
    assert.equal((await cb.getMarketplace()).listings[0].seller.displayName, 'Renamed Trader')
    await assert.rejects(ca.mutateGrowerAlpha(command('buy-marketplace-listing', { listingId })), (e) => e.status === 409)
    await pg.query('update player_onboarding set token_balance=0 where player_id=$1', [b])
    await assert.rejects(cb.mutateGrowerAlpha(command('buy-marketplace-listing', { listingId })), (e) => e.status === 409)
    assert.equal((await cb.getMarketplace()).listings[0].status, 'active'); assert.equal(await balance(a), 950)
    await pg.query('update player_onboarding set token_balance=1000 where player_id=$1', [b])
    // Fail after debit/credit and garden cleanup: the entire transaction must roll back.
    await pg.exec('reset role')
    await pg.exec(`create function reject_test_transfer() returns trigger language plpgsql as $$ begin raise exception 'Injected transfer failure'; end $$;
      create trigger reject_test_transfer before update of owner_player_id on plant_specimens for each row execute function reject_test_transfer();`)
    await pg.exec('set role commerce_runtime')
    await assert.rejects(cb.mutateGrowerAlpha(command('buy-marketplace-listing', { listingId })), (e) => e.status === 500)
    assert.equal(await balance(a), 950); assert.equal(await balance(b), 1000)
    assert.equal((await cb.getMarketplace()).listings[0].status, 'active')
    assert.equal((await pg.query('select owner_player_id from plant_specimens where id=$1', [specimen])).rows[0].owner_player_id, a)
    assert.equal((await pg.query('select count(*)::int as n from player_garden_specimens where specimen_id=$1', [specimen])).rows[0].n, 1)
    assert.equal(errors.length, 1); errors.length = 0
    await pg.exec('reset role')
    await pg.exec('drop trigger reject_test_transfer on plant_specimens; drop function reject_test_transfer()')
    await pg.exec('set role commerce_runtime')
    const winnerCommand = command('buy-marketplace-listing', { listingId })
    const competing = await Promise.allSettled([cb.mutateGrowerAlpha(winnerCommand), cc.mutateGrowerAlpha(command('buy-marketplace-listing', { listingId }))])
    assert.equal(competing.filter((r) => r.status === 'fulfilled').length, 1)
    const winner = competing[0].status === 'fulfilled' ? b : c
    assert.equal(await balance(a), 1400); assert.equal(await balance(winner), 550)
    const row = (await pg.query('select * from plant_specimens where id=$1', [specimen])).rows[0]
    assert.equal(row.owner_player_id, winner); assert.equal(row.clone_line_id, clone); assert.equal(row.planted_at.toISOString(), stamp.toISOString())
    assert.equal((await cb.getMarketplace()).listings.length, 0)
    assert.equal((await ca.getMarketplace(true)).listings[0].status, 'sold')
    if (winner === b) { await cb.mutateGrowerAlpha(winnerCommand); assert.equal(await balance(a), 1400) }
    const lifecycle = new PlantLifecycleService(database, { environment: 'production' })
    const owned = (await lifecycle.getProjectionV3(winner)).ownedSpecimens[0]
    assert.equal(owned.specimenId, specimen)
    assert.deepEqual(owned.parentPlantIds, [specimen, parent])
    assert.equal((await lifecycle.getProjectionV3(a)).ownedSpecimens.length, 0)
    const winningClient = winner === b ? cb : cc
    const relisted = await winningClient.mutateGrowerAlpha(command('list-specimen', { specimenId: specimen, askingPrice: 500 }))
    const activeId = relisted.marketplaceListings.find((l) => l.status === 'active').id
    await winningClient.mutateGrowerAlpha(command('cancel-listing', { listingId: activeId }))
    await assert.rejects(ca.mutateGrowerAlpha(command('buy-marketplace-listing', { listingId: activeId })), (e) => e.status === 409)
    await winningClient.mutateGrowerAlpha(command('sell-specimen-to-npc', { specimenId: specimen }))
    assert.equal((await lifecycle.getProjectionV3(winner)).ownedSpecimens.length, 0)
    assert.equal(errors.length, 0, String(errors[0]))
    assert.ok(new GrowerAlphaService(database)); assert.ok(new MarketplaceService(database))
  } finally { await pg.close(); if (cluster) await cluster.stop(); hooks?.deregister() }
})
