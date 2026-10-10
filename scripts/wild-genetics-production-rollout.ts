import { Client } from 'pg'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

class RolloutError extends Error {}
const args = process.argv.slice(2), database = 'cactigrow', owner = 'cactigrow_owner', runtime = 'cactigrow_runtime'
const modes = ['--ensure', '--verify', '--check-connection'].filter(flag => args.includes(flag))
const operation = modes.length === 1 ? modes[0] : null
let client: Client | undefined
try {
  if (!operation || args.some(a => !['--ensure', '--verify', '--check-connection', '--confirm-database', database].includes(a))) throw new RolloutError('Use --check-connection, --verify or --ensure --confirm-database cactigrow. This tool supports production only.')
  if (operation === '--ensure' && process.env.CACTIGROW_PRODUCTION_MIGRATION_CONFIRM !== '0008') throw new RolloutError('Set CACTIGROW_PRODUCTION_MIGRATION_CONFIRM=0008 only after explicit production migration approval.')
  if (operation === '--ensure' && args[args.indexOf('--confirm-database') + 1] !== database) throw new RolloutError('Confirm cactigrow before applying additive migration 0008.')
  const value = process.env.CACTIGROW_OWNER_DATABASE_URL
  if (!value) throw new RolloutError('The existing direct production owner connection must be loaded securely as CACTIGROW_OWNER_DATABASE_URL in this process. Do not paste it into chat or command arguments.')
  let target: URL
  try { target = new URL(value) } catch { throw new RolloutError('Invalid owner connection configuration.') }
  if (!['postgres:', 'postgresql:'].includes(target.protocol) || target.pathname !== '/' + database || target.hostname.includes('-pooler.') || decodeURIComponent(target.username) !== owner) throw new RolloutError('Use the direct cactigrow / cactigrow_owner connection. Every other database or role is rejected.')
  client = new Client({ connectionString: value, connectionTimeoutMillis: 15000 }); await client.connect()
  const { rows: [identity] } = await client.query('select current_database() as database,current_user as role')
  if (identity.database !== database || identity.role !== owner) throw new RolloutError('Production owner identity mismatch. Required: cactigrow / cactigrow_owner. No migration or grant was executed.')
  console.log('Verified connection identity: database=cactigrow; current_user=cactigrow_owner.')
  if (operation !== '--check-connection') {
    const migration = await readFile(new URL('../server/db/migrations/0008_slim_giant_man.sql', import.meta.url), 'utf8')
    const hash = createHash('sha256').update(migration).digest('hex')
    const journal = JSON.parse(await readFile(new URL('../server/db/migrations/meta/_journal.json', import.meta.url), 'utf8')) as { entries: { tag: string; when: number }[] }
    const entry = journal.entries.find(e => e.tag === '0008_slim_giant_man')
    if (!entry) throw new RolloutError('Migration 0008 journal entry missing.')
    const { rows: [catalog] } = await client.query("select to_regclass('public.wild_genetic_seeds') is not null as present,to_regclass('drizzle.__drizzle_migrations') is not null as tracking")
    if (!catalog.tracking) throw new RolloutError('Existing migration tracking is required.')
    const prior = await client.query('select 1 from drizzle.__drizzle_migrations where hash=$1 and created_at=$2', [hash, entry.when])
    if (!catalog.present) {
      if (operation !== '--ensure') throw new RolloutError('Additive migration 0008 is not applied. No deployment is safe yet.')
      const later = await client.query('select 1 from drizzle.__drizzle_migrations where created_at >= $1 limit 1', [entry.when])
      if (prior.rowCount || later.rowCount) throw new RolloutError('Migration tracking conflicts with the absent table. Inspect before applying.')
      await client.query('begin')
      await client.query(migration)
      await client.query('insert into drizzle.__drizzle_migrations(hash,created_at)values($1,$2)', [hash, entry.when])
      await client.query('commit')
      console.log('Applied only additive wild genetic seed migration 0008 to cactigrow.')
    } else if (prior.rowCount !== 1) throw new RolloutError('Existing wild genetic table has no exact migration 0008 tracking. Inspect before proceeding.')
    const { rows: [role] } = await client.query('select rolsuper,rolcreaterole,rolcreatedb from pg_roles where rolname=$1', [runtime])
    const { rows: [schema] } = await client.query("select has_schema_privilege($1,'public','CREATE') as creates,has_schema_privilege($1,'public','USAGE') as uses", [runtime])
    if (!role || role.rolsuper || role.rolcreaterole || role.rolcreatedb || schema.creates || !schema.uses) throw new RolloutError('Production runtime role is missing or elevated.')
    const missing: string[] = []
    for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) {
      const { rows: [row] } = await client.query("select has_table_privilege($1,'public.wild_genetic_seeds',$2) as allowed", [runtime, privilege])
      if (['SELECT', 'INSERT', 'UPDATE'].includes(privilege)) { if (!row.allowed) missing.push(privilege) }
      else if (row.allowed) throw new RolloutError(`Unexpected wild genetic seed ${privilege} privilege. No automatic revocation performed.`)
    }
    if (missing.length) {
      if (operation !== '--ensure') throw new RolloutError('Missing narrow wild genetic seed privileges: ' + missing.join('/'))
      await client.query(`grant ${missing.join(',')} on public.wild_genetic_seeds to cactigrow_runtime`)
      console.log('Applied only missing SELECT/INSERT/UPDATE privileges on the new table.')
    }
    const { rows: [constraints] } = await client.query("select count(*)::int n from pg_constraint where conrelid='public.wild_genetic_seeds'::regclass and convalidated and conname=any($1)", [['wild_genetic_seeds_pkey','wild_genetic_seeds_clone_line_id_unique','wild_genetic_seeds_planted_specimen_id_unique','wild_genetic_seeds_lot_ordinal_unique','wild_genetic_seeds_ordinal_bounded','wild_genetic_seeds_status_valid','wild_genetic_seeds_owner_player_id_players_id_fk','wild_genetic_seeds_clone_line_id_clone_lines_id_fk','wild_genetic_seeds_planted_specimen_id_plant_specimens_id_fk']])
    const { rows: [index] } = await client.query("select count(*)::int n from pg_indexes where schemaname='public' and tablename='wild_genetic_seeds' and indexname='wild_genetic_seeds_owner_idx'")
    if (constraints.n !== 9 || index.n !== 1) throw new RolloutError('Wild genetic seed constraints/index validation failed.')
    for (const privilege of ['SELECT', 'INSERT', 'UPDATE']) {
      const { rows: [row] } = await client.query("select has_table_privilege($1,'public.wild_genetic_seeds',$2) as allowed", [runtime, privilege]); if (!row.allowed) throw new RolloutError('Wild genetic seed privilege verification failed.')
    }
    console.log('Verified migration 0008 and narrow production grants. Existing cultivation/runtime preflight is still required before deployment. No old migration or grant was rerun.')
  }
} catch (error) {
  await client?.query('rollback').catch(() => undefined)
  console.error(error instanceof RolloutError ? error.message : 'Wild genetics rollout failed. Native query/connection details were withheld.')
  process.exitCode = 1
} finally { await client?.end().catch(() => undefined) }
