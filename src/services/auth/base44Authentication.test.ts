import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdir, writeFile, unlink } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

test('browser credentials stay production-only and app-scoped; login uses SDK and ignores URL tokens', async t => {
  const directory = resolve('node_modules/.tmp')
  await mkdir(directory, { recursive: true })
  const appId = '1234567890abcdef12345678'
  const values = new Map<string, string>([['base44_access_token', 'unrelated-token']])
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    location: { search: '?access_token=attacker-token' },
    localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) },
  } })
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'window', previous); else Reflect.deleteProperty(globalThis, 'window') })
  for (const mode of ['development', 'staging', 'production']) {
    const file = resolve(directory, `base44-browser-${crypto.randomUUID()}.mjs`)
    t.after(() => unlink(file))
    const bundle = await build({ entryPoints: ['src/services/auth/base44Authentication.ts'], bundle: true, write: false,
      format: 'esm', platform: 'browser', define: { 'import.meta.env': JSON.stringify({ MODE: mode, VITE_CACTIGROW_BASE44_APP_ID: appId }) },
      plugins: [{ name: 'auth-sdk-fixture', setup(plugin) {
        plugin.onResolve({ filter: /^@base44\/sdk$/ }, () => ({ path: 'auth-sdk', namespace: 'fixture' }))
        plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `
          export function createClient(config) {
            if (config.appId !== '${appId}' || config.token !== 'unauthenticated' || config.analytics.enabled !== false) throw new Error('Unsafe SDK configuration');
            return { auth: { async loginViaEmailPassword(email, password) {
              if (email !== 'player@example.invalid' || password !== 'test-password') throw new Error('Unexpected login');
              return { access_token: 'server-issued-token' };
            } }, cleanup() {} };
          }
        ` }))
      } }],
    })
    await writeFile(file, bundle.outputFiles[0].contents)
    const adapter = await import(pathToFileURL(file).href)
    assert.equal(adapter.getPlayerCredentials(), undefined)
    if (mode !== 'production') {
      await assert.rejects(adapter.loginPlayer('player@example.invalid', 'test-password'))
    } else {
      await adapter.loginPlayer('player@example.invalid', 'test-password')
      assert.deepEqual(adapter.getPlayerCredentials(), { Authorization: 'Bearer server-issued-token' })
      values.set(`cactigrow.base44.${appId}.token`, 'token\r\ninjection')
      assert.equal(adapter.getPlayerCredentials(), undefined)
    }
  }
})
