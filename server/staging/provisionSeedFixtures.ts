import { Client } from 'pg'

if (process.env.CACTIGROW_ENABLE_STAGING_PROVISIONING !== '1' || process.env.CACTIGROW_ENVIRONMENT !== 'staging') {
  throw new Error('Staging seed provisioning requires explicit staging-only enablement.')
}
const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is required for staging provisioning.')
const target = new URL(connectionString)
if (!['postgres:', 'postgresql:'].includes(target.protocol)
  || target.pathname.slice(1) !== 'cactigrow_staging'
  || decodeURIComponent(target.username) !== 'cactigrow_staging_owner'
  || !target.hostname.endsWith('.neon.tech')
  || target.hostname.includes('-pooler.')
  || !['require', 'verify-full'].includes(target.searchParams.get('sslmode') ?? '')) {
  throw new Error('Staging provisioning requires the isolated staging database, owner role, direct Neon endpoint, and TLS.')
}

const client = new Client({ connectionString })
try {
  await client.connect()
  const identity = await client.query<{ database_name: string; database_user: string }>('select current_database() as database_name, current_user as database_user')
  if (identity.rows[0]?.database_name !== 'cactigrow_staging' || identity.rows[0]?.database_user !== 'cactigrow_staging_owner') {
    throw new Error('Connected database identity does not match isolated staging.')
  }
  await client.query('begin')
  const players = await client.query<{ player_id: string }>("select player_id from player_external_identities where provider = 'cloudflare-access'")
  if (players.rowCount !== 1) throw new Error('Staging provisioning requires exactly one authenticated Access player.')
  const playerId = players.rows[0].player_id
  await client.query(`insert into player_seed_stacks (player_id, species_id, quantity, version)
    values ($1, 'echinopsis-pachanoi', 4, 1), ($1, 'lophophora-williamsii', 2, 1)
    on conflict (player_id, species_id) do nothing`, [playerId])
  await client.query(`insert into player_plant_lifecycle_versions (player_id, version)
    values ($1, 0) on conflict (player_id) do nothing`, [playerId])
  await client.query('commit')
  process.stdout.write('Staging seed fixture checked. Existing stacks and player state were not modified.\n')
} catch (error) {
  await client.query('rollback').catch(() => undefined)
  throw error
} finally {
  await client.end()
}
