import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { Miniflare, Log, LogLevel } from 'miniflare'
import { CactiGrowApiClient } from '../api/CactiGrowApiClient.ts'
import { AreaConnection, type RealtimeSocket } from './AreaConnection.ts'
import { TOWN_AREA } from '../../../shared/realtime/areas.ts'

test('Two actual clients use L3 admission, share a Layer, exchange movement, remove departures and reconnect', { timeout: 30_000 }, async (t) => {
  // Isolated test resolver; the real Worker router, existing development provider and DO are bundled.
  const entry = `
    import { handleApiRequest } from './server/api/handler.ts'
    import { createApiRouter } from './server/api/router.ts'
    import { DevelopmentIdentityProvider } from './server/identity/DevelopmentIdentityProvider.ts'
    export { AreaPresence } from './server/realtime/AreaPresence.ts'
    const router = createApiRouter({ authenticationConfigurationFactory: () => ({
      identityProvider: new DevelopmentIdentityProvider('test'),
      createPlayerIdentityResolver: async () => ({ resolve: async identity => ({ playerId: '00000000-0000-4000-8000-' + (identity.subject === 'account-a' ? '000000000001' : '000000000002') }) })
    }), resolveRealtimePlayerSocial: async (_context, playerId) => ({
      publicId: playerId, displayName: playerId.endsWith('1') ? 'Saguaro One' : 'Saguaro Two', blockedPublicIds: [],
    }) })
    export default { fetch(request, env) { return handleApiRequest(request, { ...env, CACTIGROW_ENVIRONMENT: 'test', CACTIGROW_VERSION: 'test',
      CACTIGROW_REALTIME_ENABLED: 'true', CACTIGROW_REALTIME_ORIGIN: 'https://test' }, undefined, { router,
      createRequestDatabaseContext: () => ({ getDatabase() { throw new Error('Unexpected database access') }, async dispose() {} }) }) } }
  `
  const bundled = await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, format: 'esm', platform: 'node',
    target: 'es2023', external: ['cloudflare:workers'], banner: { js: "import { createRequire } from 'node:module'; const require = createRequire('/index.js');" } })
  const mf = new Miniflare({ workers: [{ config: { name: 'town-client-test', type: 'worker', compatibilityDate: '2026-09-20', compatibilityFlags: ['nodejs_compat'],
    manifest: { mainModule: 'index.js', modules: { 'index.js': { type: 'esm', contents: bundled.outputFiles[0].text } } },
    env: { AREA_PRESENCE: { type: 'durable-object', worker: 'town-client-test', exportName: 'AreaPresence' } },
    exports: { AreaPresence: { type: 'durable-object', storage: 'sqlite', unsafePreventEviction: false } },
  } }], log: new Log(LogLevel.ERROR), port: 0, telemetry: { enabled: false } })
  t.after(() => mf.dispose())
  const transports = new Map<string, LocalSocket>()
  type Pair = NonNullable<Awaited<ReturnType<typeof mf.dispatchFetch>>['webSocket']>
  class LocalSocket extends EventTarget {
    readyState = 0
    bufferedAmount = 0
    pair?: Pair
    constructor(url: string, protocols: string[]) {
      super()
      void mf.dispatchFetch(url.replace('wss:', 'https:'), { headers: { Origin: 'https://test', Upgrade: 'websocket', 'Sec-WebSocket-Protocol': protocols.join(', ') } }).then((response) => {
        if (response.status !== 101 || !response.webSocket) { this.close(); return }
        const pair = response.webSocket; this.pair = pair
        if (this.readyState === 3) { pair.accept(); pair.close(); return }
        pair.addEventListener('message', (event) => this.dispatchEvent(new MessageEvent('message', { data: event.data })))
        pair.addEventListener('close', () => { this.readyState = 3; this.dispatchEvent(new Event('close')) })
        this.readyState = 1; pair.accept()
      }).catch(() => this.close())
    }
    send(raw: string) { this.pair!.send(raw) }
    close() { this.readyState = 3; this.pair?.close(); this.dispatchEvent(new Event('close')) }
  }
  const client = (identity: string) => {
    const api = new CactiGrowApiClient({ getCredentials: () => ({ 'x-cactigrow-development-identity': identity }), fetch: async (url, init) => {
      const headers = new Headers(init?.headers); headers.set('Origin', 'https://test')
      const response = await mf.dispatchFetch(new URL(String(url), 'https://test').href, { method: init?.method, body: init?.body as string,
        headers: Object.fromEntries(headers.entries()), signal: init?.signal })
      return new Response(await response.text(), { status: response.status, headers: Object.fromEntries(response.headers.entries()) })
    } })
    return new AreaConnection({ areaId: TOWN_AREA.areaId, entryPointId: 'farm-arrival', origin: 'https://test',
      admit: (input, signal) => api.requestRealtimeAdmission(input, signal), socket: (url, protocols) => {
        const socket = new LocalSocket(url, protocols); transports.set(identity, socket); return socket as unknown as RealtimeSocket
      } })
  }
  const a = client('account-a'), b = client('account-b')
  t.after(() => { a.stop(); b.stop() })
  const until = async (predicate: () => boolean) => {
    const deadline = Date.now() + 10_000
    while (!predicate()) { assert.ok(Date.now() < deadline, 'Timed out waiting for two-client state'); await new Promise((resolve) => setTimeout(resolve, 20)) }
  }
  a.start(); b.start()
  await until(() => a.getSnapshot().remotes.length === 1 && b.getSnapshot().remotes.length === 1)
  assert.equal(a.getSnapshot().layerId, b.getSnapshot().layerId)
  a.sampleMovement({ x: 1200, y: 1280 }, 'east', true)
  b.sampleMovement({ x: 1100, y: 1180 }, 'north', true)
  await until(() => b.getSnapshot().remotes[0]?.position.x === 1200 && a.getSnapshot().remotes[0]?.position.y === 1180)
  const oldGeneration = b.getSnapshot().remotes[0].generation
  transports.get('account-a')!.close()
  await until(() => a.getSnapshot().status === 'connected' && b.getSnapshot().remotes[0]?.generation > oldGeneration)
  assert.equal(a.getSnapshot().remotes.length, 1)
  a.stop(); await until(() => b.getSnapshot().remotes.length === 0)
  b.stop()
})
