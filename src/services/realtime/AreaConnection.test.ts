import assert from 'node:assert/strict'
import test from 'node:test'
import { AreaConnection, type RealtimeSocket } from './AreaConnection.ts'
import { RemotePlayers } from '../../game-world/RemotePlayers.ts'
import { CactiGrowApiClient, CactiGrowApiError } from '../api/CactiGrowApiClient.ts'
import { TOWN_AREA } from '../../../shared/realtime/areas.ts'
import { layerId, presenceId, connectionGeneration } from '../../../shared/realtime/identifiers.ts'
import type { PublicPresenceV1, ServerMessageV1 } from '../../../shared/realtime/protocolV1.ts'
import type { RealtimeCredentialsRequestV1 } from '../../../shared/api/realtimeCredentialsV1.ts'

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const player = (n: number, sequence = 0): PublicPresenceV1 => ({ presenceId: presenceId(uuid(n)), publicId: uuid(n + 300), generation: connectionGeneration(n), label: `Saguaro ${n}`, appearance: 'placeholder',
  sequence, position: { x: 1100, y: 1280 }, facing: 'south', movement: 'stopped' })
const welcome = (remote = player(2)): ServerMessageV1 => ({ v: 1, type: 'welcome', eventSequence: 0, areaId: TOWN_AREA.areaId, layerId: layerId(uuid(9)), coordinateVersion: 1,
  selfPresenceId: player(1).presenceId, players: [player(1), remote], limits: { maxClientFrameBytes: 1024, maxMovementUpdatesPerSecond: 10, heartbeatIntervalMs: 20_000, staleAfterMs: 60_000 } })
class Clock {
  time = 1000
  jobs = new Set<{ at: number; run: () => void }>()
  schedule = (run: () => void, delay: number) => { const job = { at: this.time + delay, run }; this.jobs.add(job); return () => { this.jobs.delete(job) } }
  advance(ms: number) {
    const end = this.time + ms
    for (;;) {
      const next = [...this.jobs].filter((job) => job.at <= end).sort((a, b) => a.at - b.at)[0]
      if (!next) break
      this.time = next.at; this.jobs.delete(next); next.run()
    }
    this.time = end
  }
}
class Socket extends EventTarget {
  readyState = 1
  bufferedAmount = 0
  sent: Record<string, unknown>[] = []
  send(raw: string) { this.sent.push(JSON.parse(raw)) }
  close() { this.readyState = 3; this.dispatchEvent(new Event('close')) }
  receive(message: ServerMessageV1) { this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(message) })) }
}
const settle = async () => { await new Promise<void>((resolve) => setImmediate(resolve)) }
const credential = { v: 1 as const, areaId: TOWN_AREA.areaId, socketPath: '/api/v1/realtime/areas/town', ticket: 'a'.repeat(64), reconnectToken: 'b'.repeat(64),
  expiresAt: new Date(100_000).toISOString(), authorizationExpiresAt: new Date(200_000).toISOString() }
function harness(admit?: (input: RealtimeCredentialsRequestV1, signal: AbortSignal) => Promise<typeof credential>, recoverStalePresence = false) {
  const clock = new Clock(), sockets: Socket[] = [], requests: RealtimeCredentialsRequestV1[] = []
  const connection = new AreaConnection({ areaId: TOWN_AREA.areaId, entryPointId: 'farm-arrival', origin: 'https://test', recoverStalePresence, now: () => clock.time, schedule: clock.schedule,
    admit: (input, signal) => { requests.push(input); return admit ? admit(input, signal) : Promise.resolve(credential) },
    socket: (url, protocols) => { assert.equal(url, 'wss://test/api/v1/realtime/areas/town'); assert.equal(protocols[1], 'cactigrow.ticket.' + credential.ticket); const socket = new Socket(); sockets.push(socket); return socket as unknown as RealtimeSocket },
  })
  return { connection, clock, sockets, requests, async begin() { connection.start(); clock.advance(0); await settle(); sockets[0].receive(welcome()) } }
}

test('Admission uses existing authenticated API contract; Strict Mode and repeated starts create one socket', async () => {
  const calls: RequestInit[] = []
  const api = new CactiGrowApiClient({ getCredentials: () => ({ 'x-cactigrow-development-identity': 'account-a' }), fetch: async (_url, init) => {
    calls.push(init!); return Response.json({ ok: true, data: credential, meta: { requestId: 'test' } })
  } })
  const h = harness((input, signal) => api.requestRealtimeAdmission(input, signal))
  h.connection.start(); h.connection.stop(); h.connection.start(); h.connection.start(); h.clock.advance(0); await settle(); await settle()
  assert.equal(calls.length, 1)
  assert.deepEqual(JSON.parse(calls[0].body as string), { v: 1, areaId: 'town', entryPointId: 'farm-arrival' })
  assert.equal(new Headers(calls[0].headers).get('x-cactigrow-development-identity'), 'account-a')
  assert.equal(h.sockets.length, 1)
  assert.equal(h.sockets[0].sent.length, 0, 'upgrade/welcome handshake sends no rejected stream hello')
  h.sockets[0].receive(welcome()); assert.equal(h.connection.getSnapshot().status, 'connected')
  h.connection.stop(); assert.equal(h.sockets[0].sent.at(-1)?.type, 'leave'); assert.equal(h.clock.jobs.size, 0)
})

test('Welcome and deltas exclude self, deduplicate joins, reject stale movement/generations, and clear on disconnect', async () => {
  const h = harness(); await h.begin(); const socket = h.sockets[0]
  assert.deepEqual(h.connection.getSnapshot().remotes, [player(2)])
  socket.receive({ v: 1, type: 'joined', eventSequence: 1, player: player(2) })
  socket.receive({ v: 1, type: 'joined', eventSequence: 2, player: player(1) })
  assert.equal(h.connection.getSnapshot().remotes.length, 1)
  const sample = { sequence: 3, position: { x: 1200, y: 1280 }, facing: 'east' as const, movement: 'moving' as const }
  socket.receive({ v: 1, type: 'moved', eventSequence: 3, presenceId: player(2).presenceId, generation: player(2).generation, sample, acceptedAt: 1000 })
  socket.receive({ v: 1, type: 'moved', eventSequence: 4, presenceId: player(2).presenceId, generation: player(2).generation, sample: { ...sample, sequence: 1 }, acceptedAt: 1001 })
  assert.equal(h.connection.getSnapshot().remotes[0].sequence, 3)
  socket.receive({ v: 1, type: 'left', eventSequence: 5, presenceId: player(2).presenceId, generation: connectionGeneration(1), reason: 'disconnect' })
  assert.equal(h.connection.getSnapshot().remotes.length, 1)
  socket.receive({ v: 1, type: 'left', eventSequence: 6, presenceId: player(2).presenceId, generation: player(2).generation, reason: 'leave' })
  assert.equal(h.connection.getSnapshot().remotes.length, 0)
  socket.receive({ v: 1, type: 'joined', eventSequence: 7, player: player(3) }); socket.close()
  assert.equal(h.connection.getSnapshot().remotes.length, 0)
  h.connection.stop()
})

test('World and Direct Chat use the existing socket and expose sender public identity', async () => {
  const h = harness(); await h.begin(); const socket = h.sockets[0]
  assert.equal(h.connection.sendWorldMessage('  Hello Town  '), true)
  assert.deepEqual(socket.sent.at(-1), { v: 1, type: 'chat', channel: 'world', text: 'Hello Town' })
  assert.equal(h.connection.sendDirectMessage(player(2).publicId, 'Hi friend'), true)
  assert.deepEqual(socket.sent.at(-1), { v: 1, type: 'chat', channel: 'direct', recipientPublicId: player(2).publicId, text: 'Hi friend' })
  const message = { id: uuid(400), channel: 'world' as const, senderPublicId: player(2).publicId,
    senderDisplayName: player(2).label, text: 'Hello Town', sentAt: 1100 }
  socket.receive({ v: 1, type: 'chat', eventSequence: 1, message })
  assert.deepEqual(h.connection.getSnapshot().chatMessages, [message])
  h.connection.stop()
})

test('Movement is bounded, sends a final stop once, remains quiet while idle, and never sends disconnected', async () => {
  const h = harness(); h.connection.sampleMovement({ x: 1100, y: 1280 }, 'south', false); await h.begin()
  for (let n = 0; n < 63; n++) { h.connection.sampleMovement({ x: 1100 + n, y: 1280 }, 'east', true); h.clock.advance(16) }
  assert.ok(h.sockets[0].sent.length <= 10)
  h.clock.advance(110); h.connection.sampleMovement({ x: 1162, y: 1280 }, 'east', false)
  const sent = h.sockets[0].sent.length
  assert.equal(h.sockets[0].sent.at(-1)?.movement, 'stopped')
  for (let n = 0; n < 20; n++) { h.clock.advance(110); h.connection.sampleMovement({ x: 1162, y: 1280 }, 'east', false) }
  assert.equal(h.sockets[0].sent.length, sent)
  h.sockets[0].close(); h.connection.sampleMovement({ x: 1200, y: 1280 }, 'east', true)
  assert.equal(h.sockets[0].sent.length, sent); h.connection.stop()
})

test('Reconnect rebuilds from welcome, fences old callbacks, and exhausts bounded retries during rapid failures', async () => {
  const h = harness(); await h.begin(); const old = h.sockets[0]; old.close()
  h.clock.advance(1000); await settle()
  assert.equal(h.requests[1].reconnectToken, credential.reconnectToken)
  h.sockets[1].receive(welcome(player(3)))
  old.receive({ v: 1, type: 'joined', eventSequence: 1, player: player(4) })
  assert.deepEqual(h.connection.getSnapshot().remotes, [player(3)])
  for (const delay of [3000, 8000]) { h.sockets.at(-1)!.close(); h.clock.advance(delay); await settle(); h.sockets.at(-1)!.receive(welcome()) }
  h.sockets.at(-1)!.close(); h.clock.advance(100_000); await settle()
  assert.equal(h.sockets.length, 4); assert.equal(h.connection.getSnapshot().status, 'unavailable')
  h.connection.stop()
})

test('Late admission after unmount cannot open a socket; authentication failures never retry', async () => {
  let resolve!: (value: typeof credential) => void, signal!: AbortSignal
  const h = harness((_input, currentSignal) => { signal = currentSignal; return new Promise((done) => { resolve = done }) })
  h.connection.start(); h.clock.advance(0); h.connection.stop(); resolve(credential); await settle()
  assert.equal(signal.aborted, true); assert.equal(h.sockets.length, 0)
  const denied = harness(async () => { throw new CactiGrowApiError('unauthenticated', 'Sign in', undefined, 401) })
  denied.connection.start(); denied.clock.advance(0); await settle(); denied.clock.advance(100_000)
  assert.equal(denied.requests.length, 1); assert.equal(denied.connection.getSnapshot().status, 'unavailable'); denied.connection.stop()
})

test('Staging world reload recovers after an old presence lease; repeated conflict stays bounded and stop cancels grace', async () => {
  const conflict = () => new CactiGrowApiError('conflict', 'Presence already active', undefined, 409)
  const h = harness(async () => { if (h.clock.time < 61_000) throw conflict(); return credential }, true)
  h.connection.start(); h.clock.advance(0); await settle()
  for (const delay of [1000, 3000, 8000]) { h.clock.advance(delay); await settle() }
  assert.equal(h.requests.length, 4); assert.equal(h.connection.getSnapshot().status, 'reconnecting')
  h.clock.advance(60_000); await settle(); h.sockets[0].receive(welcome())
  assert.equal(h.connection.getSnapshot().status, 'connected'); assert.equal(h.requests.length, 5)
  assert.equal(h.connection.getSnapshot().diagnostic, undefined); h.connection.stop()
  const blocked = harness(async () => { throw conflict() }, true)
  blocked.connection.start(); blocked.clock.advance(0); await settle()
  for (const delay of [1000, 3000, 8000, 60_000]) { blocked.clock.advance(delay); await settle() }
  assert.equal(blocked.requests.length, 5); assert.equal(blocked.connection.getSnapshot().status, 'unavailable')
  blocked.connection.stop(); assert.equal(blocked.clock.jobs.size, 0)
  const cancelled = harness(async () => { throw conflict() }, true)
  cancelled.connection.start(); cancelled.clock.advance(0); await settle()
  for (const delay of [1000, 3000, 8000]) { cancelled.clock.advance(delay); await settle() }
  cancelled.connection.stop(); cancelled.clock.advance(60_000); await settle()
  assert.equal(cancelled.requests.length, 4); assert.equal(cancelled.clock.jobs.size, 0)
})

test('Authorization expiry and browser backpressure stop sends and clear remote state', async () => {
  const h = harness(); await h.begin()
  h.clock.time = 200_001; h.connection.sampleMovement({ x: 1101, y: 1280 }, 'east', true)
  assert.equal(h.sockets[0].sent.length, 0); assert.equal(h.connection.getSnapshot().status, 'unavailable'); h.connection.stop()
  const slow = harness(); await slow.begin(); slow.sockets[0].bufferedAmount = 4097
  slow.connection.sampleMovement({ x: 1101, y: 1280 }, 'east', true)
  assert.equal(slow.sockets[0].sent.length, 0); assert.equal(slow.connection.getSnapshot().remotes.length, 0); slow.connection.stop()
})

test('Remote renderer interpolates one avatar per presence, stops at its target and destroys departures/resets', () => {
  const avatars: { x: number; y: number; destroyed: boolean; setPosition(x: number, y: number): void; destroy(): void }[] = []
  const view = new RemotePlayers(() => { const avatar = { x: 0, y: 0, destroyed: false, setPosition(x: number, y: number) { this.x = x; this.y = y }, destroy() { this.destroyed = true } }; avatars.push(avatar); return avatar })
  view.sync([player(2)], 0); view.sync([player(2)], 5); assert.equal(avatars.length, 1)
  assert.equal(view.getAtPosition({ x: 1100, y: 1219 })?.publicId, player(2).publicId, 'head is selectable')
  assert.equal(view.getAtPosition({ x: 1100, y: 1262 })?.publicId, player(2).publicId, 'body is selectable')
  assert.equal(view.getAtPosition({ x: 1000, y: 1219 }), undefined, 'empty ground is not a profile')
  view.sync([{ ...player(2, 1), position: { x: 1210, y: 1280 } }], 10)
  view.update(65); assert.equal(avatars[0].x, 1155)
  assert.equal(view.getAtPosition({ x: 1155, y: 1219 })?.publicId, player(2).publicId, 'hit test follows the rendered avatar')
  assert.equal(view.getAtPosition({ x: 1210, y: 1219 }), undefined, 'future network position is not selectable yet')
  view.update(1000); assert.equal(avatars[0].x, 1210)
  view.sync([], 1001); assert.equal(avatars[0].destroyed, true)
  view.sync([player(3)], 1002); view.clear(); assert.equal(avatars[1].destroyed, true)
})
