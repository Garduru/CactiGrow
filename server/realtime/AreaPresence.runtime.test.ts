import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { Miniflare, Log, LogLevel } from 'miniflare'
import { isServerMessageV1, type ServerMessageV1 } from '../../shared/realtime/protocolV1.ts'
import type { Checkpoint, SocketAttachment } from './runtimeContracts.ts'

// This synthetic bridge exists only in an in-memory test bundle, never a Wrangler entrypoint.
const testEntry = `
import { AreaPresence, getAreaCoordinator, admitToArea } from './server/realtime/AreaPresence.ts'
export class TestAreaPresence extends AreaPresence {
  boot = crypto.randomUUID()
  probe() { return { boot: this.boot, checkpoint: this.ctx.storage.kv.get('area-presence-v1'),
    attachments: this.ctx.getWebSockets().map(ws => ws.deserializeAttachment()) } }
}
export default {
  async fetch(request, env) {
    const stub = getAreaCoordinator(env.AREA_PRESENCE, 'town')
    if (new URL(request.url).pathname === '/probe') return Response.json(await stub.probe())
    return admitToArea(env.AREA_PRESENCE, JSON.parse(request.headers.get('X-Test-Scope')))
  }
}`
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
function input(n: number) { return { areaId: 'town', playerId: uuid(n), entryPointId: 'farm-arrival', authorizationExpiresAt: Date.now() + 120_000 } }

async function runtime(t: test.TestContext) {
  const bundled = await build({ stdin: { contents: testEntry, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false,
    format: 'esm', platform: 'neutral', target: 'es2023', external: ['cloudflare:workers'], metafile: true })
  assert.ok(Object.keys(bundled.metafile!.inputs).every((file) => !/server\/(db|gameplay|identity)|react|phaser|base44/i.test(file)), 'runtime bundle must not reach gameplay or database')
  const mf = new Miniflare({ workers: [{ config: {
    name: 'realtime-test', type: 'worker', compatibilityDate: '2026-09-20',
    manifest: { mainModule: 'index.js', modules: { 'index.js': { type: 'esm', contents: bundled.outputFiles[0].text } } },
    env: { AREA_PRESENCE: { type: 'durable-object', worker: 'realtime-test', exportName: 'TestAreaPresence' } },
    exports: { TestAreaPresence: { type: 'durable-object', storage: 'sqlite', unsafePreventEviction: false } },
  } }], log: new Log(LogLevel.ERROR), port: 0, telemetry: { enabled: false } })
  t.after(() => mf.dispose())
  const probe = async () => (await (await mf.dispatchFetch('https://test/probe')).json()) as { boot: string; checkpoint: Checkpoint; attachments: SocketAttachment[] }
  const admit = async (value: unknown) => {
    const response = await mf.dispatchFetch('https://test/admit', { headers: { Upgrade: 'websocket', 'X-Test-Scope': JSON.stringify(value) } })
    if (response.status === 500) throw new Error(await response.text())
    return response
  }
  return { mf, probe, admit }
}
type UpgradeResponse = Awaited<ReturnType<Awaited<ReturnType<typeof runtime>>['admit']>>
function connect(response: UpgradeResponse) {
  assert.equal(response.status, 101)
  const socket = response.webSocket!
  const messages: ServerMessageV1[] = []
  const waiters: (() => void)[] = []
  const closed = new Promise<void>((resolve) => socket.addEventListener('close', () => resolve()))
  socket.addEventListener('message', (event) => {
    const message: unknown = JSON.parse(String(event.data))
    assert.ok(isServerMessageV1(message))
    messages.push(message); for (const notify of waiters.splice(0)) notify()
  })
  socket.accept()
  const until = async (predicate: () => boolean) => {
    const deadline = Date.now() + 5000
    while (!predicate()) {
      if (Date.now() >= deadline) assert.fail('Timed out waiting for runtime message')
      await new Promise<void>((resolve) => { const timer = setTimeout(resolve, 25); waiters.push(() => { clearTimeout(timer); resolve() }) })
    }
  }
  return { socket, messages, until, closed }
}

test('workerd: simultaneous admissions enforce 32/128 capacity and initialize every socket with a welcome', { timeout: 60_000 }, async (t) => {
  const { admit, probe } = await runtime(t)
  const responses = await Promise.all(Array.from({ length: 132 }, (_, n) => admit(input(n + 1))))
  assert.equal(responses.filter((response) => response.status === 101).length, 128)
  assert.equal(responses.filter((response) => response.status === 409).length, 4)
  const clients = responses.filter((r) => r.status === 101).map(connect)
  await Promise.all(clients.map((client) => client.until(() => client.messages.length > 0)))
  assert.ok(clients.every((client) => client.messages[0].type === 'welcome'))
  const { checkpoint } = await probe()
  assert.equal(checkpoint.owners.length, 128)
  assert.equal(new Set(checkpoint.owners.map((owner) => owner.generation)).size, 128)
  assert.equal(checkpoint.layers.length, 4)
  for (const layer of checkpoint.layers) assert.equal(checkpoint.owners.filter((owner) => owner.layerId === layer.layerId).length, 32)
  for (const client of clients) client.socket.close()
})

test('workerd: Layer-isolated movement, duplicate rejection, trusted replacement and late old events', { timeout: 60_000 }, async (t) => {
  const { admit, probe } = await runtime(t)
  const a = connect(await admit(input(1)))
  const b = connect(await admit(input(2)))
  await a.until(() => a.messages.some((m) => m.type === 'joined'))
  assert.equal((await admit(input(1))).status, 409)
  const others = []
  for (let n = 3; n <= 33; n++) others.push(connect(await admit(input(n))))
  const foreign = others.at(-1)!
  await foreign.until(() => foreign.messages.length > 0)
  a.socket.send(JSON.stringify({ v: 1, type: 'move', sequence: 1, position: { x: 1200, y: 1280 }, facing: 'east', movement: 'moving' }))
  await b.until(() => b.messages.some((m) => m.type === 'moved'))
  // Ping/pong is an event-loop barrier on the same owner, not a sleep-based negative assertion.
  foreign.socket.send('{"v":1,"type":"ping","sequence":1}')
  await foreign.until(() => foreign.messages.some((m) => m.type === 'pong'))
  assert.equal(foreign.messages.some((m) => m.type === 'moved'), false)
  assert.equal(a.messages.some((m) => m.type === 'moved'), false)
  const old = (await probe()).checkpoint.owners.find((owner) => owner.playerId === uuid(1))!
  const replacement = connect(await admit({ ...input(1), replace: old }))
  await replacement.until(() => replacement.messages.length > 0)
  try { a.socket.send('{"v":1,"type":"leave"}'); a.socket.close() } catch { /* server already closed it */ }
  replacement.socket.send('{"v":1,"type":"ping","sequence":1}')
  await replacement.until(() => replacement.messages.some((m) => m.type === 'pong'))
  const after = await probe()
  assert.equal(after.checkpoint.owners.length, 33)
  const next = after.checkpoint.owners.find((owner) => owner.playerId === uuid(1))!
  assert.ok(next.generation > old.generation)
  assert.equal(next.presenceId, old.presenceId)
  replacement.socket.close()
  await b.until(() => b.messages.some((m) => m.type === 'left' && m.generation === next.generation))
  assert.equal((await probe()).checkpoint.owners.length, 32)
  b.socket.close(); for (const client of others) client.socket.close()
})

test('workerd: malformed, binary, oversized and invalid-sequence messages fail safely', { timeout: 30_000 }, async (t) => {
  const { admit, probe } = await runtime(t)
  for (const [n, raw] of [[1, new ArrayBuffer(1)], [2, 'x'.repeat(1025)]] as const) {
    const client = connect(await admit(input(n)))
    const closed = new Promise<void>((resolve) => client.socket.addEventListener('close', () => resolve()))
    client.socket.send(raw)
    await closed
    assert.equal((await probe()).checkpoint.owners.length, 0)
  }
  const client = connect(await admit(input(3)))
  client.socket.send('{')
  await client.until(() => client.messages.some((m) => m.type === 'error'))
  client.socket.send('{"v":1,"type":"move","sequence":0,"position":{"x":1100,"y":1280},"facing":"south","movement":"stopped"}')
  await client.until(() => client.messages.filter((m) => m.type === 'error').length === 2)
  assert.equal((await probe()).attachments[0].member.sample.sequence, 0)
  const closed = new Promise<void>((resolve) => client.socket.addEventListener('close', () => resolve()))
  client.socket.send('{'); await closed
  assert.equal((await probe()).checkpoint.owners.length, 0)
})

test('workerd: idle hibernation reconstructs sockets and accepted movement in a new instance', { timeout: 30_000 }, async (t) => {
  const { admit, probe } = await runtime(t)
  const client = connect(await admit(input(1)))
  await client.until(() => client.messages.length > 0)
  client.socket.send('{"v":1,"type":"move","sequence":4,"position":{"x":1200,"y":1280},"facing":"east","movement":"moving"}')
  client.socket.send('{"v":1,"type":"ping","sequence":1}')
  await client.until(() => client.messages.some((m) => m.type === 'pong'))
  const before = await probe()
  // Miniflare's installed runtime evicts idle DOs after ten seconds. No request remains pending in the DO.
  await new Promise((resolve) => setTimeout(resolve, 12_000))
  const after = await probe()
  assert.notEqual(after.boot, before.boot, 'must prove reconstruction, not merely read the same live instance')
  assert.deepEqual(after.checkpoint.owners, before.checkpoint.owners)
  assert.equal(after.attachments[0].member.sample.sequence, 4)
  assert.equal(after.attachments[0].member.sample.position.x, 1200)
  client.socket.send('{"v":1,"type":"ping","sequence":2}')
  await client.until(() => client.messages.some((m) => m.type === 'pong' && m.sequence === 2))
  client.socket.close()
})

test('workerd: authorization-expiry alarm closes an idle socket without client traffic', { timeout: 40_000 }, async (t) => {
  // The installed local bridge sometimes delivers this close after idle eviction (~12s total).
  // Assert eventual close without a probe/message waking the object; do not claim prompt delivery.
  const { admit, probe } = await runtime(t)
  const client = connect(await admit({ ...input(1), authorizationExpiresAt: Date.now() + 2000 }))
  await client.until(() => client.messages.length > 0)
  await client.closed
  assert.equal((await probe()).checkpoint.owners.length, 0)
})
