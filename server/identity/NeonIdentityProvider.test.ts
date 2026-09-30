import assert from 'node:assert/strict'
import test from 'node:test'
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose'
import { NeonIdentityProvider } from './NeonIdentityProvider.ts'
import { authenticateRequest } from '../auth/authentication.ts'
import { PostgresPlayerIdentityResolver } from './PostgresPlayerIdentityResolver.ts'
import type { ApiRequestContext } from '../api/router.ts'
import type { WorkerEnv } from '../env.ts'

const url = 'https://ep-test.neonauth.c-4.us-west-2.aws.neon.tech/cactigrow/auth'
const origin = new URL(url).origin
const pair = await generateKeyPair('EdDSA')
const keys = createLocalJWKSet({ keys: [{ ...await exportJWK(pair.publicKey), kid: 'test' }] })
const provider = new NeonIdentityProvider(url, keys)
const now = Math.floor(Date.now() / 1000)
async function token(claims = {}) {
  return new SignJWT({ sub: 'external-user', role: 'authenticated', iat: now, exp: now + 900,
    iss: origin, aud: origin, email: 'private@example.invalid', playerId: 'spoofed', ...claims })
    .setProtectedHeader({ alg: 'EdDSA', kid: 'test' }).sign(pair.privateKey)
}
const request = (authorizationHeader?: string) => ({ authorizationHeader, getHeader: () => 'spoofed' })

test('Neon signature verification returns only scoped external identity and actual expiry', async () => {
  assert.deepEqual(await provider.verify(request(`Bearer ${await token()}`)), {
    provider: 'neon', subject: `${url}:external-user`,
    issuedAt: new Date(now * 1000).toISOString(), expiresAt: new Date((now + 900) * 1000).toISOString(),
  })
})

test('invalid signature, foreign issuer/audience, expired/future/oversized lifetime and anonymous/banned users fail closed', async () => {
  for (const claims of [{ iss: 'https://other.invalid' }, { aud: 'other' }, { exp: now - 1 },
    { iat: now + 60 }, { exp: now + 901 }, { exp: undefined }, { iat: undefined },
    { role: 'anonymous' }, { banned: true }, { sub: '' }, { sub: undefined }]) {
    assert.equal(await provider.verify(request(`Bearer ${await token(claims)}`)), null)
  }
  const foreign = await generateKeyPair('EdDSA')
  const forged = await new SignJWT({ sub: 'external-user', role: 'authenticated', iat: now, exp: now + 900, iss: origin, aud: origin })
    .setProtectedHeader({ alg: 'EdDSA', kid: 'test' }).sign(foreign.privateKey)
  assert.equal(await provider.verify(request(`Bearer ${forged}`)), null)
  const unavailable = new NeonIdentityProvider(url, async () => { throw new Error('JWKS unavailable') })
  assert.equal(await unavailable.verify(request(`Bearer ${await token()}`)), null)
})

test('malformed credentials and invalid configuration never authenticate', async () => {
  for (const header of [undefined, '', 'Basic abc', 'Bearer opaque-base44-token', 'Bearer a.b.c, Bearer a.b.c', `Bearer ${'x'.repeat(16384)}`]) {
    assert.equal(await provider.verify(request(header)), null)
  }
  for (const invalid of ['', 'http://example.com/auth', 'https://example.com/auth', `${url}?redirect=evil`, `${url}/`]) {
    assert.throws(() => new NeonIdentityProvider(invalid))
  }
})

test('concurrent Neon identities resolve through the existing repository to internal UUIDs', async () => {
  const ids = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002']
  const resolver = new PostgresPlayerIdentityResolver({ async resolveOrCreate(identity) {
    assert.equal(identity.provider, 'neon')
    return { playerId: ids[identity.subject.endsWith(':alice') ? 0 : 1] }
  } })
  const players = await Promise.all(['alice', 'bob'].map(async sub => {
    const context = { request: new Request('https://cactigrow.com/api/v1/me/bootstrap', { headers: { Authorization: `Bearer ${await token({ sub })}` } }),
      env: { CACTIGROW_ENVIRONMENT: 'test', CACTIGROW_VERSION: 'test' } as WorkerEnv,
      requestId: sub, database: { getDatabase: async () => { throw new Error('unexpected database') }, dispose: async () => {} },
    } as ApiRequestContext
    return authenticateRequest(context, () => ({ identityProvider: provider, createPlayerIdentityResolver: async () => resolver }))
  }))
  assert.deepEqual(players.map(p => p.playerId), ids)
  assert.equal(players[0].authorizationExpiresAt, new Date((now + 900) * 1000).toISOString())
})

test('production configuration cannot enable development identity shortcuts', async () => {
  for (const configured of [undefined, '', 'invalid', url]) {
    const context = { request: new Request('https://cactigrow.com/api/v1/me/bootstrap', { headers: { 'X-CactiGrow-Development-Identity': 'alice' } }),
      env: { CACTIGROW_ENVIRONMENT: 'production', CACTIGROW_VERSION: 'test', CACTIGROW_NEON_AUTH_URL: configured } as WorkerEnv,
      requestId: 'test', database: { getDatabase: async () => { throw new Error('unexpected database') }, dispose: async () => {} },
    } as ApiRequestContext
    await assert.rejects(authenticateRequest(context), { code: 'UNAUTHENTICATED' })
  }
})
