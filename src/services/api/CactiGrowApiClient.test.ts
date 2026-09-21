import assert from 'node:assert/strict'
import test from 'node:test'
import { CactiGrowApiClient, CactiGrowApiError } from './CactiGrowApiClient.ts'
import { createDevelopmentCredentials } from './developmentCredentials.ts'
import { loadPlayerBootstrapState } from '../../app/loadPlayerBootstrapState.ts'

const projection = {
  projectionVersion: 1,
  player: {
    playerId: '00000000-0000-4000-8000-00000000000a',
    createdAt: '2026-09-20T10:00:00.000Z',
  },
} as const

function response(body: unknown, status = 200) {
  return Response.json(body, { status })
}

test('valid bootstrap response maps to an authenticated projection result', async () => {
  const client = new CactiGrowApiClient({
    fetch: async () => response({ ok: true, data: projection, meta: { requestId: 'valid-request' } }),
  })

  assert.deepEqual(await client.getPlayerBootstrap(), {
    bootstrap: projection,
    requestId: 'valid-request',
  })
})

test('malformed or expanded bootstrap data is rejected at runtime', async () => {
  for (const data of [
    { projectionVersion: 2, player: projection.player },
    { ...projection, identityProvider: 'development' },
    { ...projection, player: { ...projection.player, subject: 'account-a' } },
    { ...projection, player: { ...projection.player, createdAt: 'not-a-date' } },
  ]) {
    const client = new CactiGrowApiClient({
      fetch: async () => response({ ok: true, data, meta: { requestId: 'invalid-request' } }),
    })

    await assert.rejects(
      client.getPlayerBootstrap(),
      (error) => error instanceof CactiGrowApiError
        && error.kind === 'invalid-response'
        && error.requestId === 'invalid-request',
    )
  }
})

test('401 maps to unauthenticated and propagates the request ID', async () => {
  const client = new CactiGrowApiClient({
    fetch: async () => response({
      ok: false,
      error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' },
      meta: { requestId: 'unauthenticated-request' },
    }, 401),
  })

  await assert.rejects(
    client.getPlayerBootstrap(),
    (error) => error instanceof CactiGrowApiError
      && error.kind === 'unauthenticated'
      && error.requestId === 'unauthenticated-request',
  )
})

test('network and server failures remain distinct typed errors', async () => {
  const networkClient = new CactiGrowApiClient({
    fetch: async () => { throw new Error('connection failed') },
  })
  await assert.rejects(
    networkClient.getPlayerBootstrap(),
    (error) => error instanceof CactiGrowApiError && error.kind === 'network',
  )

  const serverClient = new CactiGrowApiClient({
    fetch: async () => response({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
      meta: { requestId: 'server-request' },
    }, 500),
  })
  await assert.rejects(
    serverClient.getPlayerBootstrap(),
    (error) => error instanceof CactiGrowApiError
      && error.kind === 'server'
      && error.requestId === 'server-request',
  )
})

test('bootstrap loader maps valid, unauthenticated, and failed requests to distinct states', async () => {
  const valid = new CactiGrowApiClient({
    fetch: async () => response({ ok: true, data: projection, meta: { requestId: 'state-valid' } }),
  })
  const unauthenticated = new CactiGrowApiClient({
    fetch: async () => response({
      ok: false,
      error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' },
      meta: { requestId: 'state-unauthenticated' },
    }, 401),
  })
  const failed = new CactiGrowApiClient({ fetch: async () => { throw new Error('offline') } })

  assert.deepEqual(await loadPlayerBootstrapState(valid), {
    status: 'authenticated',
    bootstrap: projection,
    requestId: 'state-valid',
  })
  assert.deepEqual(await loadPlayerBootstrapState(unauthenticated), {
    status: 'unauthenticated',
    requestId: 'state-unauthenticated',
  })
  assert.deepEqual(await loadPlayerBootstrapState(failed), {
    status: 'error',
    message: 'Unable to reach the CactiGrow service.',
    requestId: undefined,
  })
})

test('development credentials require an explicit supported account and are disabled in production', () => {
  assert.deepEqual(
    createDevelopmentCredentials(true, '?developmentIdentity=account-a'),
    { 'x-cactigrow-development-identity': 'account-a' },
  )
  assert.equal(createDevelopmentCredentials(true, ''), undefined)
  assert.equal(
    createDevelopmentCredentials(true, '?developmentIdentity=unknown-account'),
    undefined,
  )
  assert.equal(
    createDevelopmentCredentials(false, '?developmentIdentity=account-a'),
    undefined,
  )
})
