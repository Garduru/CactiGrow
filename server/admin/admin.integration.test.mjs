import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { createServer } from 'node:net'
import { mkdir, readFile, readdir, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { drizzle } from 'drizzle-orm/node-postgres'
import { spawn } from 'node:child_process'
import { verifyAdminToolsUi } from './adminUi.integration.mjs'

test('Admin RBAC, current-role authorization, atomic audits, replay, owner safety and marketplace moderation against disposable PostgreSQL', { skip: !process.env.CACTIGROW_EMBEDDED_POSTGRES_MODULE && 'Set the existing isolated embedded PostgreSQL module path.' }, async t => {
  const { default: EmbeddedPostgres } = await import(process.env.CACTIGROW_EMBEDDED_POSTGRES_MODULE)
  const probe = createServer(); await new Promise(r => probe.listen(0, '127.0.0.1', r)); const port = probe.address().port; await new Promise(r => probe.close(r))
  const cluster = new EmbeddedPostgres({ databaseDir: resolve(tmpdir(), `cactigrow-admin-${crypto.randomUUID()}`), user: 'postgres', password: crypto.randomUUID(), port, persistent: true, postgresFlags: ['-h', '127.0.0.1'], onLog() {}, onError() {} })
  await cluster.initialise(); await cluster.start(); await cluster.createDatabase('admin_test')
  const pg = cluster.getPgClient('admin_test', '127.0.0.1'); await pg.connect()
  await mkdir('node_modules/.tmp', { recursive: true }); const out = resolve(`node_modules/.tmp/admin-db-${crypto.randomUUID()}.mjs`)
  await build({ stdin: { contents: `export {handleApiRequest} from './server/api/handler.ts';export {createApiRouter} from './server/api/router.ts';export {CactiGrowApiClient} from './src/services/api/CactiGrowApiClient.ts';export {initializeStagingGrower} from './server/staging/initializeGrower.ts';export {bootstrapOwner} from './server/admin/bootstrapOwner.ts';`, resolveDir: process.cwd() }, bundle: true, packages: 'external', platform: 'node', format: 'esm', outfile: out })
  const { handleApiRequest, createApiRouter, CactiGrowApiClient, initializeStagingGrower, bootstrapOwner } = await import(pathToFileURL(out).href)
  try {
    for (const file of (await readdir('server/db/migrations')).filter(f => f.endsWith('.sql')).sort()) await pg.query(await readFile('server/db/migrations/' + file, 'utf8'))
    const ids = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()], [owner, moderator, admin, player] = ids
    const database = drizzle(pg)
    for (const [i, id] of ids.entries()) { await pg.query('insert into players(id) values($1)', [id]); await initializeStagingGrower(database, id); await pg.query('update player_onboarding set token_balance=100,cultivation_xp=100 where player_id=$1', [id]); await pg.query('insert into player_profiles(player_id,public_id,display_name) values($1,$2,$3)', [id, crypto.randomUUID(), 'Admin Test ' + i]) }
    const baselinePlayers = (await pg.query('select * from players order by id')).rows
    await assert.rejects(bootstrapOwner(database, owner, player), e => e.status === 400)
    await assert.rejects(bootstrapOwner(database, crypto.randomUUID(), crypto.randomUUID()), e => e.status === 400)
    await bootstrapOwner(database, owner, owner)
    await assert.rejects(bootstrapOwner(database, admin, admin), e => e.status === 409)
    await pg.query(`create role admin_runtime;grant usage on schema public to admin_runtime;grant select on all tables in schema public to admin_runtime;
      grant insert,update on player_onboarding,player_grower_state,player_seed_stacks,player_plant_lifecycle_versions,gameplay_command_receipts,plant_specimens,marketplace_listings,nursery_occupancies to admin_runtime;
      grant insert on player_grower_events,clone_lines,genetic_profiles,clone_line_variants,bred_seeds,admin_audit_log to admin_runtime;
      grant insert,update,delete on admin_role_assignments,player_garden_specimens,player_garden_displays to admin_runtime;grant delete on nursery_occupancies to admin_runtime;`)
    const router = createApiRouter({ authenticationConfigurationFactory: () => ({ identityProvider: { verify: async request => ids.includes(request.getHeader('x-test-player')) ? { provider: 'test', subject: request.getHeader('x-test-player') } : null }, createPlayerIdentityResolver: async () => ({ resolve: async identity => ({ playerId: identity.subject }) }) }) })
    const errors = []
    const fetchAs = (id, environment = 'production') => (url, init) => handleApiRequest(new Request(url, { ...init, headers: { ...Object.fromEntries(new Headers(init?.headers)), 'x-test-player': id } }), { CACTIGROW_ENVIRONMENT: environment, CACTIGROW_VERSION: 'test', CACTIGROW_ACCESS_TEAM_DOMAIN: 'https://access.test', CACTIGROW_ACCESS_AUDIENCE: 'test', HYPERDRIVE: { connectionString: `postgresql://runtime@127.0.0.1:${port}/cactigrow_local` } }, undefined, { router, createRequestDatabaseContext: () => {
      let connection, ready
      return { getDatabase: () => { if (!ready) { connection = cluster.getPgClient('admin_test', '127.0.0.1'); ready = connection.connect().then(() => connection.query('set role admin_runtime')).then(() => drizzle(connection)) }; return ready }, dispose: async () => { if (ready) { await ready; await connection.end() } } }
    }, reportUnexpectedError: e => errors.push(e) })
    const client = (id, environment) => new CactiGrowApiClient({ baseUrl: 'https://admin.test', getCredentials: () => ({ 'x-test-player': id }), fetch: fetchAs(id, environment) })
    const co = client(owner), cm = client(moderator), ca = client(admin), cp = client(player)
    const command = extra => ({ commandId: crypto.randomUUID(), reason: 'Isolated support verification', confirmed: true, ...extra })
    const countAudits = async () => Number((await pg.query('select count(*) from admin_audit_log')).rows[0].count)
    const role = (target, next) => co.mutateAdmin(target, 'role', command({ role: next, ...(next === 'OWNER' ? { confirmOwnerPlayerId: target } : {}) }))
    await t.test('anonymous 401, PLAYER 403 on every admin namespace; no success audits', async () => {
      const before = await countAudits()
      for (const path of ['/me', '/players/search?q=Admin', `/players/${player}`, `/players/${player}/currency`, '/roles', '/audit', '/marketplace', `/specimens/${crypto.randomUUID()}`]) {
        const method = path.endsWith('/currency') ? 'POST' : 'GET'
        const init = { method, headers: { 'content-type': 'application/json' }, ...(method === 'POST' ? { body: JSON.stringify(command({ delta: 1 })) } : {}) }
        assert.equal((await fetchAs('invalid')('https://admin.test/api/v1/admin' + path, init)).status, 401)
        assert.equal((await fetchAs(player)('https://admin.test/api/v1/admin' + path, init)).status, 403)
      }
      assert.equal(await countAudits(), before)
    })
    await t.test('role transitions, bounded moderator reads and granular denials', async () => {
      await role(moderator, 'MODERATOR'); await role(admin, 'ADMIN')
      assert.equal((await cm.getAdminSession()).role, 'MODERATOR')
      assert.equal((await ca.getAdminSession()).role, 'ADMIN')
      assert.equal((await co.getAdminSession()).role, 'OWNER')
      const inspection = await cm.inspectAdminPlayer(player)
      assert.ok(inspection.social); assert.equal(inspection.currency, undefined); assert.equal(inspection.skills, undefined); assert.equal(inspection.seeds, undefined)
      assert.ok((await cm.searchAdminPlayers('Admin Test')).items.length <= 25)
      await assert.rejects(cm.searchAdminPlayers('%'), e => e.status === 400)
      assert.equal((await cm.searchAdminPlayers('%_')).items.length, 0)
    })
    await t.test('moderator cannot correct economy, inventory, progression, read audits/specimens or manage roles; admin cannot manage roles', async () => {
      const before = await countAudits()
      for (const action of ['currency', 'progression', 'inventory', 'role']) await assert.rejects(cm.mutateAdmin(player, action, command({ delta: 1, skillId: 'cultivation', speciesId: 'echinopsis-pachanoi', role: 'ADMIN' })), e => e.status === 403)
      await assert.rejects(cm.getAdminAudit(), e => e.status === 403); await assert.rejects(cm.getAdminRoles(), e => e.status === 403); await assert.rejects(cm.inspectAdminSpecimen(crypto.randomUUID()), e => e.status === 403)
      await assert.rejects(ca.mutateAdmin(admin, 'role', command({ role: 'OWNER', confirmOwnerPlayerId: admin })), e => e.status === 403)
      assert.equal(await countAudits(), before)
    })
    await t.test('atomic signed corrections, exact audit, sequential/concurrent replay, conflicts and failure rollback', async () => {
      const before = await countAudits(), money = command({ delta: 5 })
      const first = await ca.mutateAdmin(player, 'currency', money)
      assert.equal(first.audit.before.balance, 100); assert.equal(first.audit.after.balance, 105); assert.equal(first.audit.actorPlayerId, admin); assert.equal(first.audit.actorRole, 'ADMIN'); assert.equal(first.audit.targetPlayerId, player); assert.equal(first.audit.reason, money.reason)
      assert.equal((await ca.mutateAdmin(player, 'currency', money)).replayed, true)
      const concurrent = command({ delta: -2 }); await Promise.all([ca.mutateAdmin(player, 'currency', concurrent), ca.mutateAdmin(player, 'currency', concurrent)])
      assert.equal((await ca.inspectAdminPlayer(player)).currency, 103); assert.equal(await countAudits(), before + 2)
      await assert.rejects(ca.mutateAdmin(player, 'currency', { ...money, delta: 6 }), e => e.code === 'IDEMPOTENCY_KEY_REUSED')
      await assert.rejects(ca.mutateAdmin(player, 'currency', command({ delta: -999 })), e => e.status === 400)
      await assert.rejects(ca.mutateAdmin(player, 'currency', command({ delta: 1, reason: '' })), e => e.status === 400)
      await assert.rejects(ca.mutateAdmin(player, 'currency', command({ delta: 1, confirmed: false })), e => e.status === 400)
      await assert.rejects(ca.mutateAdmin(player, 'currency', command({ delta: 1, playerId: admin })), e => e.status === 400)
      assert.equal(await countAudits(), before + 2)
      await ca.mutateAdmin(player, 'progression', command({ delta: -17, skillId: 'cultivation' }))
      const skill = (await ca.inspectAdminPlayer(player)).skills.find(s => s.id === 'cultivation'); assert.equal(skill.xp, 83); assert.equal(skill.level, 2)
      await assert.rejects(ca.mutateAdmin(player, 'progression', command({ delta: -999, skillId: 'cultivation' })), e => e.status === 400)
      await ca.mutateAdmin(player, 'inventory', command({ delta: 1, speciesId: 'echinopsis-pachanoi' }))
      assert.equal((await ca.inspectAdminPlayer(player)).seeds.find(s => s.speciesId === 'echinopsis-pachanoi').quantity, 5)
      const total = await countAudits()
      await assert.rejects(ca.mutateAdmin(player, 'inventory', command({ delta: -100, speciesId: 'echinopsis-pachanoi' })), e => e.status === 400)
      await assert.rejects(ca.mutateAdmin(player, 'inventory', command({ delta: 1, speciesId: 'unknown' })), e => e.status === 400)
      assert.equal(await countAudits(), total)
      await pg.query('revoke insert on admin_audit_log from admin_runtime')
      const failed = await fetchAs(admin)('https://admin.test/api/v1/admin/players/' + player + '/currency', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(command({ delta: 50 })) })
      assert.equal(failed.status, 500); assert.equal((await ca.inspectAdminPlayer(player)).currency, 103)
      assert.equal(await countAudits(), total)
      await pg.query('grant insert on admin_audit_log to admin_runtime'); errors.length = 0
    })
    await t.test('moderator cancellation preserves ownership/currency, rejects later purchase and audits once', async () => {
      const line = crypto.randomUUID(), specimen = crypto.randomUUID(), listing = crypto.randomUUID(), now = new Date()
      await pg.query("insert into clone_lines(id,species_id,origin_type,origin_player_id,established_at,genetic_representation_version,visual_derivation_version) values($1,'echinopsis-pachanoi','commodity',$2,$3,1,1)", [line, player, now])
      await pg.query("insert into plant_specimens(id,owner_player_id,clone_line_id,source_type,lifecycle_status,planted_at,collected_at,visual_derivation_version) values($1,$2,$3,'commodity','owned',$4,$4,1)", [specimen, player, line, now])
      await pg.query("insert into marketplace_listings(id,seller_player_id,specimen_id,asking_price,status,created_at) values($1,$2,$3,10,'active',$4)", [listing, player, specimen, now])
      const balances = (await pg.query('select player_id,token_balance from player_onboarding order by player_id')).rows
      const mutation = command({})
      await cm.mutateAdmin(listing, 'cancel-listing', mutation); await cm.mutateAdmin(listing, 'cancel-listing', mutation)
      assert.equal((await pg.query('select status from marketplace_listings where id=$1', [listing])).rows[0].status, 'cancelled')
      assert.equal((await pg.query('select owner_player_id from plant_specimens where id=$1', [specimen])).rows[0].owner_player_id, player)
      assert.deepEqual((await pg.query('select player_id,token_balance from player_onboarding order by player_id')).rows, balances)
      assert.equal((await cm.getAdminListings()).items.length, 0)
      assert.equal((await ca.inspectAdminSpecimen(specimen)).ownerPlayerId, player)
      await assert.rejects(co.mutateGrowerAlpha({ commandId: crypto.randomUUID(), type: 'buy-marketplace-listing', listingId: listing }), e => e.status === 409)
      assert.equal(Number((await pg.query('select count(*) from admin_audit_log where command_id=$1', [mutation.commandId])).rows[0].count), 1)
    })
    await t.test('current-role revocation, strong owner promotion, last-owner and concurrent cross-demotion safety', async () => {
      await assert.rejects(co.mutateAdmin(owner, 'role', command({ role: 'PLAYER' })), e => e.status === 409)
      await assert.rejects(co.mutateAdmin(admin, 'role', command({ role: 'OWNER', confirmOwnerPlayerId: player })), e => e.status === 400)
      await role(admin, 'OWNER')
      const results = await Promise.allSettled([co.mutateAdmin(admin, 'role', command({ role: 'ADMIN' })), ca.mutateAdmin(owner, 'role', command({ role: 'ADMIN' }))])
      assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
      assert.equal(Number((await pg.query("select count(*) from admin_role_assignments where role='OWNER'")).rows[0].count), 1)
      const remaining = (await pg.query("select player_id from admin_role_assignments where role='OWNER'")).rows[0].player_id
      const ownerClient = client(remaining)
      await ownerClient.mutateAdmin(moderator, 'role', command({ role: 'PLAYER' }))
      await assert.rejects(cm.getAdminSession(), e => e.status === 403)
      await assert.rejects(cm.getAdminListings(), e => e.status === 403)
      await ownerClient.mutateAdmin(moderator, 'role', command({ role: 'MODERATOR' }))
      assert.equal((await cm.getAdminSession()).role, 'MODERATOR')
      await ownerClient.mutateAdmin(moderator, 'role', command({ role: 'ADMIN' }))
      assert.equal((await cm.getAdminSession()).role, 'ADMIN')
    })
    await t.test('production dev tools stay rejected for OWNER, safe audit page, append-only runtime grants, player rows preserved', async () => {
      const actualOwner = client((await pg.query("select player_id from admin_role_assignments where role='OWNER'")).rows[0].player_id)
      await assert.rejects(actualOwner.getDevSession(), e => e.status === 404)
      await assert.rejects(actualOwner.executeDevCommand({ commandId: crypto.randomUUID(), type: 'add-currency', amount: 1 }), e => e.status === 404)
      const page = await ca.getAdminAudit(); assert.ok(page.items.length <= 50); assert.equal(JSON.stringify(page).includes('requestFingerprint'), false)
      const connection = cluster.getPgClient('admin_test', '127.0.0.1'); await connection.connect(); await connection.query('set role admin_runtime')
      await assert.rejects(connection.query('delete from admin_audit_log'), e => e.code === '42501')
      await assert.rejects(connection.query("update admin_audit_log set reason='changed'"), e => e.code === '42501'); await connection.end()
      assert.deepEqual((await pg.query('select * from players order by id')).rows, baselinePlayers)
      assert.deepEqual(errors, [])
    })
    await t.test('real Admin UI requires review/reason, calls typed client/Worker/PostgreSQL and reconciles own authoritative HUD', async () => {
      const id = (await pg.query("select player_id from admin_role_assignments where role='OWNER'")).rows[0].player_id
      const before = await countAudits()
      await verifyAdminToolsUi(client(id), id)
      assert.equal(await countAudits(), before + 1)
      assert.deepEqual(errors, [])
    })
    await t.test('direct owner CLI applies only 0006, verifies narrow grants, previews unique targets and requires exact bootstrap confirmation', async () => {
      await cluster.createDatabase('cactigrow_staging')
      const connection = cluster.getPgClient('cactigrow_staging', '127.0.0.1'); await connection.connect()
      try {
        for (const file of (await readdir('server/db/migrations')).filter(f => f.endsWith('.sql') && !f.startsWith('0006')).sort()) await connection.query(await readFile('server/db/migrations/' + file, 'utf8'))
        await connection.query('create role cactigrow_staging_runtime; revoke create on schema public from public')
        const target = crypto.randomUUID()
        await connection.query('insert into players(id) values($1)', [target])
        await connection.query('insert into player_profiles(player_id,public_id,display_name) values($1,$2,$3)', [target, crypto.randomUUID(), 'CLI Owner Test'])
        const secureUrl = `postgresql://postgres:${encodeURIComponent(connection.connectionParameters.password)}@127.0.0.1:${port}/cactigrow_staging`
        const run = flags => new Promise((resolveRun, reject) => {
          const child = spawn(process.execPath, ['--experimental-strip-types', 'scripts/admin-owner.ts', '--environment', 'staging', ...flags], { env: { ...process.env, CACTIGROW_OWNER_DATABASE_URL: secureUrl }, windowsHide: true })
          let output = ''; child.stdout.on('data', data => { output += data }); child.stderr.on('data', data => { output += data })
          child.on('error', reject); child.on('close', code => resolveRun({ code, output }))
        })
        const expect = async (flags, success) => { const result = await run(flags); assert.equal(result.output.includes(secureUrl), false); assert.equal(result.output.includes(connection.connectionParameters.password), false); assert.equal(result.code, success ? 0 : 1, result.output); return result.output }
        await expect(['--apply-migration', '--confirm-database', 'cactigrow'], false)
        assert.equal((await connection.query("select to_regclass('public.admin_audit_log') as name")).rows[0].name, null)
        await expect(['--apply-migration', '--confirm-database', 'cactigrow_staging'], true)
        await expect(['--apply-migration', '--confirm-database', 'cactigrow_staging'], false)
        await expect(['--apply-grants', '--confirm-database', 'cactigrow_staging'], true)
        await expect(['--verify-grants'], true)
        assert.ok((await expect(['--lookup-name', 'CLI Owner Test'], true)).includes(target))
        await expect(['--lookup-name', 'CLI Owner Test', '--confirm-player-id', target], false)
        await expect(['--player-id', target], true)
        assert.equal(Number((await connection.query('select count(*) from admin_role_assignments')).rows[0].count), 0)
        await expect(['--player-id', target, '--confirm-player-id', crypto.randomUUID()], false)
        await expect(['--player-id', target, '--confirm-player-id', target], true)
        await expect(['--player-id', target, '--confirm-player-id', target], false)
        assert.equal((await connection.query('select role from admin_role_assignments where player_id=$1', [target])).rows[0].role, 'OWNER')
        assert.equal(Number((await connection.query("select count(*) from admin_audit_log where action='OWNER_BOOTSTRAPPED'")).rows[0].count), 1)
      } finally { await connection.end() }
    })
  } finally { await pg.end(); await cluster.stop(); await unlink(out) }
})
