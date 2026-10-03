import { Client } from 'pg'
import { createHash } from 'node:crypto'
import { ApiError } from '../server/api/errors.ts'
class OwnerCommandError extends Error {}
import { drizzle } from 'drizzle-orm/node-postgres'
import { readFile } from 'node:fs/promises'
import { bootstrapOwner } from '../server/admin/bootstrapOwner.ts'
import { isCanonicalUuid } from '../shared/realtime/identifiers.ts'

// Credentials are supplied only through the process environment, never flags or output.
const args = process.argv.slice(2)
const option = (key: string) => { const i = args.indexOf(key); return i < 0 ? undefined : args[i + 1] }
const environment = option('--environment')
const expectedDatabase = environment === 'staging' ? 'cactigrow_staging' : environment === 'production' ? 'cactigrow' : environment === 'local' ? 'cactigrow_local' : undefined
const runtime = environment === 'staging' ? 'cactigrow_staging_runtime' : environment === 'production' ? 'cactigrow_runtime' : undefined
const connectionString = process.env.CACTIGROW_OWNER_DATABASE_URL
if (!expectedDatabase || !connectionString) throw new OwnerCommandError('Use --environment local|staging|production with CACTIGROW_OWNER_DATABASE_URL supplied securely.')
let target: URL
try { target = new URL(connectionString) } catch { throw new OwnerCommandError('Invalid owner connection configuration.') }
if (target.pathname !== '/' + expectedDatabase || target.hostname.includes('-pooler.') || decodeURIComponent(target.username).endsWith('_runtime') || (environment === 'local' && !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname))) throw new OwnerCommandError('An exact direct OWNER database connection is required; local targets must use loopback.')
const operations = ['--apply-migration', '--apply-grants', '--verify-grants', '--player-id', '--lookup-name'].filter(flag => args.includes(flag))
if (operations.length !== 1) throw new OwnerCommandError('Choose exactly one migration, grants, verification or target-preview operation.')
const client = new Client({ connectionString })
try {
  await client.connect()
  const { rows: [identity] } = await client.query<{ database: string; role: string }>('select current_database() as database, current_user as role')
  if (identity.database !== expectedDatabase || identity.role.endsWith('_runtime')) throw new OwnerCommandError('Database target or owner connection mismatch.')
  if (args.includes('--apply-migration')) {
    if (option('--confirm-database') !== expectedDatabase) throw new OwnerCommandError('Confirm the exact database before applying migration 0006.')
    const { rows: [catalog] } = await client.query("select to_regclass('public.admin_role_assignments') is not null as roles, to_regclass('public.admin_audit_log') is not null as audit")
    if (catalog.roles || catalog.audit) throw new OwnerCommandError('Admin tables already exist or partial schema exists. Inspect before applying; do not rerun.')
    await client.query('begin')
    const migration = await readFile(new URL('../server/db/migrations/0006_admin_roles_audit_v1.sql', import.meta.url), 'utf8')
    await client.query(migration)
    const { rows: [tracking] } = await client.query("select to_regclass('drizzle.__drizzle_migrations') is not null as present")
    if (tracking.present) {
      const journal = JSON.parse(await readFile(new URL('../server/db/migrations/meta/_journal.json', import.meta.url), 'utf8')) as { entries: { tag: string; when: number }[] }
      const entry = journal.entries.find(e => e.tag === '0006_admin_roles_audit_v1')!
      await client.query('insert into drizzle.__drizzle_migrations(hash,created_at) values($1,$2)', [createHash('sha256').update(migration).digest('hex'), entry.when])
    }
    await client.query('commit')
    console.log(`Applied only additive migration 0006 to ${expectedDatabase}. No existing gameplay tables changed.`)
  } else if (args.includes('--apply-grants')) {
    if (!runtime || option('--confirm-database') !== expectedDatabase) throw new OwnerCommandError('Confirm the staging/production database before applying narrow Admin grants.')
    await client.query('begin')
    await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON admin_role_assignments TO ${runtime}`)
    await client.query(`GRANT SELECT, INSERT ON admin_audit_log TO ${runtime}`)
    await client.query('commit')
    console.log(`Applied narrow Admin privileges for ${runtime}. No existing grants changed.`)
  } else if (args.includes('--verify-grants')) {
    if (!runtime) throw new OwnerCommandError('Grant verification requires staging or production.')
    const privileges = await client.query('select has_table_privilege($1, $2, $3) as allowed', [runtime, 'admin_audit_log', 'SELECT'])
    if (!privileges.rows[0].allowed) throw new OwnerCommandError('Missing audit SELECT privilege.')
    for (const [table, required, denied] of [['admin_role_assignments', ['SELECT', 'INSERT', 'UPDATE', 'DELETE'], []], ['admin_audit_log', ['SELECT', 'INSERT'], ['UPDATE', 'DELETE']]] as const) {
      for (const privilege of [...required, ...denied]) {
        const { rows: [row] } = await client.query('select has_table_privilege($1,$2,$3) as allowed', [runtime, table, privilege])
        if (row.allowed !== (required as readonly string[]).includes(privilege)) throw new OwnerCommandError(`Unexpected ${table} ${privilege} privilege.`)
      }
    }
    const { rows: [role] } = await client.query('select rolsuper,rolcreaterole,rolcreatedb from pg_roles where rolname=$1', [runtime])
    const { rows: [schema] } = await client.query("select has_schema_privilege($1,'public','CREATE') as allowed", [runtime])
    if (!role || role.rolsuper || role.rolcreaterole || role.rolcreatedb || schema.allowed) throw new OwnerCommandError('Runtime role is elevated.')
    console.log(`Verified narrow Admin grants and non-elevated role on ${expectedDatabase}.`)
  } else {
    const playerId = option('--player-id'), name = option('--lookup-name')
    if ((!playerId && !name) || (playerId && !isCanonicalUuid(playerId))) throw new OwnerCommandError('Provide an exact --player-id UUID or read-only --lookup-name.')
    const result = playerId ? await client.query('select p.id as player_id, f.display_name, f.public_id, p.created_at from players p left join player_profiles f on f.player_id=p.id where p.id=$1', [playerId]) : await client.query('select p.id as player_id, f.display_name, f.public_id, p.created_at from players p join player_profiles f on f.player_id=p.id where lower(f.display_name)=lower($1) limit 2', [name])
    if (result.rowCount !== 1) throw new OwnerCommandError('Target is missing or ambiguous. No assignment performed.')
    console.log(JSON.stringify({ database: expectedDatabase, target: result.rows[0], mode: 'read-only target preview' }))
    if (option('--confirm-player-id')) {
      if (!playerId) throw new OwnerCommandError('Name lookup cannot assign roles; rerun with the explicit UUID.')
      console.log(JSON.stringify(await bootstrapOwner(drizzle(client), playerId, option('--confirm-player-id')!)))
    } else console.log('No role changed. Explicit --player-id and matching --confirm-player-id are required to bootstrap the first OWNER.')
  }
} catch (error) {
  await client.query('rollback').catch(() => undefined)
  // Avoid native connection errors, query text or credentials in CLI output.
  console.error(error instanceof OwnerCommandError || error instanceof ApiError ? error.message : 'Owner operation failed. No credentials or raw query were logged.')
  process.exitCode = 1
} finally { await client.end().catch(() => undefined) }
