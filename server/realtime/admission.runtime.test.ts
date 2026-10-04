import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { Miniflare, Log, LogLevel } from 'miniflare'
import { isRealtimeCredentialsResponseV1, realtimeSocketProtocols, type RealtimeCredentialsResponseV1 } from '../../shared/api/realtimeCredentialsV1.ts'
import { isServerMessageV1, type ServerMessageV1 } from '../../shared/realtime/protocolV1.ts'

const issuer = 'https://test.cloudflareaccess.com', audience = 'a'.repeat(64)
const baseBody = { v: 1, areaId: 'town', entryPointId: 'farm-arrival' }
async function setup(t: test.TestContext, blocked = true) {
  const keys = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])
  const jwk = { ...await crypto.subtle.exportKey('jwk', keys.publicKey), kid: 'test', alg: 'RS256' }
  // Only the in-memory harness replaces key fetching and the database resolver. Production authentication/router are reused.
  const entry = `
    import { handleApiRequest } from './server/api/handler.ts'
    import { createApiRouter } from './server/api/router.ts'
    import { CloudflareAccessIdentityProvider } from './server/identity/CloudflareAccessIdentityProvider.ts'
    import { CloudflareAccessJwtVerifier } from './server/identity/CloudflareAccessJwtVerifier.ts'
    import { AreaPresence } from './server/realtime/AreaPresence.ts'
    export class TestAreaPresence extends AreaPresence {
      boot = crypto.randomUUID()
      probe() { return { boot: this.boot, checkpoint: this.ctx.storage.kv.get('area-presence-v1'), tickets: this.ctx.storage.kv.get('area-tickets-v1') } }
      expireTicket() { const saved = this.ctx.storage.kv.get('area-tickets-v1'); saved.pending.forEach(t => t.expiresAt = 1); this.ctx.storage.kv.put('area-tickets-v1', saved) }
    }
    const router = createApiRouter({ authenticationConfigurationFactory: () => ({
      identityProvider: new CloudflareAccessIdentityProvider(new CloudflareAccessJwtVerifier('${issuer}', '${audience}', async () => Response.json({ keys: [${JSON.stringify(jwk)}] }))),
      createPlayerIdentityResolver: async () => ({ resolve: async identity => ({ playerId: identity.subject === 'bad' ? 'invalid' : '00000000-0000-4000-8000-' + (identity.subject === 'a' ? '000000000001' : '000000000002') }) })
    }), resolveRealtimePlayerSocial: async (_context, playerId) => ({ publicId: playerId, displayName: playerId.endsWith('1') ? 'Saguaro One' : 'Saguaro Two',
      blockedPublicIds: ${blocked} && playerId.endsWith('2') ? ['00000000-0000-4000-8000-000000000001'] : [] }) })
    export default { async fetch(request, env) {
      const url = new URL(request.url)
      const stub = env.AREA_PRESENCE.get(env.AREA_PRESENCE.idFromName('area:v1:town'))
      if (url.pathname === '/probe') return Response.json(await stub.probe())
      if (url.pathname === '/expire-ticket') { await stub.expireTicket(); return new Response('ok') }
      if (url.pathname === '/wrong-owner') {
        const wrong = env.AREA_PRESENCE.get(env.AREA_PRESENCE.idFromName('area:v1:unconfigured-test-owner'))
        return wrong.fetch(new Request('https://area.internal/redeem', { headers: { Upgrade: 'websocket', 'X-CactiGrow-Area': 'town', 'X-CactiGrow-Ticket': request.headers.get('X-Test-Ticket') } }))
      }
      return handleApiRequest(request, { ...env, CACTIGROW_ENVIRONMENT: request.headers.get('X-Test-Production') ? 'production' : 'test', CACTIGROW_VERSION: 'test', CACTIGROW_REALTIME_ENABLED: request.headers.get('X-Test-Production') ? 'false' : 'true', CACTIGROW_REALTIME_ORIGIN: 'https://test' }, undefined, {
        router, createRequestDatabaseContext: () => ({ getDatabase() { throw new Error('Unexpected database access') }, async dispose() {} })
      })
    } }
  `
  const bundled = await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, format: 'esm', platform: 'node', target: 'es2023', external: ['cloudflare:workers'],
    banner: { js: "import { createRequire } from 'node:module'; const require = createRequire('/index.js');" } })
  const mf = new Miniflare({ workers: [{ config: {
    name: 'admission-test', type: 'worker', compatibilityDate: '2026-09-20', compatibilityFlags: ['nodejs_compat'],
    manifest: { mainModule: 'index.js', modules: { 'index.js': { type: 'esm', contents: bundled.outputFiles[0].text } } },
    env: { AREA_PRESENCE: { type: 'durable-object', worker: 'admission-test', exportName: 'TestAreaPresence' } },
    exports: { TestAreaPresence: { type: 'durable-object', storage: 'sqlite', unsafePreventEviction: false } },
  } }], log: new Log(LogLevel.ERROR), port: 0, telemetry: { enabled: false } })
  t.after(() => mf.dispose())
  const token = async (subject = 'a', seconds = 120) => {
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
    const text = encode({ alg: 'RS256', kid: 'test' }) + '.' + encode({ type: 'app', iss: issuer, aud: audience, sub: subject, email: 'test@example.invalid', exp: Math.floor(Date.now() / 1000) + seconds })
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keys.privateKey, new TextEncoder().encode(text))
    return text + '.' + Buffer.from(signature).toString('base64url')
  }
  const issue = async (jwt: string, body: unknown = baseBody, extraHeaders = {}) => mf.dispatchFetch('https://test/api/v1/realtime/admission', {
    method: 'POST', headers: { Origin: 'https://test', 'Content-Type': 'application/json', 'cf-access-jwt-assertion': jwt, ...extraHeaders }, body: JSON.stringify(body),
  })
  const credentials = async (jwt: string, body: unknown = baseBody) => {
    const response = await issue(jwt, body)
    assert.equal(response.status, 200, await response.clone().text())
    assert.equal(response.headers.get('cache-control'), 'no-store')
    const data = (await response.json() as { data: unknown }).data
    assert.ok(isRealtimeCredentialsResponseV1(data)); return data
  }
  const upgrade = (value: RealtimeCredentialsResponseV1, headers = {}, path = value.socketPath) => mf.dispatchFetch('https://test' + path, {
    headers: { Origin: 'https://test', Upgrade: 'websocket', 'Sec-WebSocket-Protocol': realtimeSocketProtocols(value.ticket).join(', '), ...headers },
  })
  return { mf, token, issue, credentials, upgrade }
}
type Upgrade = Awaited<ReturnType<Awaited<ReturnType<typeof setup>>['upgrade']>>
function client(response: Upgrade) {
  assert.equal(response.status, 101)
  assert.equal(response.headers.get('Sec-WebSocket-Protocol'), 'cactigrow.v1')
  const socket = response.webSocket!, messages: ServerMessageV1[] = []
  socket.addEventListener('message', (event) => { const message: unknown = JSON.parse(String(event.data)); assert.ok(isServerMessageV1(message)); messages.push(message) })
  socket.accept()
  const until = async (predicate: () => boolean) => {
    const deadline = Date.now() + 5000
    while (!predicate()) { assert.ok(Date.now() < deadline, 'Timed out waiting for message'); await new Promise((resolve) => setTimeout(resolve, 10)) }
  }
  return { socket, messages, until }
}

test('L3 actual Worker/DO: signed identity, one-use concurrent upgrade, automatic Layer and secret-free storage', { timeout: 30_000 }, async (t) => {
  const h = await setup(t), jwt = await h.token(), superseded = await h.credentials(jwt), credentials = await h.credentials(jwt)
  assert.equal((await h.upgrade(superseded)).status, 401)
  assert.equal((await h.mf.dispatchFetch('https://test/wrong-owner', { headers: { 'X-Test-Ticket': credentials.ticket } })).status, 401)
  const responses = await Promise.all([h.upgrade(credentials), h.upgrade(credentials)])
  assert.deepEqual(responses.map((response) => response.status).sort(), [101, 401])
  const a = client(responses.find((response) => response.status === 101)!)
  await a.until(() => a.messages.length > 0)
  assert.equal(a.messages[0].type, 'welcome')
  assert.equal((await h.upgrade(credentials)).status, 401)
  const b = client(await h.upgrade(await h.credentials(await h.token('b'))))
  await b.until(() => b.messages.length > 0)
  const first = a.messages[0], second = b.messages[0]
  assert.ok(first.type === 'welcome' && second.type === 'welcome')
  assert.equal(first.layerId, second.layerId)
  assert.equal(second.players.length, 2)
  const saved = await (await h.mf.dispatchFetch('https://test/probe')).text()
  for (const secret of [credentials.ticket, credentials.reconnectToken, jwt]) assert.equal(saved.includes(secret), false)
  a.socket.close(); b.socket.close()
})

test('Existing AreaPresence delivers named chat on its socket and suppresses blocked messages server-side', { timeout: 15_000 }, async (t) => {
  const h = await setup(t)
  const publicIdA = '00000000-0000-4000-8000-000000000001'
  const a = client(await h.upgrade(await h.credentials(await h.token('a'))))
  const b = client(await h.upgrade(await h.credentials(await h.token('b'))))
  await a.until(() => a.messages.some((message) => message.type === 'welcome'))
  await b.until(() => b.messages.some((message) => message.type === 'welcome'))
  const townWelcome = b.messages.find((message) => message.type === 'welcome')!
  assert.ok(townWelcome.type === 'welcome')
  assert.equal(townWelcome.players.find((player) => player.publicId === publicIdA)?.label, 'Saguaro One')

  a.socket.send(JSON.stringify({ v: 1, type: 'chat', channel: 'world', text: 'private test phrase' }))
  await a.until(() => a.messages.some((message) => message.type === 'chat' && message.message.text === 'private test phrase'))
  assert.equal(a.messages.find((message) => message.type === 'chat')?.type, 'chat')
  assert.equal(b.messages.some((message) => message.type === 'chat' && message.message.text === 'private test phrase'), false)

  b.socket.send(JSON.stringify({ v: 1, type: 'chat', channel: 'direct', recipientPublicId: publicIdA, text: 'blocked direct' }))
  await b.until(() => b.messages.some((message) => message.type === 'error' && message.code === 'CHAT_UNAVAILABLE'))
  assert.equal(a.messages.some((message) => message.type === 'chat' && message.message.text === 'blocked direct'), false)
  a.socket.close(); b.socket.close()
})

test('L3 rejects missing/bad identity, wrong Area/Origin, client authority, expired/replayed tickets and disabled production', { timeout: 30_000 }, async (t) => {
  const h = await setup(t), jwt = await h.token()
  for (const token of ['', 'invalid', await h.token('bad'), await h.token('a', -1)]) assert.equal((await h.issue(token)).status, 401)
  const parts = jwt.split('.')
  parts[1] = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(parts[1], 'base64url').toString()), sub: 'b' })).toString('base64url')
  assert.equal((await h.issue(parts.join('.'))).status, 401)
  for (const body of [{ ...baseBody, areaId: 'forest' }, { ...baseBody, entryPointId: 'unknown' }, { ...baseBody, playerId: 'forged' }, { ...baseBody, layerId: 'forged' }]) assert.equal((await h.issue(jwt, body)).status, 400)
  assert.equal((await h.issue(jwt, baseBody, { Origin: 'https://evil.example' })).status, 403)
  assert.equal((await h.issue(jwt, baseBody, { 'X-Test-Production': 'true' })).status, 404)
  const credential = await h.credentials(jwt)
  assert.equal((await h.upgrade(credential, {}, '/api/v1/realtime/areas/forest')).status, 404)
  assert.equal((await h.upgrade(credential, { 'Sec-WebSocket-Protocol': 'cactigrow.v1' })).status, 401)
  assert.equal((await h.upgrade({ ...credential, ticket: '0'.repeat(64) })).status, 401)
  assert.equal((await h.upgrade(credential, { Origin: 'https://evil.example' })).status, 403)
  assert.equal((await h.upgrade(credential, { 'X-Test-Production': 'true' })).status, 404)
  assert.equal((await h.mf.dispatchFetch('https://test' + credential.socketPath, { headers: { Origin: 'https://test' } })).status, 400)
  await h.mf.dispatchFetch('https://test/expire-ticket')
  assert.equal((await h.upgrade(credential)).status, 401)
})

test('L3 reconnect requires both authenticated owner and current rotating credential; stale connections stay fenced', { timeout: 30_000 }, async (t) => {
  const h = await setup(t), jwt = await h.token(), first = await h.credentials(jwt), a = client(await h.upgrade(first))
  await a.until(() => a.messages.length > 0)
  assert.equal((await h.issue(jwt)).status, 409)
  assert.equal((await h.issue(jwt, { ...baseBody, reconnectToken: 'a'.repeat(64) })).status, 403)
  assert.equal((await h.issue(await h.token('b'), { ...baseBody, reconnectToken: first.reconnectToken })).status, 403)
  const next = await h.credentials(jwt, { ...baseBody, reconnectToken: first.reconnectToken })
  const b = client(await h.upgrade(next)); await b.until(() => b.messages.length > 0)
  assert.notEqual(first.reconnectToken, next.reconnectToken)
  assert.equal((await h.issue(jwt, { ...baseBody, reconnectToken: first.reconnectToken })).status, 403)
  const oldWelcome = a.messages[0], newWelcome = b.messages[0]
  assert.ok(oldWelcome.type === 'welcome' && newWelcome.type === 'welcome')
  assert.equal(newWelcome.players.length, 1)
  assert.equal(newWelcome.selfPresenceId, oldWelcome.selfPresenceId)
  assert.ok(newWelcome.players[0].generation > oldWelcome.players[0].generation)
  try { a.socket.send('{"v":1,"type":"leave"}'); a.socket.close() } catch { /* replaced socket may already be closed */ }
  b.socket.send('{"v":1,"type":"ping","sequence":1}')
  await b.until(() => b.messages.some((message) => message.type === 'pong'))
  b.socket.close()
})

test('L3 verified session expiry bounds authorization and rejects later admission', { timeout: 15_000 }, async (t) => {
  const h = await setup(t), jwt = await h.token('a', 3), credential = await h.credentials(jwt)
  const claims = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString()) as { exp: number }
  assert.equal(Date.parse(credential.authorizationExpiresAt), claims.exp * 1000)
  assert.equal(credential.expiresAt, credential.authorizationExpiresAt)
  const a = client(await h.upgrade(credential)); await a.until(() => a.messages.length > 0)
  await new Promise((resolve) => setTimeout(resolve, Math.max(0, claims.exp * 1000 - Date.now() + 100)))
  try { a.socket.send('{"v":1,"type":"move","sequence":1,"position":{"x":1101,"y":1280},"facing":"east","movement":"moving"}') } catch { /* already closed by expiry alarm */ }
  assert.equal((await h.issue(jwt)).status, 401)
  const state = await (await h.mf.dispatchFetch('https://test/probe')).json() as { checkpoint: { owners: unknown[] } }
  assert.equal(state.checkpoint.owners.length, 0)
})

test('L3 credentials survive actual idle reconstruction without enabling consumed-ticket replay', { timeout: 30_000 }, async (t) => {
  const h = await setup(t), jwt = await h.token(), credential = await h.credentials(jwt)
  const a = client(await h.upgrade(credential)); await a.until(() => a.messages.length > 0)
  const before = await (await h.mf.dispatchFetch('https://test/probe')).json() as { boot: string }
  await new Promise((resolve) => setTimeout(resolve, 12_000))
  const after = await (await h.mf.dispatchFetch('https://test/probe')).json() as { boot: string }
  assert.notEqual(after.boot, before.boot)
  assert.equal((await h.upgrade(credential)).status, 401)
  const next = await h.credentials(jwt, { ...baseBody, reconnectToken: credential.reconnectToken })
  const b = client(await h.upgrade(next)); await b.until(() => b.messages.length > 0)
  b.socket.close()
})


test('Chat V2 actual Worker/DO routes Farm/Town World and DM; Local/Town are isolated and departure fences membership', { timeout: 20_000 }, async t => {
  const h = await setup(t, false)
  const publicIdA = '00000000-0000-4000-8000-000000000001', publicIdB = '00000000-0000-4000-8000-000000000002'
  const farm = { v: 1, areaId: `farm-${publicIdA}`, entryPointId: 'chat-session' }
  assert.equal((await h.issue(await h.token('b'), farm)).status, 403, 'Farm chat admission is owner scoped')
  const a = client(await h.upgrade(await h.credentials(await h.token('a'), farm)))
  const b = client(await h.upgrade(await h.credentials(await h.token('b'))))
  await a.until(() => a.messages.some(m => m.type === 'welcome')); await b.until(() => b.messages.some(m => m.type === 'welcome'))
  const send = (who: typeof a, channel: string, text: string, recipientPublicId?: string) => who.socket.send(JSON.stringify({ v: 1, type: 'chat', channel, text, ...(recipientPublicId ? { recipientPublicId } : {}) }))
  const received = (who: typeof a, text: string) => who.messages.some(m => m.type === 'chat' && m.message.text === text)
  send(a, 'local', 'private farm local'); await a.until(() => received(a, 'private farm local')); assert.equal(received(b, 'private farm local'), false)
  send(a, 'world', 'same zone world'); await b.until(() => received(b, 'same zone world')); await a.until(() => received(a, 'same zone world'))
  send(a, 'direct', 'farm to town direct', publicIdB); await b.until(() => received(b, 'farm to town direct')); await a.until(() => received(a, 'farm to town direct'))
  send(b, 'direct', 'town to farm direct', publicIdA); await a.until(() => received(a, 'town to farm direct')); await b.until(() => received(b, 'town to farm direct'))
  send(b, 'town', 'town only'); await b.until(() => received(b, 'town only')); assert.equal(received(a, 'town only'), false)
  send(b, 'local', 'town area only'); await b.until(() => received(b, 'town area only')); assert.equal(received(a, 'town area only'), false)
  // A's fifth message is an invalid Town membership attempt, independent of send-rate handling.
  send(a, 'town', 'farm cannot town'); await a.until(() => a.messages.some(m => m.type === 'error')); assert.equal(received(b, 'farm cannot town'), false)
  a.socket.send(JSON.stringify({v:1,type:'leave'})); await new Promise(resolve => setTimeout(resolve,100))
  await new Promise(resolve => setTimeout(resolve,2000)) // New send-rate window, not a fake online status.
  const before = b.messages.length
  send(b, 'direct', 'offline must fail', publicIdA); await b.until(() => b.messages.slice(before).some(m => m.type === 'error'))
  assert.equal(received(b, 'offline must fail'), false, 'Offline DMs never get a delivered sender echo')
  const moved = client(await h.upgrade(await h.credentials(await h.token('a'))))
  await moved.until(() => moved.messages.some(m => m.type === 'welcome'))
  send(b, 'town', 'both in town'); await moved.until(() => received(moved, 'both in town'))
  send(b, 'local', 'both local town'); await moved.until(() => received(moved, 'both local town'))
  moved.socket.close(); b.socket.close()
})
