import assert from 'node:assert/strict'
import test from 'node:test'
import { getChatLocation, sharesChatScope } from '../../shared/realtime/chatLocation.ts'
import { ChatDirectory, type ChatPeer } from './ChatDirectory.ts'
import { AreaCoordinator } from './AreaCoordinator.ts'
import { TOWN_AREA } from '../../shared/realtime/areas.ts'
import { playerId } from '../../shared/realtime/identifiers.ts'
import type { PublicChatMessageV1 } from '../../shared/realtime/protocolV1.ts'

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
test('Local, Town and World scopes distinguish Areas and Zones, with private Farm identities', () => {
  const town = getChatLocation('town')!, farm = getChatLocation(`farm-${id(1)}`)!, otherFarm = getChatLocation(`farm-${id(2)}`)!
  for (const channel of ['local', 'town', 'world'] as const) assert.equal(sharesChatScope(channel, town, town), true)
  assert.equal(sharesChatScope('local', town, farm), false)
  assert.equal(sharesChatScope('town', town, farm), false)
  assert.equal(sharesChatScope('world', town, farm), true)
  assert.equal(sharesChatScope('local', farm, otherFarm), false)
  assert.equal(sharesChatScope('world', town, { ...farm, zoneId: 'future-zone' }), false)
  assert.equal(sharesChatScope('town', farm, farm), false)
})
test('Directory direct delivery requires a live recipient acknowledgment; replacement and expiry fence stale senders', async () => {
  let now = 1000, accept = 1
  const deliveries: { area: string; echo?: boolean }[] = [], revoked: ChatPeer[] = []
  let saved: ChatPeer[] = []
  const ports = { now: () => now, save: (peers: ChatPeer[]) => { saved = structuredClone(peers) },
    deliver: async (area: string, delivery: { echo?: boolean }) => { deliveries.push({ area, echo: delivery.echo }); return accept }, revoke: async (peer: ChatPeer) => { revoked.push(peer) } }
  const directory = new ChatDirectory(ports)
  const a = { playerId: id(1), publicId: id(11), presenceId: id(21), areaId: `farm-${id(11)}`, joinedAt: now, expiresAt: now + 60_000 }
  const b = { playerId: id(2), publicId: id(12), presenceId: id(22), areaId: 'town', joinedAt: now, expiresAt: now + 60_000 }
  await directory.update(a.areaId, [a]); await directory.update(b.areaId, [b])
  const message: PublicChatMessageV1 = { id: id(31), channel: 'direct', senderPublicId: a.publicId, senderDisplayName: 'Sender', recipientPublicId: b.publicId, text: 'Hello', sentAt: now }
  assert.equal(await directory.route(a, message, []), true)
  assert.deepEqual(deliveries.map(d => d.area), ['town', a.areaId]); assert.equal(deliveries[1].echo, true)
  deliveries.length = 0; accept = 0
  assert.equal(await directory.route(a, message, []), false); assert.equal(deliveries.length, 1); assert.equal(deliveries[0].echo, undefined)
  deliveries.length = 0; assert.equal(await directory.route(a, message, [b.publicId]), false); assert.equal(deliveries.length, 0)
  const moved = { ...a, areaId: 'town', presenceId: id(23), joinedAt: now + 1 }
  await directory.update('town', [b, moved]); assert.equal(revoked[0].presenceId, a.presenceId)
  await directory.update(a.areaId, [a]); assert.equal(directory.current(a.playerId)?.areaId, 'town')
  assert.equal(await directory.route(a, message, []), false)
  const recovered = new ChatDirectory(ports, saved); assert.equal(recovered.current(a.playerId)?.areaId, 'town')
  now += 60_000; assert.equal(recovered.current(a.playerId), undefined)
})
test('Directory rate budget survives lease refresh and hibernation state', async () => {
  let now = 1000, saved: ChatPeer[] = []
  const ports = { now: () => now, save: (peers: ChatPeer[]) => { saved = structuredClone(peers) }, deliver: async () => 1, revoke: async () => {} }
  const directory = new ChatDirectory(ports), peer = { playerId: id(1), publicId: id(11), presenceId: id(21), areaId: 'town', joinedAt: now, expiresAt: now + 60000 }
  await directory.update('town', [peer])
  const message: PublicChatMessageV1 = { id: id(31), channel: 'world', senderPublicId: peer.publicId, senderDisplayName: 'Sender', text: 'Hello', sentAt: now }
  for (let i = 0; i < 5; i++) assert.equal(await directory.route(peer, message, []), true)
  await directory.update('town', [peer]); const restored = new ChatDirectory(ports, saved)
  assert.equal(await restored.route(peer, message, []), false)
  now += 2000; assert.equal(await restored.route(peer, message, []), true)
})
test('Town/Local/World chat cross rendering Layers while movement snapshots remain Layer scoped', () => {
  class Socket {
    readyState = 1; attachment: unknown; messages: { type: string; message?: PublicChatMessageV1; players?: unknown[] }[] = []
    send(text: string) { this.messages.push(JSON.parse(text)) }
    close() { this.readyState = 3 }
    serializeAttachment(v: unknown) { this.attachment = v }
    deserializeAttachment() { return this.attachment }
  }
  let uuid = 50
  const runtime = new AreaCoordinator({ ...TOWN_AREA, layerCapacity: 1 }, { now: () => 1000, uuid: () => id(uuid++), accept() {}, save() {}, diagnostic() {} })
  const a = new Socket(), b = new Socket()
  for (const [socket, n] of [[a, 1], [b, 2]] as const) assert.equal(runtime.admit({ areaId: 'town', playerId: playerId(id(n)), publicId: id(n + 10), displayName: 'Player ' + n, entryPointId: 'farm-arrival', authorizationExpiresAt: 100000 }, socket).ok, true)
  assert.equal(a.messages[0].players?.length, 1); assert.equal(b.messages[0].players?.length, 1)
  for (const channel of ['local', 'town', 'world']) {
    runtime.message(a, JSON.stringify({ v: 1, type: 'chat', channel, text: channel }))
    assert.equal(b.messages.at(-1)?.message?.channel, channel)
  }
})
