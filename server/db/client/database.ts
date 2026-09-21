import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Client } from 'pg'
import type { WorkerEnv } from '../../env.ts'
import * as schema from '../schema/index.ts'

export type CactiGrowDatabase = NodePgDatabase<typeof schema>

export interface RequestDatabaseContext {
  getDatabase(): Promise<CactiGrowDatabase>
  dispose(): Promise<void>
}

export type RequestDatabaseContextFactory = (env: WorkerEnv) => RequestDatabaseContext
export type PgClientFactory = (connectionString: string) => Client

export class PostgresRequestDatabaseContext implements RequestDatabaseContext {
  private readonly connectionString: string | undefined
  private readonly createClient: PgClientFactory
  private client: Client | null = null
  private databasePromise: Promise<CactiGrowDatabase> | null = null
  private disposed = false

  constructor(
    connectionString: string | undefined,
    createClient: PgClientFactory = (value) => new Client({ connectionString: value }),
  ) {
    this.connectionString = connectionString
    this.createClient = createClient
  }

  getDatabase(): Promise<CactiGrowDatabase> {
    if (this.disposed) {
      return Promise.reject(new Error('The request database context has already been disposed.'))
    }

    if (!this.connectionString) {
      return Promise.reject(new Error('The CactiGrow database binding is unavailable.'))
    }

    if (!this.databasePromise) {
      const client = this.createClient(this.connectionString)
      this.client = client
      this.databasePromise = client.connect().then(() => drizzle(client, { schema }))
    }

    return this.databasePromise
  }

  async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true

    const client = this.client
    const databasePromise = this.databasePromise
    this.client = null
    this.databasePromise = null

    if (!client) return

    if (databasePromise) {
      await databasePromise.catch(() => undefined)
    }

    await client.end()
  }
}

export const createRequestDatabaseContext: RequestDatabaseContextFactory = (env) => (
  new PostgresRequestDatabaseContext(env.HYPERDRIVE?.connectionString)
)
