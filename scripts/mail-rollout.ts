import { Client } from 'pg'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

class RolloutError extends Error {}
// Uses the existing owner environment variable; never accepts credentials as arguments.
const args = process.argv.slice(2)
const option = (key: string) => { const i = args.indexOf(key); return i < 0 ? undefined : args[i + 1] }
const environment = option('--environment')
const database = environment === 'staging' ? 'cactigrow_staging' : environment === 'production' ? 'cactigrow' : undefined
const runtime = environment === 'staging' ? 'cactigrow_staging_runtime' : 'cactigrow_runtime'
const operations = ['--ensure', '--apply-migration', '--apply-grants', '--verify'].filter(flag => args.includes(flag))
let client: Client | undefined
try {
  if (!database || operations.length !== 1) throw new RolloutError('Specify --environment staging|production and exactly one of --ensure, --apply-migration, --apply-grants, --verify.')
  const connectionString = process.env.CACTIGROW_OWNER_DATABASE_URL
  if (!connectionString) throw new RolloutError('Supply the existing direct owner connection securely through CACTIGROW_OWNER_DATABASE_URL.')
  let target: URL
  try { target = new URL(connectionString) } catch { throw new RolloutError('Invalid owner connection configuration.') }
  if (!['postgres:', 'postgresql:'].includes(target.protocol) || target.pathname !== '/' + database || target.hostname.includes('-pooler.') || decodeURIComponent(target.username).endsWith('_runtime')) throw new RolloutError('The exact environment database and a direct owner connection are required.')
  if (operations[0] !== '--verify' && option('--confirm-database') !== database) throw new RolloutError('Confirm the exact database before applying the mailbox migration or grants.')
  client = new Client({ connectionString })
  await client.connect()
  const { rows: [identity] } = await client.query('select current_database() as database, current_user as role')
  if (identity.database !== database || identity.role.endsWith('_runtime')) throw new RolloutError('Owner database identity mismatch.')
  const migration = await readFile(new URL('../server/db/migrations/0007_hard_supreme_intelligence.sql', import.meta.url), 'utf8')
  const hash = createHash('sha256').update(migration).digest('hex')
  const journal = JSON.parse(await readFile(new URL('../server/db/migrations/meta/_journal.json', import.meta.url), 'utf8')) as { entries: { tag: string; when: number }[] }
  const entry = journal.entries.find(e => e.tag === '0007_hard_supreme_intelligence')
  if (!entry) throw new RolloutError('Mailbox migration journal entry missing.')
  const { rows: [catalog] } = await client.query("select to_regclass('public.mail_messages') is not null as mail, to_regclass('drizzle.__drizzle_migrations') is not null as tracking")
  if (!catalog.tracking) throw new RolloutError('Existing migration tracking must be verified before rollout.')
  if (operations[0] === '--apply-migration' || operations[0] === '--ensure' && !catalog.mail) {
    if (catalog.mail) throw new RolloutError('Mailbox table already exists. Use --verify; do not rerun migration 0007.')
    const applied = await client.query('select 1 from drizzle.__drizzle_migrations where hash=$1 or created_at >= $2 limit 1', [hash, entry.when])
    if (applied.rowCount) throw new RolloutError('Migration tracking is inconsistent with the absent mailbox table. Inspect before applying.')
    await client.query('begin')
    await client.query(migration)
    await client.query('insert into drizzle.__drizzle_migrations(hash,created_at) values($1,$2)', [hash, entry.when])
    await client.query('commit')
    catalog.mail = true
    console.log(`Applied only additive mailbox migration 0007 to ${database}.`)
  }
  if (operations[0] !== '--apply-migration') {
    if (!catalog.mail) throw new RolloutError('Mailbox migration has not been applied.')
    const tracked = await client.query('select 1 from drizzle.__drizzle_migrations where hash=$1 and created_at=$2', [hash, entry.when])
    if (tracked.rowCount !== 1) throw new RolloutError('Exact mailbox migration tracking was not verified.')
    const { rows: [role] } = await client.query('select rolsuper,rolcreaterole,rolcreatedb from pg_roles where rolname=$1', [runtime])
    const { rows: [schema] } = await client.query("select has_schema_privilege($1,'public','CREATE') as creates, has_schema_privilege($1,'public','USAGE') as uses", [runtime])
    if (!role || role.rolsuper || role.rolcreaterole || role.rolcreatedb || schema.creates || !schema.uses) throw new RolloutError('Existing runtime role is missing or elevated.')
    const missing: string[] = []
    for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) {
      const { rows: [row] } = await client.query("select has_table_privilege($1,'public.mail_messages',$2) as allowed", [runtime, privilege])
      if (['SELECT', 'INSERT', 'UPDATE'].includes(privilege)) { if (!row.allowed) missing.push(privilege) }
      else if (row.allowed) throw new RolloutError(`Unexpected mailbox ${privilege} privilege. Inspect existing grants; no automatic revocation performed.`)
    }
    const { rows: [indices] } = await client.query("select count(*)::int as total from pg_indexes where schemaname='public' and tablename='mail_messages' and indexname=any($1)", [['mail_messages_pending_specimen_unique', 'mail_messages_inbox_idx', 'mail_messages_sent_idx']])
    if (indices.total !== 3) throw new RolloutError('Required mailbox indices were not verified.')
    const constraintNames = ['mail_messages_pkey', 'mail_messages_sender_command_unique', 'mail_messages_distinct_players', 'mail_messages_text_bounded', 'mail_messages_claim_valid', 'mail_messages_sender_player_id_players_id_fk', 'mail_messages_recipient_player_id_players_id_fk', 'mail_messages_specimen_id_plant_specimens_id_fk']
    const { rows: [constraints] } = await client.query("select count(*)::int as total from pg_constraint where conrelid='public.mail_messages'::regclass and convalidated and conname=any($1)", [constraintNames])
    if (constraints.total !== constraintNames.length) throw new RolloutError('Required mailbox constraints were not verified.')
    if (missing.length) {
      if (operations[0] === '--verify') throw new RolloutError('Missing narrow mailbox privileges: ' + missing.join('/'))
      // Privileges and role names come only from fixed allowlists; never old table grants.
      await client.query(`GRANT ${missing.join(', ')} ON public.mail_messages TO ${runtime}`)
      console.log(`Applied only missing mailbox ${missing.join('/')} privileges for ${runtime}.`)
      for (const privilege of missing) {
        const { rows: [row] } = await client.query("select has_table_privilege($1,'public.mail_messages',$2) as allowed", [runtime, privilege])
        if (!row.allowed) throw new RolloutError('Mailbox grant verification failed.')
      }
    } else console.log('Mailbox runtime grants already present; no grants reapplied.')
    console.log(`Verified mailbox migration 0007 and narrow mailbox grants on ${database}. Existing gameplay grant acceptance remains required.`)
  }
} catch (error) {
  await client?.query('rollback').catch(() => undefined)
  console.error(error instanceof RolloutError ? error.message : 'Mailbox rollout failed. No credentials or native query details were logged.')
  process.exitCode = 1
} finally { await client?.end().catch(() => undefined) }
