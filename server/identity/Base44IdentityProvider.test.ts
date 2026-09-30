import assert from 'node:assert/strict'
import test from 'node:test'
import { Base44IdentityProvider } from './Base44IdentityProvider.ts'
import { authenticateRequest } from '../auth/authentication.ts'
import { PostgresPlayerIdentityResolver } from './PostgresPlayerIdentityResolver.ts'
import type { ApiRequestContext } from '../api/router.ts'
import type { WorkerEnv } from '../env.ts'

const appId = '1234567890abcdef12345678'
const user = { id: 'external-user', app_id: appId, disabled: false, is_service: false, is_verified: true }
const request = (authorizationHeader?: string) => ({ authorizationHeader, getHeader: () => 'spoofed-player-id' })

test('remote verification uses the configured app and request token; identity excludes private fields', async () => {
  let cleaned = 0
  const provider = new Base44IdentityProvider(appId, (id, token) => {
    assert.equal(id, appId)
    assert.equal(token, 'opaque-token')
    return { auth: { me: async () => ({ ...user, email: 'private@example.invalid', playerId: 'spoofed' }) }, cleanup: () => { cleaned++ } }
  })
  assert.deepEqual(await provider.verify(request('Bearer opaque-token')), { provider: 'base44', subject: `${appId}:external-user` })
  assert.equal(cleaned, 1)
})

test('missing, malformed and ambiguous credentials never reach Base44', async () => {
  let calls = 0
  const provider = new Base44IdentityProvider(appId, () => { calls++; throw new Error('must not be called') })
  for (const header of [undefined, '', 'Basic abc', 'Bearer abc, Bearer xyz', 'Bearer a b', `Bearer ${'x'.repeat(16384)}`]) {
    assert.equal(await provider.verify(request(header)), null)
  }
  assert.equal(calls, 0)
  assert.throws(() => new Base44IdentityProvider(''))
})

test('foreign apps, disabled/unverified/service users and invalid responses fail closed', async () => {
  for (const result of [null, {}, { ...user, app_id: 'another-app' }, { ...user, disabled: true },
    { ...user, is_verified: false }, { ...user, is_service: true }, { ...user, id: '' }]) {
    const provider = new Base44IdentityProvider(appId, () => ({ auth: { me: async () => result }, cleanup() {} }))
    assert.equal(await provider.verify(request('Bearer token')), null)
  }
  for (const status of [401, 403, 429, 500]) {
    const provider = new Base44IdentityProvider(appId, () => ({ auth: { me: async () => { throw { status } } }, cleanup() {} }))
    assert.equal(await provider.verify(request('Bearer token')), null)
  }
})

test('concurrent requests cannot share an SDK user or token', async () => {
  const provider = new Base44IdentityProvider(appId, (_id, token) => ({
    auth: { me: async () => { await Promise.resolve(); return { ...user, id: token } } }, cleanup() {},
  }))
  const identities = await Promise.all(['alice', 'bob'].map(token => provider.verify(request(`Bearer ${token}`))))
  assert.deepEqual(identities.map(identity => identity?.subject), [`${appId}:alice`, `${appId}:bob`])
})

test('verified identity goes through the existing resolver and preserves its internal UUID', async () => {
  const playerId = '00000000-0000-4000-8000-000000000001'
  const identityProvider = new Base44IdentityProvider(appId, () => ({ auth: { me: async () => user }, cleanup() {} }))
  const resolver = new PostgresPlayerIdentityResolver({ async resolveOrCreate(identity) {
    assert.deepEqual(identity, { provider: 'base44', subject: `${appId}:external-user` })
    return { playerId }
  } })
  const context = { request: new Request('https://cactigrow.com/api/v1/me/bootstrap', { headers: { Authorization: 'Bearer token' } }),
    env: { CACTIGROW_ENVIRONMENT: 'test', CACTIGROW_VERSION: 'test' } as WorkerEnv,
    requestId: 'test', database: { getDatabase: async () => { throw new Error('no onboarding') }, dispose: async () => {} },
  } as ApiRequestContext
  const player = await authenticateRequest(context, () => ({ identityProvider, createPlayerIdentityResolver: async () => resolver }))
  assert.equal(player.playerId, playerId)
  assert.notEqual(player.playerId, user.id)
})

test('production rejects development credentials and missing or invalid Base44 config before database access', async () => {
  for (const configured of [undefined, '', 'invalid', appId]) {
    const context = { request: new Request('https://cactigrow.com/api/v1/me/bootstrap', { headers: { 'X-CactiGrow-Development-Identity': 'account-a' } }),
      env: { CACTIGROW_ENVIRONMENT: 'production', CACTIGROW_VERSION: 'test', CACTIGROW_BASE44_APP_ID: configured } as WorkerEnv,
      requestId: 'test', database: { getDatabase: async () => { throw new Error('must not access database') }, dispose: async () => {} },
    } as ApiRequestContext
    await assert.rejects(authenticateRequest(context), { code: 'UNAUTHENTICATED' })
  }
})
