import assert from 'node:assert/strict'
import test from 'node:test'
import type { WorkerEnv } from '../env.ts'
import { DEVELOPMENT_IDENTITY_HEADER, DevelopmentIdentityProvider } from '../identity/DevelopmentIdentityProvider.ts'
import type { PlayerIdentityResolver } from '../identity/PlayerIdentityResolver.ts'
import { handleApiRequest } from './handler.ts'
import { createApiRouter } from './router.ts'
import type { ApiFailure, ApiSuccess } from './response.ts'
import { PlayerBootstrapService } from '../player/PlayerBootstrapService.ts'
import type {
  CactiGrowDatabase,
  RequestDatabaseContext,
} from '../db/client/database.ts'
import { PostgresRequestDatabaseContext } from '../db/client/database.ts'
import type { Client } from 'pg'

const env = {
  CACTIGROW_ENVIRONMENT: 'development',
  CACTIGROW_VERSION: 'test-build',
} as WorkerEnv

const testOptions = { createRequestId: () => 'request-test-1' }

class TrackingRequestDatabaseContext implements RequestDatabaseContext {
  readonly database: CactiGrowDatabase
  getCount = 0
  acquisitionCount = 0
  disposeCount = 0

  constructor(requestNumber: number) {
    this.database = { requestNumber } as unknown as CactiGrowDatabase
  }

  async getDatabase() {
    this.getCount += 1
    if (this.getCount === 1) this.acquisitionCount += 1
    return this.database
  }

  async dispose() {
    this.disposeCount += 1
  }
}

const testPlayerIdentityResolver: PlayerIdentityResolver = {
  async resolve(identity) {
    const playerId = identity.subject === 'account-a'
      ? '00000000-0000-4000-8000-00000000000a'
      : identity.subject === 'account-b'
        ? '00000000-0000-4000-8000-00000000000b'
        : undefined

    return playerId ? { playerId } : null
  },
}

const testAuthenticatedRouter = createApiRouter({
  authenticationConfigurationFactory: ({ env: workerEnv }) => {
    if (workerEnv.CACTIGROW_ENVIRONMENT === 'production') return null
    return {
      identityProvider: new DevelopmentIdentityProvider(workerEnv.CACTIGROW_ENVIRONMENT),
      createPlayerIdentityResolver: async () => testPlayerIdentityResolver,
    }
  },
  createPlayerBootstrapService: async () => new PlayerBootstrapService({
    async findByPlayerId(playerId) {
      return {
        playerId,
        createdAt: playerId.endsWith('a')
          ? new Date('2026-09-20T10:00:00.000Z')
          : new Date('2026-09-20T11:00:00.000Z'),
      }
    },
  }),
})

function authenticatedTestOptions(requestId: string) {
  return {
    createRequestId: () => requestId,
    router: testAuthenticatedRouter,
  }
}

const productionEnv = {
  CACTIGROW_ENVIRONMENT: 'production',
  CACTIGROW_VERSION: 'test-build',
} as WorkerEnv

function developmentIdentityRequest(subject?: string, path = '/api/me') {
  const headers = new Headers()
  if (subject) headers.set(DEVELOPMENT_IDENTITY_HEADER, subject)
  return new Request(`http://localhost${path}`, { headers })
}

async function getMe(subject: string, requestId: string) {
  const response = await handleApiRequest(
    developmentIdentityRequest(subject),
    env,
    undefined,
    authenticatedTestOptions(requestId),
  )
  const body = await response.json() as ApiSuccess<{
    playerId: string
    identityProvider: string
  }>
  return { response, body }
}

test('GET /api/health returns safe structured health data', async () => {
  const response = await handleApiRequest(
    new Request('http://localhost/api/health'),
    env,
    undefined,
    testOptions,
  )
  const body = await response.json() as ApiSuccess<{
    service: string
    environment: string
    version: string
  }>

  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type') ?? '', /^application\/json/)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(response.headers.get('x-request-id'), 'request-test-1')
  assert.deepEqual(body, {
    ok: true,
    data: {
      service: 'cactigrow-api',
      environment: 'development',
      version: 'test-build',
    },
    meta: { requestId: 'request-test-1' },
  })
})

test('unknown API routes return a structured 404', async () => {
  const response = await handleApiRequest(
    new Request('http://localhost/api/unknown'),
    env,
    undefined,
    testOptions,
  )
  const body = await response.json() as ApiFailure

  assert.equal(response.status, 404)
  assert.equal(body.ok, false)
  assert.equal(body.error.code, 'NOT_FOUND')
  assert.equal(body.meta.requestId, 'request-test-1')
})

test('unexpected exceptions return a generic structured 500', async () => {
  const response = await handleApiRequest(
    new Request('http://localhost/api/health'),
    env,
    undefined,
    {
      ...testOptions,
      router: () => { throw new Error('sensitive internal detail') },
      reportUnexpectedError: () => undefined,
    },
  )
  const text = await response.text()
  const body = JSON.parse(text) as ApiFailure

  assert.equal(response.status, 500)
  assert.equal(body.ok, false)
  assert.equal(body.error.code, 'INTERNAL_ERROR')
  assert.equal(body.error.message, 'An unexpected error occurred.')
  assert.equal(text.includes('sensitive internal detail'), false)
})

test('GET /api/me requires an explicit development identity', async () => {
  const response = await handleApiRequest(
    developmentIdentityRequest(),
    env,
    undefined,
    testOptions,
  )
  const body = await response.json() as ApiFailure

  assert.equal(response.status, 401)
  assert.equal(body.error.code, 'UNAUTHENTICATED')
})

test('unavailable database configuration fails without leaking details', async () => {
  const response = await handleApiRequest(
    developmentIdentityRequest('account-a'),
    env,
    undefined,
    { ...testOptions, reportUnexpectedError: () => undefined },
  )
  const text = await response.text()
  const body = JSON.parse(text) as ApiFailure

  assert.equal(response.status, 500)
  assert.equal(body.error.code, 'INTERNAL_ERROR')
  assert.equal(text.includes('database binding'), false)
  assert.equal(text.includes('HYPERDRIVE'), false)
})

test('development Account A is stable across isolated requests', async () => {
  const first = await getMe('account-a', 'request-account-a-1')
  const second = await getMe('account-a', 'request-account-a-2')

  assert.equal(first.response.status, 200)
  assert.equal(second.response.status, 200)
  assert.equal(first.body.data.playerId, second.body.data.playerId)
  assert.equal(first.body.data.identityProvider, 'development')
  assert.equal(first.body.meta.requestId, 'request-account-a-1')
  assert.equal(second.body.meta.requestId, 'request-account-a-2')
})

test('development Accounts A and B resolve to distinct internal players', async () => {
  const [accountA, accountB] = await Promise.all([
    getMe('account-a', 'request-account-a'),
    getMe('account-b', 'request-account-b'),
  ])

  assert.equal(accountA.response.status, 200)
  assert.equal(accountB.response.status, 200)
  assert.notEqual(accountA.body.data.playerId, accountB.body.data.playerId)
})

test('client-supplied internal player IDs are ignored', async () => {
  const headers = new Headers({
    [DEVELOPMENT_IDENTITY_HEADER]: 'account-a',
    'x-cactigrow-player-id': '00000000-0000-4000-8000-00000000000b',
  })
  const response = await handleApiRequest(
    new Request('http://localhost/api/me', { headers }),
    env,
    undefined,
    authenticatedTestOptions('request-test-1'),
  )
  const body = await response.json() as ApiSuccess<{ playerId: string }>

  assert.equal(response.status, 200)
  assert.equal(body.data.playerId, '00000000-0000-4000-8000-00000000000a')
})

test('invalid and ambiguous development credentials are rejected', async () => {
  for (const subject of ['unknown-account', 'account-a, account-b']) {
    const response = await handleApiRequest(
      developmentIdentityRequest(subject),
      env,
      undefined,
      testOptions,
    )
    const body = await response.json() as ApiFailure

    assert.equal(response.status, 401)
    assert.equal(body.error.code, 'UNAUTHENTICATED')
  }
})

test('production rejects all development identity credentials', async () => {
  for (const subject of [undefined, 'account-a', 'account-b']) {
    const response = await handleApiRequest(
      developmentIdentityRequest(subject),
      productionEnv,
      undefined,
      testOptions,
    )
    const body = await response.json() as ApiFailure

    assert.equal(response.status, 401)
    assert.equal(body.error.code, 'UNAUTHENTICATED')
  }
})

test('development identity provider cannot be constructed for production', () => {
  assert.throws(
    () => new DevelopmentIdentityProvider('production'),
    /cannot be enabled in production/,
  )
})

async function getBootstrap(subject: string | undefined, requestId: string) {
  const response = await handleApiRequest(
    developmentIdentityRequest(subject, '/api/v1/me/bootstrap'),
    env,
    undefined,
    authenticatedTestOptions(requestId),
  )
  const body = await response.json()
  return { response, body }
}

test('GET /api/v1/me/bootstrap requires authentication', async () => {
  for (const subject of [undefined, 'invalid-account']) {
    const { response, body } = await getBootstrap(subject, 'bootstrap-rejected')
    assert.equal(response.status, 401)
    assert.equal((body as ApiFailure).error.code, 'UNAUTHENTICATED')
  }
})

test('bootstrap returns the exact V1 durable player projection without identity or database details', async () => {
  const { response, body } = await getBootstrap('account-a', 'bootstrap-account-a')

  assert.equal(response.status, 200)
  assert.deepEqual(body, {
    ok: true,
    data: {
      projectionVersion: 1,
      player: {
        playerId: '00000000-0000-4000-8000-00000000000a',
        createdAt: '2026-09-20T10:00:00.000Z',
      },
    },
    meta: { requestId: 'bootstrap-account-a' },
  })

  const serialized = JSON.stringify(body)
  for (const forbidden of ['identityProvider', 'subject', 'database', 'table', 'HYPERDRIVE']) {
    assert.equal(serialized.includes(forbidden), false)
  }
})

test('independent clients resolve equivalent Account A projections while Account B stays isolated', async () => {
  const [desktopA, phoneA, accountB] = await Promise.all([
    getBootstrap('account-a', 'desktop-request'),
    getBootstrap('account-a', 'phone-request'),
    getBootstrap('account-b', 'account-b-request'),
  ])

  const desktop = desktopA.body as ApiSuccess<{ player: { playerId: string }; projectionVersion: 1 }>
  const phone = phoneA.body as ApiSuccess<{ player: { playerId: string }; projectionVersion: 1 }>
  const other = accountB.body as ApiSuccess<{ player: { playerId: string }; projectionVersion: 1 }>

  assert.deepEqual(desktop.data, phone.data)
  assert.notEqual(desktop.meta.requestId, phone.meta.requestId)
  assert.notEqual(desktop.data.player.playerId, other.data.player.playerId)
})

test('production rejects development credentials for the bootstrap endpoint', async () => {
  const response = await handleApiRequest(
    developmentIdentityRequest('account-a', '/api/v1/me/bootstrap'),
    productionEnv,
    undefined,
    authenticatedTestOptions('production-bootstrap'),
  )
  const body = await response.json() as ApiFailure

  assert.equal(response.status, 401)
  assert.equal(body.error.code, 'UNAUTHENTICATED')
})

test('authentication and bootstrap share one isolated request database context', async () => {
  const contexts: TrackingRequestDatabaseContext[] = []
  const authenticationDatabases: CactiGrowDatabase[] = []
  const bootstrapDatabases: CactiGrowDatabase[] = []
  const router = createApiRouter({
    authenticationConfigurationFactory: (context) => ({
      identityProvider: new DevelopmentIdentityProvider(context.env.CACTIGROW_ENVIRONMENT),
      createPlayerIdentityResolver: async () => {
        authenticationDatabases.push(await context.database.getDatabase())
        return testPlayerIdentityResolver
      },
    }),
    createPlayerBootstrapService: async (context) => {
      bootstrapDatabases.push(await context.database.getDatabase())
      return new PlayerBootstrapService({
        async findByPlayerId(playerId) {
          return { playerId, createdAt: new Date('2026-09-20T10:00:00.000Z') }
        },
      })
    },
  })
  const createContext = () => {
    const context = new TrackingRequestDatabaseContext(contexts.length + 1)
    contexts.push(context)
    return context
  }

  for (const requestId of ['shared-context-1', 'shared-context-2']) {
    const response = await handleApiRequest(
      developmentIdentityRequest('account-a', '/api/v1/me/bootstrap'),
      env,
      undefined,
      {
        router,
        createRequestId: () => requestId,
        createRequestDatabaseContext: createContext,
      },
    )
    assert.equal(response.status, 200)
  }

  assert.equal(contexts.length, 2)
  assert.notEqual(contexts[0]?.database, contexts[1]?.database)
  for (const context of contexts) {
    assert.equal(context.getCount, 2)
    assert.equal(context.acquisitionCount, 1)
    assert.equal(context.disposeCount, 1)
  }
  assert.equal(authenticationDatabases[0], bootstrapDatabases[0])
  assert.equal(authenticationDatabases[1], bootstrapDatabases[1])
  assert.notEqual(authenticationDatabases[0], authenticationDatabases[1])
})

test('request database cleanup runs after route exceptions', async () => {
  const database = new TrackingRequestDatabaseContext(1)
  const reported: unknown[] = []
  const response = await handleApiRequest(
    new Request('http://localhost/api/failure'),
    env,
    undefined,
    {
      router: async (context) => {
        await context.database.getDatabase()
        throw new Error('route failed')
      },
      createRequestDatabaseContext: () => database,
      reportUnexpectedError: (error) => reported.push(error),
    },
  )

  assert.equal(response.status, 500)
  assert.equal(database.acquisitionCount, 1)
  assert.equal(database.disposeCount, 1)
  assert.equal(reported.length, 1)
})

test('request database cleanup runs when authentication fails after acquisition', async () => {
  const database = new TrackingRequestDatabaseContext(1)
  const router = createApiRouter({
    authenticationConfigurationFactory: (context) => ({
      identityProvider: new DevelopmentIdentityProvider(context.env.CACTIGROW_ENVIRONMENT),
      createPlayerIdentityResolver: async () => {
        await context.database.getDatabase()
        return { async resolve() { return null } }
      },
    }),
  })
  const response = await handleApiRequest(
    developmentIdentityRequest('account-a'),
    env,
    undefined,
    { router, createRequestDatabaseContext: () => database },
  )

  assert.equal(response.status, 401)
  assert.equal(database.acquisitionCount, 1)
  assert.equal(database.disposeCount, 1)
})

test('PostgreSQL request context connects once, reuses Drizzle, and ends once', async () => {
  let connectCount = 0
  let endCount = 0
  const fakeClient = {
    async connect() { connectCount += 1 },
    async end() { endCount += 1 },
  } as unknown as Client
  const database = new PostgresRequestDatabaseContext(
    'test-connection-string',
    () => fakeClient,
  )

  const first = await database.getDatabase()
  const second = await database.getDatabase()
  await database.dispose()
  await database.dispose()

  assert.equal(first, second)
  assert.equal(connectCount, 1)
  assert.equal(endCount, 1)
  await assert.rejects(database.getDatabase(), /already been disposed/)
})
