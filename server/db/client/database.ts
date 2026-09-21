import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Client } from 'pg'
import type { WorkerEnv } from '../../env.ts'
import * as schema from '../schema/index.ts'

export type CactiGrowDatabase = NodePgDatabase<typeof schema>

export async function connectRequestDatabase(env: WorkerEnv): Promise<CactiGrowDatabase> {
  const connectionString = env.HYPERDRIVE?.connectionString
  if (!connectionString) {
    throw new Error('The CactiGrow database binding is unavailable.')
  }

  const client = new Client({ connectionString })
  await client.connect()

  return drizzle(client, { schema })
}
