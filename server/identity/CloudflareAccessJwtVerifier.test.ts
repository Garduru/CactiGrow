import assert from 'node:assert/strict'
import test from 'node:test'
import { CloudflareAccessIdentityProvider } from './CloudflareAccessIdentityProvider.ts'
import { CloudflareAccessJwtVerifier } from './CloudflareAccessJwtVerifier.ts'

const issuer = 'https://cactigrow-test.cloudflareaccess.com'
const audience = 'a'.repeat(64)
const encode = (value: unknown) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')

test('Access verification accepts only a signed token with the configured issuer and audience', async () => {
  const keyPair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])
  const publicKey = { ...await crypto.subtle.exportKey('jwk', keyPair.publicKey), kid: 'test-key', alg: 'RS256', use: 'sig' }
  const verifier = new CloudflareAccessJwtVerifier(issuer, audience, async () => Response.json({ keys: [publicKey] }))
  const provider = new CloudflareAccessIdentityProvider(verifier)
  const now = Math.floor(Date.now() / 1000)
  async function sign(claimOverrides: Record<string, unknown> = {}) {
    const content = `${encode({ alg: 'RS256', kid: 'test-key' })}.${encode({ type: 'app', iss: issuer, aud: [audience], sub: 'verified-tester', email: 'tester@example.invalid', iat: now - 10, exp: now + 300, ...claimOverrides })}`
    const signature = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keyPair.privateKey, new TextEncoder().encode(content)))
    return `${content}.${btoa(String.fromCharCode(...signature)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')}`
  }
  const validToken = await sign()
  const receiverSensitiveFetch = function (this: unknown) {
    assert.equal(this, globalThis)
    return Promise.resolve(Response.json({ keys: [publicKey] }))
  } as typeof fetch
  assert.equal((await new CloudflareAccessJwtVerifier(issuer, audience, receiverSensitiveFetch).verify(validToken))?.subject, 'verified-tester')
  const identity = await provider.verify({ getHeader: (name) => name === 'cf-access-jwt-assertion' ? validToken : null })
  assert.equal(identity?.provider, 'cloudflare-access')
  assert.equal(identity?.subject, 'verified-tester')
  const secondToken = await sign({ sub: 'verified-tester-b', email: 'tester-b@example.invalid' })
  const returningToken = await sign({ sub: 'verified-tester', email: 'tester@example.invalid', iat: now - 5 })
  const secondIdentity = await provider.verify({ getHeader: (name) => name === 'cf-access-jwt-assertion' ? secondToken : null })
  const returningIdentity = await provider.verify({ getHeader: (name) => name === 'cf-access-jwt-assertion' ? returningToken : null })
  assert.notEqual(secondIdentity?.subject, identity?.subject)
  assert.equal(returningIdentity?.subject, identity?.subject)
  assert.equal(await verifier.verify(await sign({ aud: ['wrong'] })), null)
  assert.equal(await verifier.verify(await sign({ iss: 'https://other.cloudflareaccess.com' })), null)
  assert.equal(await verifier.verify(await sign({ exp: now - 1 })), null)
  assert.equal(await verifier.verify(await sign({ nbf: now + 100 })), null)
  assert.equal(await verifier.verify(await sign({ type: 'org' })), null)
  assert.equal(await verifier.verify(await sign({ email: undefined })), null)
  assert.equal(await verifier.verify(`${validToken.slice(0, -2)}aa`), null)
  assert.equal(await provider.verify({ getHeader: (name) => name === 'cf-access-authenticated-user-email' ? 'spoof@example.invalid' : null }), null)
  assert.equal((await provider.verify({ getHeader: (name) => name === 'cf-access-jwt-assertion' ? validToken : name === 'cf-access-authenticated-user-email' ? 'spoof@example.invalid' : null }))?.subject, identity?.subject)
})

test('Access verifier rejects invalid configuration and unavailable signing keys', async () => {
  assert.throws(() => new CloudflareAccessJwtVerifier('http://example.com', audience), /Invalid Cloudflare Access team domain/)
  assert.throws(() => new CloudflareAccessJwtVerifier(issuer, 'wrong'), /Invalid Cloudflare Access audience/)
  const verifier = new CloudflareAccessJwtVerifier(issuer, audience, async () => new Response(null, { status: 503 }))
  assert.equal(await verifier.verify('invalid.token.value'), null)
})
