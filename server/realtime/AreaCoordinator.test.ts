import assert from 'node:assert/strict'
import test from 'node:test'
import { TOWN_AREA } from '../../shared/realtime/areas.ts'
import { areaId, playerId } from '../../shared/realtime/identifiers.ts'
import { isServerMessageV1, type ServerMessageV1 } from '../../shared/realtime/protocolV1.ts'
import { AreaCoordinator, type PresenceSocket } from './AreaCoordinator.ts'
import { areaCoordinatorName, MAX_OUTPUT_BYTES_PER_SECOND, membershipKey, type Checkpoint, type SocketAttachment, type TrustedAdmission } from './runtimeContracts.ts'

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
class Socket implements PresenceSocket {
  readyState = 1
  attachment: unknown
  sent: ServerMessageV1[] = []
  failSend = false
  failAttachment = false
  send(raw: string) { if (this.failSend) throw new Error('gone'); this.sent.push(JSON.parse(raw) as ServerMessageV1) }
  close() { this.readyState = 3 }
  serializeAttachment(value: unknown) { if (this.failAttachment) throw new Error('attachment'); this.attachment = structuredClone(value) }
  deserializeAttachment() { return structuredClone(this.attachment) }
}
function harness(area = { ...TOWN_AREA, layerCapacity: 2, populationLimit: 4 }) {
  let now = 1000, id = 100
  let checkpoint: Checkpoint | undefined
  const sockets: Socket[] = []
  const logs: unknown[] = []
  const ports = { now: () => now, uuid: () => uuid(++id), accept: (socket: PresenceSocket) => { sockets.push(socket as Socket) },
    save: (value: Checkpoint) => { checkpoint = structuredClone(value) }, diagnostic: (...args: unknown[]) => { logs.push(args) } }
  let runtime = new AreaCoordinator(area, ports)
  return {
    get runtime() { return runtime }, get checkpoint() { return structuredClone(checkpoint!) }, sockets, logs,
    time(value: number) { now = value },
    input(n: number, patch: Partial<TrustedAdmission> = {}): TrustedAdmission {
      return { areaId: area.areaId, playerId: playerId(uuid(n)), entryPointId: 'farm-arrival', authorizationExpiresAt: 100_000, ...patch }
    },
    join(n: number, patch: Partial<TrustedAdmission> = {}) {
      const socket = new Socket()
      const result = runtime.admit(this.input(n, patch), socket)
      return { socket, result }
    },
    recover(saved: unknown = checkpoint) { runtime = new AreaCoordinator(area, ports, structuredClone(saved), sockets); return runtime },
  }
}
const move = (sequence: number, x = 1101) => JSON.stringify({ v: 1, type: 'move', sequence, position: { x, y: 1280 }, facing: 'east', movement: 'moving' })
const attachment = (socket: Socket) => socket.attachment as SocketAttachment

test('Runtime admission reuses L1, produces welcome first, isolates Layers, and enforces both caps', () => {
  const h = harness()
  const a = h.join(1), b = h.join(2), c = h.join(3), d = h.join(4)
  assert.deepEqual([a.result, b.result, c.result, d.result], Array(4).fill({ ok: true }))
  assert.equal(h.join(5).result.ok, false)
  assert.deepEqual(h.runtime.snapshot().layers.map((layer) => h.runtime.snapshot().members.filter((m) => m.layerId === layer.layerId).length), [2, 2])
  assert.equal(a.socket.sent[0].type, 'welcome')
  const welcome = b.socket.sent[0]
  assert.equal(welcome.type, 'welcome')
  if (welcome.type === 'welcome') assert.equal(welcome.players.length, 2)
  assert.equal(a.socket.sent[1].type, 'joined')
  h.runtime.message(a.socket, move(1))
  assert.equal(b.socket.sent.at(-1)?.type, 'moved')
  assert.equal(a.socket.sent.some((m) => m.type === 'moved'), false)
  assert.equal(c.socket.sent.some((m) => m.type === 'moved'), false)
  for (const socket of h.sockets) for (const message of socket.sent) assert.equal(isServerMessageV1(message), true)
})
test('Full-capacity replacement is generation-owned; stale movement and repeated old close do nothing', () => {
  const h = harness({ ...TOWN_AREA, layerCapacity: 1, populationLimit: 1 })
  const a = h.join(1)
  const previous = membershipKey(attachment(a.socket).member)
  assert.deepEqual(h.join(1).result, { ok: false, code: 'DUPLICATE_PRESENCE' })
  const b = h.join(1, { replace: previous })
  assert.equal(b.result.ok, true)
  assert.equal(h.runtime.snapshot().members.length, 1)
  assert.ok(attachment(b.socket).member.generation > previous.generation)
  h.runtime.message(a.socket, move(100))
  h.runtime.remove(a.socket); h.runtime.remove(a.socket)
  assert.equal(h.runtime.snapshot().members[0].sample.sequence, 0)
  h.runtime.message(b.socket, move(1))
  assert.equal(h.runtime.snapshot().members[0].sample.sequence, 1)
  assert.deepEqual(h.join(1, { replace: previous }).result, { ok: false, code: 'STALE_CONNECTION' })
})
test('Connection cleanup broadcasts once, retains empty Layer, reuses and retires at its deadline', () => {
  const h = harness(), a = h.join(1), b = h.join(2)
  h.runtime.message(a.socket, JSON.stringify({ v: 1, type: 'leave' }))
  h.runtime.remove(a.socket)
  assert.equal(b.socket.sent.filter((m) => m.type === 'left').length, 1)
  h.runtime.remove(b.socket)
  const layer = h.runtime.snapshot().layers[0].layerId
  h.time(2000)
  const c = h.join(3)
  assert.equal(attachment(c.socket).member.layerId, layer)
  h.runtime.remove(c.socket)
  assert.equal(h.runtime.nextAlarm(), 32000)
  h.time(31999); h.runtime.sweep(); assert.equal(h.runtime.snapshot().layers.length, 1)
  h.time(32000); h.runtime.sweep(); assert.equal(h.runtime.snapshot().layers.length, 0)
  assert.equal(h.runtime.nextAlarm(), null)
})
test('Expired authorization and stale sockets are removed by scheduled cleanup and on messages', () => {
  const h = harness(), a = h.join(1, { authorizationExpiresAt: 2000 }), b = h.join(2)
  h.time(2000); h.runtime.message(a.socket, move(1))
  assert.equal(a.socket.readyState, 3)
  assert.equal(h.runtime.snapshot().members.length, 1)
  h.time(61000); h.runtime.sweep()
  assert.equal(b.socket.readyState, 3)
  assert.equal(h.runtime.snapshot().members.length, 0)
})
test('Protocol faults, identity claims, bounds, stale sequence and hello are rejected without mutation', () => {
  for (const raw of ['{', '{"v":2,"type":"leave"}', move(1, -1), move(0),
    '{"v":1,"type":"ping","sequence":1,"playerId":"forged"}', '{"v":1,"type":"hello","ticket":"secret"}',
    '{"v":1,"type":"move","sequence":1,"position":{"x":1e999,"y":0},"facing":"east","movement":"moving"}']) {
    const h = harness(), a = h.join(1)
    h.runtime.message(a.socket, raw)
    assert.equal(h.runtime.snapshot().members[0].sample.sequence, 0)
    assert.equal(a.socket.sent.at(-1)?.type, 'error')
    h.runtime.message(a.socket, raw); h.runtime.message(a.socket, raw)
    assert.equal(h.runtime.snapshot().members.length, 0)
    assert.equal(JSON.stringify(h.logs).includes('secret'), false)
  }
})
test('Binary and oversized UTF-8 frames close immediately; frame count and movement rate are bounded', () => {
  for (const raw of [new ArrayBuffer(1), 'x'.repeat(1025), '🌵'.repeat(300)]) {
    const h = harness(), a = h.join(1)
    h.runtime.message(a.socket, raw)
    assert.equal(a.socket.readyState, 3)
  }
  const h = harness(), a = h.join(1)
  for (let i = 1; i <= 11; i++) h.runtime.message(a.socket, move(i))
  assert.equal(a.socket.readyState, 3)
  const b = h.join(2)
  for (let i = 0; i < 31; i++) h.runtime.message(b.socket, JSON.stringify({ v: 1, type: 'ping', sequence: i }))
  assert.equal(b.socket.readyState, 3)
})
test('Recovery restores position, sequence, identity, budgets and generation; expiry cannot revive membership', () => {
  const h = harness(), a = h.join(1), b = h.join(2, { authorizationExpiresAt: 2000 })
  h.runtime.message(a.socket, move(4, 1200))
  const before = h.runtime.snapshot().members[0]
  const events = attachment(a.socket).eventSequence
  h.time(2000); h.recover()
  assert.deepEqual(h.runtime.snapshot().members, [before])
  assert.equal(b.socket.readyState, 3)
  assert.equal(a.socket.sent.at(-1)?.type, 'left')
  h.runtime.message(a.socket, move(3))
  assert.equal(h.runtime.snapshot().members[0].sample.sequence, 4)
  assert.ok(attachment(a.socket).eventSequence > events)
  assert.equal(h.join(1).result.ok, false)
  h.runtime.remove(a.socket)
  const c = h.join(1)
  assert.ok(attachment(c.socket).member.generation > before.generation)
})
test('Corrupt, foreign, closed and ambiguous attachments fail closed; malformed checkpoint disables recovery', () => {
  for (const mutate of [
    (s: Socket) => { s.attachment = { v: 999 } },
    (s: Socket) => { attachment(s).member = { ...attachment(s).member, areaId: areaId('other') } },
    (s: Socket) => { attachment(s).member = { ...attachment(s).member, sample: { ...attachment(s).member.sample, position: { x: NaN, y: 0 } } } },
    (s: Socket) => { s.readyState = 3 },
  ]) {
    const h = harness(), a = h.join(1)
    mutate(a.socket); h.recover()
    assert.equal(h.runtime.snapshot().members.length, 0)
  }
  const h = harness(), a = h.join(1), duplicate = new Socket()
  duplicate.attachment = structuredClone(a.socket.attachment); h.sockets.push(duplicate)
  h.recover(); assert.equal(h.runtime.snapshot().members.length, 0)
  const full = harness(); full.join(1); full.join(2)
  const corrupt = full.checkpoint
  corrupt.owners = [...corrupt.owners, corrupt.owners[0]]
  assert.throws(() => full.recover(corrupt), /Invalid realtime checkpoint/)
  assert.ok(full.sockets.every((s) => s.readyState === 3))
})
test('Recovery preserves per-connection rate limits and never adopts stale replacement attachments', () => {
  const h = harness(), a = h.join(1)
  for (let i = 1; i <= 10; i++) h.runtime.message(a.socket, move(i))
  h.recover(); h.runtime.message(a.socket, move(11)); assert.equal(a.socket.readyState, 3)
  const b = h.join(2), saved = structuredClone(b.socket.attachment)
  h.join(2, { replace: membershipKey(attachment(b.socket).member) })
  b.socket.readyState = 1; b.socket.attachment = saved
  h.recover(); assert.equal(h.runtime.snapshot().members.length, 1); assert.equal(b.socket.readyState, 3)
})
test('Failed accepts and sends cannot leak membership or remove another socket', () => {
  const h = harness(), a = h.join(1)
  a.socket.failSend = true
  const b = h.join(2)
  assert.equal(h.runtime.snapshot().members.length, 1)
  assert.equal(h.runtime.snapshot().members[0].playerId, attachment(b.socket).member.playerId)
  b.socket.failAttachment = true
  h.runtime.message(b.socket, move(1))
  assert.equal(h.runtime.snapshot().members.length, 0)
})
test('Trusted scope is checked and synthetic Areas remain independent without Town rules', () => {
  const a = harness(), b = harness({ ...TOWN_AREA, areaId: areaId('test-area'), layerCapacity: 2, populationLimit: 4 })
  const first = a.join(1), second = b.join(1)
  assert.equal(a.runtime.admit(b.input(2), new Socket()).ok, false)
  assert.equal(a.join(2, { authorizationExpiresAt: 1000 }).result.ok, false)
  a.runtime.message(first.socket, move(1))
  assert.equal(second.socket.sent.length, 1)
  assert.equal(b.runtime.snapshot().members[0].sample.sequence, 0)
  assert.equal(areaCoordinatorName('town'), 'area:v1:town')
  assert.throws(() => areaCoordinatorName('forest'), /Unknown/)
})

test('Output budgets survive recovery, and socket attachment failure before commitment consumes no slot', () => {
  const h = harness(), a = h.join(1)
  assert.ok(new TextEncoder().encode(JSON.stringify(a.socket.attachment)).byteLength < 2048)
  attachment(a.socket).outputBytes = MAX_OUTPUT_BYTES_PER_SECOND
  h.recover()
  h.runtime.message(a.socket, '{"v":1,"type":"ping","sequence":1}')
  assert.equal(h.runtime.snapshot().members.length, 0)
  const bad = new Socket(); bad.failAttachment = true
  assert.deepEqual(h.runtime.admit(h.input(2), bad), { ok: false, code: 'UNAVAILABLE' })
  assert.equal(h.runtime.snapshot().members.length, 0)
  assert.equal(h.join(2).result.ok, true)
})
