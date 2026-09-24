import assert from 'node:assert/strict'
import test from 'node:test'
import { TOWN_AREA } from '../../shared/realtime/areas.ts'
import { connectionGeneration, layerId, presenceId } from '../../shared/realtime/identifiers.ts'
import { isClientMessageV1, isPublicPresenceV1, isServerMessageV1, MAX_CLIENT_FRAME_BYTES, MAX_SERVER_FRAME_BYTES, parseClientMessageText, parseServerMessageText, type ClientMessageV1, type PublicPresenceV1, type ServerMessageV1 } from '../../shared/realtime/protocolV1.ts'

const id = presenceId('00000000-0000-4000-8000-000000000001')
const sample = { sequence: 1, position: { x: 1100, y: 1280 }, facing: 'south' as const, movement: 'stopped' as const }
const player: PublicPresenceV1 = { ...sample, presenceId: id, generation: connectionGeneration(1), label: 'Grower', appearance: 'placeholder' }
const welcome: ServerMessageV1 = {
  v: 1, type: 'welcome', eventSequence: 0, areaId: TOWN_AREA.areaId, coordinateVersion: 1,
  layerId: layerId('00000000-0000-4000-8000-000000000002'), selfPresenceId: id, players: [player],
  limits: { maxClientFrameBytes: 1024, maxMovementUpdatesPerSecond: 10, heartbeatIntervalMs: 20_000, staleAfterMs: 60_000 },
}
const clients: readonly ClientMessageV1[] = [
  { v: 1, type: 'hello', ticket: 'test-ticket' }, { v: 1, type: 'move', ...sample },
  { v: 1, type: 'ping', sequence: 0 }, { v: 1, type: 'leave' },
]
const servers: readonly ServerMessageV1[] = [
  welcome, { v: 1, type: 'joined', eventSequence: 1, player },
  { v: 1, type: 'moved', eventSequence: 2, presenceId: id, generation: connectionGeneration(1), sample, acceptedAt: 100 },
  { v: 1, type: 'left', eventSequence: 3, presenceId: id, generation: connectionGeneration(1), reason: 'leave' },
  { v: 1, type: 'pong', eventSequence: 4, sequence: 1, serverTime: 100 },
  { v: 1, type: 'error', eventSequence: 5, code: 'AREA_FULL', retryable: true },
]

test('All V1 client families validate and round-trip through bounded text parsing', () => {
  for (const message of clients) {
    assert.equal(isClientMessageV1(message), true)
    assert.deepEqual(parseClientMessageText(JSON.stringify(message)), { ok: true, message })
  }
})
test('All V1 server families validate with an explicit combined welcome snapshot', () => {
  for (const message of servers) {
    assert.equal(isServerMessageV1(message), true)
    assert.deepEqual(parseServerMessageText(JSON.stringify(message)), { ok: true, message })
  }
})
test('Malformed JSON, unsupported versions, unknown types, and missing fields are rejected', () => {
  assert.deepEqual(parseClientMessageText('{'), { ok: false, code: 'MALFORMED_JSON' })
  assert.deepEqual(parseClientMessageText('{"v":2,"type":"leave"}'), { ok: false, code: 'UNSUPPORTED_VERSION' })
  for (const message of [null, [], 1, { type: 'leave' }, { v: 1, type: 'unknown' }, { v: 1, type: 'hello' }, { v: 1, type: 'ping' }, { v: 1, type: 'move', sequence: 0 }]) {
    assert.deepEqual(parseClientMessageText(JSON.stringify(message)), { ok: false, code: 'INVALID_MESSAGE' })
  }
})
test('The 1 KiB client limit counts UTF-8 bytes and accepts its exact boundary', () => {
  assert.equal(MAX_CLIENT_FRAME_BYTES, 1024)
  const json = JSON.stringify(clients[3])
  assert.equal(parseClientMessageText(json.padEnd(1024)).ok, true)
  assert.deepEqual(parseClientMessageText(json.padEnd(1025)), { ok: false, code: 'FRAME_TOO_LARGE' })
  const multibyte = JSON.stringify({ v: 1, type: 'hello', ticket: '🌵'.repeat(100) })
  assert.ok(multibyte.length < 300)
  assert.ok(new TextEncoder().encode(multibyte).byteLength > 300)
  assert.deepEqual(parseClientMessageText(multibyte, 300), { ok: false, code: 'FRAME_TOO_LARGE' })
  assert.throws(() => parseClientMessageText(json, 0), /Invalid frame limit/)
})
test('Coordinates must be finite numbers with an exact position shape', () => {
  for (const position of [{ x: NaN, y: 0 }, { x: Infinity, y: 0 }, { x: 0, y: -Infinity }, { x: '0', y: 0 }, { x: 0 }, { x: 0, y: 0, playerId: id }]) {
    assert.equal(isClientMessageV1({ v: 1, type: 'move', ...sample, position }), false)
  }
  assert.equal(parseClientMessageText('{"v":1,"type":"move","sequence":1,"position":{"x":1e999,"y":0},"facing":"south","movement":"stopped"}').ok, false)
})
test('Sequence numbers are nonnegative safe integers; movement and facing are allowlisted', () => {
  for (const sequence of [-1, 1.5, NaN, Infinity, '1', Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(isClientMessageV1({ v: 1, type: 'move', ...sample, sequence }), false)
    assert.equal(isClientMessageV1({ v: 1, type: 'ping', sequence }), false)
  }
  for (const patch of [{ facing: 'up' }, { movement: 'teleport' }, { movement: true }]) {
    assert.equal(isClientMessageV1({ v: 1, type: 'move', ...sample, ...patch }), false)
  }
})

test('Position guards require own coordinates, including inside public snapshots', () => {
  const position = Object.assign(Object.create({ x: 1100, y: 1280 }), { email: 'private', tokens: 123 })
  assert.equal(isClientMessageV1({ v: 1, type: 'move', ...sample, position }), false)
  assert.equal(isPublicPresenceV1({ ...player, position }), false)
})

test('Wire identifiers use canonical UUIDs so casing cannot alias a presence', () => {
  const canonical = presenceId('abcdefab-0000-4000-8000-000000000001')
  const upper = canonical.toUpperCase()
  const canonicalPlayer = { ...player, presenceId: canonical }
  assert.equal(isServerMessageV1({ ...welcome, selfPresenceId: canonical, players: [canonicalPlayer] }), true)
  assert.equal(parseServerMessageText(JSON.stringify({ ...welcome, selfPresenceId: canonical,
    players: [canonicalPlayer, { ...canonicalPlayer, presenceId: upper }] })).ok, false)
  for (const message of [
    { ...welcome, layerId: upper }, { ...welcome, selfPresenceId: upper },
    { v: 1, type: 'joined', eventSequence: 1, player: { ...player, presenceId: upper } },
    { ...servers[2], presenceId: upper }, { ...servers[3], presenceId: upper },
  ]) assert.equal(isServerMessageV1(message), false)
})
test('Every client family rejects unexpected identity, Layer, and generation fields', () => {
  for (const message of clients) for (const field of ['playerId', 'presenceId', 'layerId', 'areaId', 'generation', 'tokens']) {
    assert.equal(isClientMessageV1({ ...message, [field]: id }), false)
  }
})
test('Hello rejects empty, oversized, and control-character tickets', () => {
  for (const ticket of ['', 'x'.repeat(257), '\n', null, 1]) assert.equal(isClientMessageV1({ v: 1, type: 'hello', ticket }), false)
})
test('Public DTO validation rejects private fields at every protocol nesting level', () => {
  for (const field of ['playerId', 'email', 'externalIdentity', 'tokenBalance', 'genetics']) {
    const leaked = { ...player, [field]: 'private' }
    assert.equal(isPublicPresenceV1(leaked), false)
    assert.equal(isServerMessageV1({ ...welcome, players: [leaked] }), false)
    assert.equal(isServerMessageV1({ v: 1, type: 'joined', eventSequence: 1, player: leaked }), false)
    for (const message of servers) assert.equal(isServerMessageV1({ ...message, [field]: 'private' }), false)
  }
})
test('Welcome rejects unknown Areas, stale content versions, invalid limits, and inconsistent snapshots', () => {
  for (const patch of [
    { areaId: 'unknown' }, { coordinateVersion: 2 }, { layerId: 'Layer 1' }, { selfPresenceId: 'bad' },
    { players: [] }, { players: [player, player] },
    { players: [{ ...player, position: { x: -1, y: 0 } }] },
    { players: [{ ...player, presenceId: '00000000-0000-4000-8000-000000000009' }] },
    { limits: { ...welcome.limits, maxClientFrameBytes: 2048 } },
    { limits: { ...welcome.limits, staleAfterMs: 10 } },
    { limits: { ...welcome.limits, heartbeatIntervalMs: NaN } },
  ]) assert.equal(isServerMessageV1({ ...welcome, ...patch }), false)
})
test('Server parser bounds snapshots and validates event metadata', () => {
  assert.deepEqual(parseServerMessageText(' '.repeat(MAX_SERVER_FRAME_BYTES + 1)), { ok: false, code: 'FRAME_TOO_LARGE' })
  for (const message of servers) {
    assert.equal(isServerMessageV1({ ...message, eventSequence: -1 }), false)
    assert.equal(isServerMessageV1({ ...message, v: 2 }), false)
  }
  assert.equal(isPublicPresenceV1({ ...player, generation: 0 }), false)
  assert.equal(isPublicPresenceV1({ ...player, label: 'x'.repeat(49) }), false)
})
