import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { Miniflare, Log, LogLevel } from 'miniflare'
import { exportJWK, generateKeyPair, SignJWT } from 'jose'

test('workerd verifies Ed25519 using cached remote JWKS and rejects forged credentials', async t => {
  const url = 'https://ep-test.neonauth.c-4.us-west-2.aws.neon.tech/cactigrow/auth'
  const { publicKey, privateKey } = await generateKeyPair('EdDSA')
  const jwks = { keys: [{ ...await exportJWK(publicKey), kid: 'test', alg: 'EdDSA' }] }
  const now = Math.floor(Date.now() / 1000)
  const token = await new SignJWT({ sub: 'external-user', role: 'authenticated' })
    .setProtectedHeader({ alg: 'EdDSA', kid: 'test' }).setIssuer(new URL(url).origin)
    .setAudience(new URL(url).origin).setIssuedAt(now).setExpirationTime(now + 900).sign(privateKey)
  const bundle = await build({ stdin: { resolveDir: process.cwd(), loader: 'ts', contents: `
    import { NeonIdentityProvider } from './server/identity/NeonIdentityProvider.ts';
    let calls = 0;
    globalThis.fetch = async input => {
      if (String(input) !== '${url}/.well-known/jwks.json') throw new Error('Unexpected URL');
      calls++; return Response.json(${JSON.stringify(jwks)});
    };
    export default { async fetch(request) {
      const provider = new NeonIdentityProvider('${url}');
      const identity = await provider.verify({ authorizationHeader: request.headers.get('Authorization'), getHeader: name => request.headers.get(name) });
      return Response.json({ identity, calls });
    } };
  ` }, bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2023', conditions: ['workerd', 'worker', 'browser'] })
  const mf = new Miniflare({ workers: [{ config: {
    name: 'neon-auth-test', type: 'worker', compatibilityDate: '2026-09-20', compatibilityFlags: ['nodejs_compat'],
    manifest: { mainModule: 'index.js', modules: { 'index.js': { type: 'esm', contents: bundle.outputFiles[0].text } } },
  } }], log: new Log(LogLevel.ERROR), port: 0, telemetry: { enabled: false } })
  t.after(() => mf.dispose())
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await mf.dispatchFetch('https://test/', { headers: { Authorization: `Bearer ${token}` } })
    const body = await response.json() as { identity: { subject: string }; calls: number }
    assert.equal(body.identity.subject, `${url}:external-user`)
    assert.equal(body.calls, 1)
  }
  const invalid = await mf.dispatchFetch('https://test/', { headers: { Authorization: 'Bearer forged.token.signature' } })
  assert.equal((await invalid.json() as { identity: unknown }).identity, null)
})
