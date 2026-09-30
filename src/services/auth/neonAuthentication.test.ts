import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdir, writeFile, unlink } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { CactiGrowApiClient } from '../api/CactiGrowApiClient.ts'

test('Neon browser credentials use cookie sessions only in production, and reject invalid API tokens', async t => {
  const originalFetch = globalThis.fetch
  let token: string | null = null
  let failure = false
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), 'https://ep-test.neonauth.c-4.us-west-2.aws.neon.tech/cactigrow/auth/token')
    assert.equal(init?.credentials, 'include')
    assert.equal(init?.cache, 'no-store')
    if (failure) return new Response('{}', { status: 503 })
    return token === null ? new Response('{}', { status: 401 }) : Response.json({ token })
  }
  t.after(() => { globalThis.fetch = originalFetch })
  const directory = resolve('node_modules/.tmp')
  await mkdir(directory, { recursive: true })
  for (const mode of ['development', 'staging', 'production']) {
    const file = resolve(directory, `neon-browser-${crypto.randomUUID()}.mjs`)
    t.after(() => unlink(file))
    const bundle = await build({ entryPoints: ['src/services/auth/neonAuthentication.ts'], bundle: true, write: false,
      format: 'esm', platform: 'browser', define: { 'import.meta.env': JSON.stringify({ MODE: mode,
        VITE_NEON_AUTH_URL: 'https://ep-test.neonauth.c-4.us-west-2.aws.neon.tech/cactigrow/auth' }) },
      plugins: [{ name: 'auth-sdk-fixture', setup(plugin) {
        plugin.onResolve({ filter: /^@neondatabase\/auth/ }, args => ({ path: args.path, namespace: 'fixture' }))
        plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path.endsWith('/adapters')
          ? `export function BetterAuthReactAdapter(options) { if(options.fetchOptions.credentials !== 'include') throw Error('Cookies required'); return options; }`
          : `export function createAuthClient() { let token = null; let error = null; return { setToken(value) { token = value }, setError(value) { error = value }, async getSession() { return { data: token ? { session: { token } } : null, error } } }; }`,
        }))
      } }],
    })
    await writeFile(file, bundle.outputFiles[0].contents)
    const adapter = await import(pathToFileURL(file).href)
    assert.equal(await adapter.getPlayerCredentials(), undefined)
    if (mode !== 'production') assert.equal(adapter.neonAuth, null)
    else {
      token = 'header.payload.signature'
      assert.deepEqual(await adapter.getPlayerCredentials(), { Authorization: 'Bearer header.payload.signature' })
      token = 'opaque-session-secret'
      await assert.rejects(adapter.getPlayerCredentials())
      failure = true
      await assert.rejects(adapter.getPlayerCredentials())
    }
  }
})

test('API waits for fresh asynchronous credentials and never sends a request if session resolution fails', async () => {
  let calls = 0
  const client = new CactiGrowApiClient({ getCredentials: async () => {
    await Promise.resolve(); return { Authorization: 'Bearer signed-token' }
  }, fetch: async (_url, init) => {
    calls++; assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer signed-token')
    return new Response('{}', { status: 401 })
  } })
  await assert.rejects(client.getPlayerBootstrap())
  assert.equal(calls, 1)
  const failed = new CactiGrowApiClient({ getCredentials: async () => { throw new Error('Session unavailable') },
    fetch: async () => { calls++; throw new Error('must not send') } })
  await assert.rejects(failed.getPlayerBootstrap(), /Session unavailable/)
  assert.equal(calls, 1)
})
