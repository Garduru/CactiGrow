import { Client } from 'pg'

const aliases = new Set(['account-a', 'account-b'])
const [alias] = process.argv.slice(2)
const databaseUrl = process.env.DATABASE_URL

if (process.env.CACTIGROW_ENABLE_DEVELOPMENT_PROVISIONING !== '1') throw new Error('Development provisioning requires explicit enablement.')
if (process.env.CACTIGROW_ENVIRONMENT !== 'development') throw new Error('Development provisioning is forbidden outside the development environment.')
if (!alias || !aliases.has(alias)) throw new Error('Use one approved development account alias: account-a or account-b.')
if (!databaseUrl) throw new Error('DATABASE_URL is required for development provisioning.')
const target = new URL(databaseUrl)
if (target.pathname.replace(/^\//, '') !== 'cactigrow') throw new Error('Development provisioning is restricted to the cactigrow database.')
if (target.hostname.includes('-pooler.')) throw new Error('Development provisioning requires a direct/unpooled database connection.')

const client = new Client({ connectionString: databaseUrl })
try {
  await client.connect()
  await client.query('begin')
  const player = await client.query<{ player_id: string }>('select player_id from player_external_identities where provider = $1 and subject = $2', ['development', alias])
  if (player.rowCount !== 1) throw new Error('The approved development account has no durable player identity.')
  await client.query(`insert into player_seed_stacks (player_id, species_id, quantity, version)
    values ($1, 'echinopsis-pachanoi', 4, 1), ($1, 'lophophora-williamsii', 2, 1)
    on conflict (player_id, species_id) do nothing`, [player.rows[0].player_id])
  await client.query(`insert into player_plant_lifecycle_versions (player_id, version)
    values ($1, 0) on conflict (player_id) do nothing`, [player.rows[0].player_id])
  await client.query('commit')
  process.stdout.write(`Development seed fixture checked for ${alias}. Existing stacks were not modified.\n`)
} catch (error) {
  await client.query('rollback').catch(() => undefined)
  throw error
} finally {
  await client.end()
}
