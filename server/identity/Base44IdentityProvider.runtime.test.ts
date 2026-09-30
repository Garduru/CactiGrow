import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { Miniflare, Log, LogLevel } from 'miniflare'

test('actual Base44 SDK verifies through auth.me in local workerd without privileged credentials', async t => {
  const appId = '1234567890abcdef12345678'
  const bundle = await build({ stdin: { resolveDir: process.cwd(), loader: 'ts', contents: `
    globalThis.fetch = async (input, init) => {
      const request = new Request(input, init);
      if (request.url !== 'https://base44.app/api/apps/${appId}/entities/User/me'
        || request.method !== 'GET' || request.headers.get('X-App-Id') !== '${appId}') throw new Error('Unexpected SDK request');
      if (request.headers.get('Authorization') !== 'Bearer valid-token') return new Response('{}', { status: 401 });
      return Response.json({ id: 'verified-user', app_id: '${appId}', disabled: false, is_service: false, is_verified: true });
    };
    export default { async fetch(request) {
      const { Base44IdentityProvider } = await import('./server/identity/Base44IdentityProvider.ts');
      const provider = new Base44IdentityProvider('${appId}');
      const identity = await provider.verify({ authorizationHeader: request.headers.get('Authorization'), getHeader: name => request.headers.get(name) });
      return Response.json(identity);
    } };
  ` }, bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2023', conditions: ['workerd', 'worker', 'browser'],
    define: { 'process.env.NODE_ENV': '"production"' } })
  const mf = new Miniflare({ workers: [{ config: {
    name: 'base44-auth-test', type: 'worker', compatibilityDate: '2026-09-20', compatibilityFlags: ['nodejs_compat'],
    manifest: { mainModule: 'index.js', modules: { 'index.js': { type: 'esm', contents: bundle.outputFiles[0].text } } },
  } }], log: new Log(LogLevel.ERROR), port: 0, telemetry: { enabled: false } })
  t.after(() => mf.dispose())
  const valid = await mf.dispatchFetch('https://test/', { headers: { Authorization: 'Bearer valid-token' } })
  assert.deepEqual(await valid.json(), { provider: 'base44', subject: `${appId}:verified-user` })
  const invalid = await mf.dispatchFetch('https://test/', { headers: { Authorization: 'Bearer expired-token' } })
  assert.equal(await invalid.json(), null)
})
