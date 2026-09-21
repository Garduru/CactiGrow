import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { and, count, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Client } from 'pg'
import type { AuthenticationConfigurationFactory } from '../auth/authentication.ts'
import type { WorkerEnv } from '../env.ts'
import { DevelopmentIdentityProvider, DEVELOPMENT_IDENTITY_HEADER } from '../identity/DevelopmentIdentityProvider.ts'
import { PostgresPlayerIdentityResolver } from '../identity/PostgresPlayerIdentityResolver.ts'
import { handleApiRequest } from '../api/handler.ts'
import { createApiRouter } from '../api/router.ts'
import type { ApiFailure, ApiSuccess } from '../api/response.ts'
import { PostgresPlayerIdentityRepository } from './repositories/PostgresPlayerIdentityRepository.ts'
import { playerExternalIdentities, players } from './schema/index.ts'

const testDatabaseUrl = process.env.TEST_DATABASE_URL
const databaseTestsEnabled = process.env.CACTIGROW_DATABASE_TESTS === '1'
const migrationsFolder = fileURLToPath(new URL('./migrations', import.meta.url))

function databaseErrorCode(error: unknown): string | undefined {
  let current = error
  for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth += 1) {
    const metadata = current as { code?: unknown; cause?: unknown }
    if (typeof metadata.code === 'string') return metadata.code
    current = metadata.cause
  }
  return undefined
}

function developmentMeRequest(subject?: string) {
  const headers = new Headers()
  if (subject) headers.set(DEVELOPMENT_IDENTITY_HEADER, subject)
  return new Request('http://localhost/api/me', { headers })
}

test('PostgreSQL identity integration', {
  skip: !databaseTestsEnabled || !testDatabaseUrl
    ? 'Set CACTIGROW_DATABASE_TESTS=1 and TEST_DATABASE_URL for an isolated test database.'
    : false,
}, async () => {
  assert.ok(testDatabaseUrl)

  const databaseName = decodeURIComponent(new URL(testDatabaseUrl).pathname.slice(1)).toLowerCase()
  assert.match(databaseName, /test/, 'TEST_DATABASE_URL must name a database containing "test".')

  const primaryClient = new Client({ connectionString: testDatabaseUrl })
  const concurrentClients: Client[] = []
  let ownsIdentitySchema = false

  await primaryClient.connect()

  try {
    const existing = await primaryClient.query<{ players: string | null; identities: string | null }>(
      `select to_regclass('public.players')::text as players,
              to_regclass('public.player_external_identities')::text as identities`,
    )
    assert.deepEqual(existing.rows[0], { players: null, identities: null })
    ownsIdentitySchema = true

    const database = drizzle(primaryClient, { schema: { players, playerExternalIdentities } })
    await migrate(database, { migrationsFolder })

    const migrated = await primaryClient.query<{ players: string | null; identities: string | null }>(
      `select to_regclass('public.players')::text as players,
              to_regclass('public.player_external_identities')::text as identities`,
    )
    assert.deepEqual(migrated.rows[0], {
      players: 'players',
      identities: 'player_external_identities',
    })

    const repository = new PostgresPlayerIdentityRepository(database)
    const resolver = new PostgresPlayerIdentityResolver(repository)
    const accountA = { provider: 'development', subject: 'account-a' }
    const accountB = { provider: 'development', subject: 'account-b' }

    const firstA = await resolver.resolve(accountA)
    const repeatedA = await resolver.resolve(accountA)
    const firstB = await resolver.resolve(accountB)

    assert.equal(firstA.playerId, repeatedA.playerId)
    assert.notEqual(firstA.playerId, firstB.playerId)

    const concurrentIdentity = { provider: 'development', subject: 'concurrent-first-login' }
    const concurrentResolvers = await Promise.all(Array.from({ length: 4 }, async () => {
      const client = new Client({ connectionString: testDatabaseUrl })
      concurrentClients.push(client)
      await client.connect()
      return new PostgresPlayerIdentityResolver(
        new PostgresPlayerIdentityRepository(
          drizzle(client, { schema: { players, playerExternalIdentities } }),
        ),
      )
    }))
    const concurrentResults = await Promise.all(
      concurrentResolvers.map((concurrentResolver) => concurrentResolver.resolve(concurrentIdentity)),
    )
    assert.equal(new Set(concurrentResults.map(({ playerId }) => playerId)).size, 1)

    const [concurrentMappingCount] = await database
      .select({ value: count() })
      .from(playerExternalIdentities)
      .where(and(
        eq(playerExternalIdentities.provider, concurrentIdentity.provider),
        eq(playerExternalIdentities.subject, concurrentIdentity.subject),
      ))
    assert.equal(concurrentMappingCount?.value, 1)

    await assert.rejects(
      database.insert(playerExternalIdentities).values({
        playerId: firstB.playerId,
        provider: accountA.provider,
        subject: accountA.subject,
      }),
      (error) => databaseErrorCode(error) === '23505',
    )

    await assert.rejects(
      database.insert(playerExternalIdentities).values({
        playerId: crypto.randomUUID(),
        provider: 'development',
        subject: 'orphaned-identity',
      }),
      (error) => databaseErrorCode(error) === '23503',
    )

    const authenticationConfigurationFactory: AuthenticationConfigurationFactory = (workerEnv) => ({
      identityProvider: new DevelopmentIdentityProvider(workerEnv.CACTIGROW_ENVIRONMENT),
      createPlayerIdentityResolver: async () => resolver,
    })
    const router = createApiRouter({ authenticationConfigurationFactory })
    const workerEnv = {
      CACTIGROW_ENVIRONMENT: 'test',
      CACTIGROW_VERSION: 'database-integration-test',
    } as WorkerEnv

    const firstMeResponse = await handleApiRequest(
      developmentMeRequest('account-a'),
      workerEnv,
      undefined,
      { router, createRequestId: () => 'database-test-request-1' },
    )
    const firstMe = await firstMeResponse.json() as ApiSuccess<{ playerId: string }>
    const repeatedMeResponse = await handleApiRequest(
      developmentMeRequest('account-a'),
      workerEnv,
      undefined,
      { router, createRequestId: () => 'database-test-request-2' },
    )
    const repeatedMe = await repeatedMeResponse.json() as ApiSuccess<{ playerId: string }>

    assert.equal(firstMeResponse.status, 200)
    assert.equal(repeatedMeResponse.status, 200)
    assert.equal(firstMe.data.playerId, firstA.playerId)
    assert.equal(repeatedMe.data.playerId, firstA.playerId)

    for (const subject of [undefined, 'invalid-account']) {
      const response = await handleApiRequest(
        developmentMeRequest(subject),
        workerEnv,
        undefined,
        { router, createRequestId: () => 'database-test-rejected-request' },
      )
      const body = await response.json() as ApiFailure
      assert.equal(response.status, 401)
      assert.equal(body.error.code, 'UNAUTHENTICATED')
    }
  } finally {
    await Promise.allSettled(concurrentClients.map((client) => client.end()))
    if (ownsIdentitySchema) {
      await primaryClient.query('drop table if exists player_external_identities cascade')
      await primaryClient.query('drop table if exists players cascade')
      await primaryClient.query('drop schema if exists drizzle cascade')
    }
    await primaryClient.end()
  }
})
