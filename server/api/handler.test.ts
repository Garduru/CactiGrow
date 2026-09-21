import assert from 'node:assert/strict'
import test from 'node:test'
import type { WorkerEnv } from '../env.ts'
import { DEVELOPMENT_IDENTITY_HEADER, DevelopmentIdentityProvider } from '../identity/DevelopmentIdentityProvider.ts'
import type { PlayerIdentityResolver } from '../identity/PlayerIdentityResolver.ts'
import { handleApiRequest } from './handler.ts'
import { createApiRouter } from './router.ts'
import type { ApiFailure, ApiSuccess } from './response.ts'

const env = {
  CACTIGROW_ENVIRONMENT: 'development',
  CACTIGROW_VERSION: 'test-build',
} as WorkerEnv

const testOptions = { createRequestId: () => 'request-test-1' }

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
  authenticationConfigurationFactory: (workerEnv) => {
    if (workerEnv.CACTIGROW_ENVIRONMENT === 'production') return null
    return {
      identityProvider: new DevelopmentIdentityProvider(workerEnv.CACTIGROW_ENVIRONMENT),
      createPlayerIdentityResolver: async () => testPlayerIdentityResolver,
    }
  },
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

function developmentIdentityRequest(subject?: string) {
  const headers = new Headers()
  if (subject) headers.set(DEVELOPMENT_IDENTITY_HEADER, subject)
  return new Request('http://localhost/api/me', { headers })
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
