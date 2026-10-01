import assert from 'node:assert/strict'
import test from 'node:test'
import { TOWN_AREA } from '../../shared/realtime/areas.ts'
import { areaId, layerId, playerId, presenceId } from '../../shared/realtime/identifiers.ts'
import { isPublicPresenceV1, type MovementSample } from '../../shared/realtime/protocolV1.ts'
import { areaPopulation, createAreaPresenceState, findMembership, getLayerSnapshot, joinPresence, layerPopulation, leavePresence, replaceAuthorizedConnection, retireEmptyLayers, toPublicPresence, updatePresenceMovement, type AreaPresenceState, type PresenceTransition } from './presenceState.ts'

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const input = (n: number) => ({ playerId: playerId(uuid(n)), presenceId: presenceId(uuid(n + 100)), newLayerId: layerId(uuid(n + 200)), entryPointId: 'farm-arrival' })
const initial = () => createAreaPresenceState({ ...TOWN_AREA, layerCapacity: 2, populationLimit: 5, emptyLayerRetentionMs: 30 }, 0)
function success(result: PresenceTransition) {
  if (!result.ok) assert.fail(result.code)
  return result
}
function failure(result: PresenceTransition, code: string, original: AreaPresenceState) {
  assert.equal(result.ok, false)
  if (result.ok) throw new Error('Expected failure')
  assert.equal(result.code, code)
  assert.equal(result.state, original)
}
const move: MovementSample = { sequence: 1, position: { x: 1101, y: 1280 }, facing: 'east', movement: 'moving' }

test('First and second members share a Layer; joining is immutable and population is derived', () => {
  const empty = initial()
  const first = success(joinPresence(empty, input(1), 1))
  const second = success(joinPresence(first.state, input(2), 2))
  assert.equal(empty.members.length, 0)
  assert.equal(first.state.members.length, 1)
  assert.equal(second.membership.layerId, first.membership.layerId)
  assert.equal(areaPopulation(second.state), 2)
  assert.equal(layerPopulation(second.state, first.membership.layerId), 2)
  assert.equal(findMembership(second.state, input(1).playerId), first.membership)
  assert.equal(findMembership(second.state, input(9).playerId), undefined)
})
test('Sequential admissions enforce Layer and Area capacity without moving existing members', () => {
  let state = initial()
  for (let n = 1; n <= 5; n++) state = success(joinPresence(state, input(n), n)).state
  assert.deepEqual(state.layers.map((layer) => layerPopulation(state, layer.layerId)), [2, 2, 1])
  assert.equal(state.members[0].layerId, input(1).newLayerId)
  failure(joinPresence(state, input(6), 6), 'AREA_FULL', state)
})
test('An unrelated duplicate connection cannot add presence', () => {
  const first = success(joinPresence(initial(), input(1), 1))
  failure(joinPresence(first.state, { ...input(2), playerId: input(1).playerId }, 2), 'DUPLICATE_PRESENCE', first.state)
})

test('Admission rejects noncanonical identity aliases at the runtime boundary', () => {
  const canonical = 'abcdefab-0000-4000-8000-000000000001'
  const first = success(joinPresence(initial(), { ...input(1), playerId: playerId(canonical), presenceId: presenceId(canonical), newLayerId: layerId(canonical) }, 1))
  // Model an adapter bypassing the branded constructors; raw runtime inputs still fail closed.
  for (const field of ['playerId', 'presenceId', 'newLayerId']) {
    failure(joinPresence(first.state, { ...input(2), [field]: canonical.toUpperCase() }, 2), 'IDENTIFIER_CONFLICT', first.state)
  }
})

test('Inherited coordinates cannot enter movement state and disappear when copied', () => {
  const first = success(joinPresence(initial(), input(1), 1))
  const position = Object.assign(Object.create(move.position), { email: 'private', tokens: 123 })
  failure(updatePresenceMovement(first.state, first.membership, { ...move, position }, 2), 'INVALID_MOVEMENT', first.state)
})
test('Presence and Layer ID collisions and invalid entries fail without changing state', () => {
  const first = success(joinPresence(initial(), input(1), 1))
  failure(joinPresence(first.state, { ...input(2), presenceId: input(1).presenceId }, 2), 'IDENTIFIER_CONFLICT', first.state)
  failure(joinPresence(first.state, { ...input(2), entryPointId: '__proto__' }, 2), 'INVALID_ENTRY_POINT', first.state)
  const full = success(joinPresence(first.state, input(2), 2)).state
  failure(joinPresence(full, { ...input(3), newLayerId: first.membership.layerId }, 3), 'IDENTIFIER_CONFLICT', full)
})
test('Authorized replacement at full Area capacity retains presence and Layer but fences old events', () => {
  const one = createAreaPresenceState({ ...TOWN_AREA, layerCapacity: 1, populationLimit: 1 }, 0)
  const first = success(joinPresence(one, input(1), 1))
  const updated = success(updatePresenceMovement(first.state, first.membership, move, 2))
  const replaced = success(replaceAuthorizedConnection(updated.state, first.membership, 3))
  assert.equal(replaced.membership.presenceId, first.membership.presenceId)
  assert.equal(replaced.membership.layerId, first.membership.layerId)
  assert.ok(replaced.membership.generation > first.membership.generation)
  assert.equal(replaced.membership.sample.sequence, 0)
  assert.equal(replaced.membership.sample.movement, 'stopped')
  assert.deepEqual(replaced.membership.sample.position, move.position)
  assert.equal(areaPopulation(replaced.state), 1)
  failure(leavePresence(replaced.state, first.membership, 4), 'STALE_CONNECTION', replaced.state)
  failure(updatePresenceMovement(replaced.state, first.membership, { ...move, sequence: 2 }, 4), 'STALE_CONNECTION', replaced.state)
  failure(replaceAuthorizedConnection(replaced.state, first.membership, 4), 'STALE_CONNECTION', replaced.state)
  assert.equal(success(updatePresenceMovement(replaced.state, replaced.membership, move, 4)).membership.sample.sequence, 1)
})
test('Leaving removes one member; only the last departure starts empty retention', () => {
  const first = success(joinPresence(initial(), input(1), 1))
  const second = success(joinPresence(first.state, input(2), 2))
  const left = success(leavePresence(second.state, first.membership, 3))
  assert.equal(areaPopulation(left.state), 1)
  assert.equal(left.state.layers[0].emptySince, null)
  const empty = success(leavePresence(left.state, second.membership, 4))
  assert.equal(areaPopulation(empty.state), 0)
  assert.equal(empty.state.layers[0].emptySince, 4)
  assert.equal(retireEmptyLayers(empty.state, 33).layers.length, 1)
  assert.equal(retireEmptyLayers(empty.state, 34).layers.length, 0)
  failure(leavePresence(empty.state, second.membership, 5), 'STALE_CONNECTION', empty.state)
})
test('Occupied Layers never retire, and affinity can refill an empty retained Layer', () => {
  let state = initial()
  const first = success(joinPresence(state, input(1), 1))
  state = success(joinPresence(first.state, input(2), 2)).state
  const third = success(joinPresence(state, input(3), 3))
  const emptySecond = success(leavePresence(third.state, third.membership, 4))
  const fourth = success(joinPresence(emptySecond.state, { ...input(4), recentLayerId: third.membership.layerId }, 5))
  assert.equal(fourth.membership.layerId, third.membership.layerId)
  assert.equal(fourth.state.layers[1].emptySince, null)
  assert.equal(retireEmptyLayers(fourth.state, 100).layers.length, 2)
})
test('Leave then rejoin cannot reuse an old generation, even for the same player and presence ID', () => {
  const first = success(joinPresence(initial(), input(1), 1))
  const left = success(leavePresence(first.state, first.membership, 2))
  const rejoined = success(joinPresence(left.state, input(1), 3))
  assert.ok(rejoined.membership.generation > first.membership.generation)
  failure(leavePresence(rejoined.state, first.membership, 4), 'STALE_CONNECTION', rejoined.state)
})
test('Identical player, Layer, and presence IDs in different Areas stay isolated', () => {
  const first = success(joinPresence(initial(), input(1), 1))
  const other = success(joinPresence(createAreaPresenceState({ ...TOWN_AREA, areaId: areaId('test-area') }, 0), input(1), 1))
  failure(leavePresence(other.state, first.membership, 2), 'STALE_CONNECTION', other.state)
  failure(updatePresenceMovement(other.state, first.membership, move, 2), 'STALE_CONNECTION', other.state)
  failure(replaceAuthorizedConnection(other.state, first.membership, 2), 'STALE_CONNECTION', other.state)
  assert.equal(areaPopulation(first.state), 1)
  assert.equal(areaPopulation(other.state), 1)
})
test('Movement transitions reject wrong Layer, stale sequence, and invalid coordinates', () => {
  const first = success(joinPresence(initial(), input(1), 1))
  failure(updatePresenceMovement(first.state, { ...first.membership, layerId: input(9).newLayerId }, move, 2), 'STALE_CONNECTION', first.state)
  for (const point of [{ x: NaN, y: 1 }, { x: -1, y: 1 }, { x: 2201, y: 1 }]) {
    failure(updatePresenceMovement(first.state, first.membership, { ...move, position: point }, 2), 'INVALID_MOVEMENT', first.state)
  }
  const updated = success(updatePresenceMovement(first.state, first.membership, move, 2))
  for (const sequence of [0, 1]) failure(updatePresenceMovement(updated.state, updated.membership, { ...move, sequence }, 3), 'STALE_SEQUENCE', updated.state)
  assert.equal(first.membership.sample.sequence, 0)
})
test('Public snapshots isolate Layers and explicitly exclude private fields', () => {
  const first = success(joinPresence(initial(), input(1), 1))
  const second = success(joinPresence(first.state, input(2), 2))
  const third = success(joinPresence(second.state, input(3), 3))
  assert.equal(getLayerSnapshot(third.state, first.membership.layerId).length, 2)
  assert.equal(getLayerSnapshot(third.state, third.membership.layerId).length, 1)
  const contaminated = { ...first.membership, email: 'private', tokenBalance: 123, externalIdentity: { subject: 'secret' } }
  const dto = toPublicPresence(contaminated)
  assert.equal(isPublicPresenceV1(dto), true)
  assert.deepEqual(Object.keys(dto).sort(), ['appearance', 'facing', 'generation', 'label', 'movement', 'position', 'presenceId', 'publicId', 'sequence'].sort())
  assert.notEqual(dto.position, first.membership.sample.position)
})
test('Invalid time and generation exhaustion fail without wrapping generations', () => {
  const state = initial()
  assert.throws(() => joinPresence(state, input(1), -1), /monotonic/)
  const first = success(joinPresence(state, input(1), 2))
  assert.throws(() => retireEmptyLayers(first.state, 1), /monotonic/)
  const exhausted = { ...first.state, nextGeneration: Number.MAX_SAFE_INTEGER }
  failure(joinPresence(exhausted, input(2), 3), 'GENERATION_EXHAUSTED', exhausted)
  failure(replaceAuthorizedConnection(exhausted, first.membership, 3), 'GENERATION_EXHAUSTED', exhausted)
})
