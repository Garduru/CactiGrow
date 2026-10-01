import { assertValidArea, isEntryPoint, isWithinArea, type AreaDefinition } from '../../shared/realtime/areas.ts'
import { connectionGeneration, isCanonicalUuid, isSequence, type AreaId, type ConnectionGeneration, type LayerId, type PlayerId, type PresenceId } from '../../shared/realtime/identifiers.ts'
import { isMovementSample, type MovementSample, type PublicPresenceV1 } from '../../shared/realtime/protocolV1.ts'
import { assignLayer, isRetired, type LayerPopulation } from './layerAssignment.ts'

export interface MembershipKey {
  readonly areaId: AreaId
  readonly layerId: LayerId
  readonly playerId: PlayerId
  readonly presenceId: PresenceId
  readonly generation: ConnectionGeneration
}
export interface Membership extends MembershipKey {
  readonly publicId: string
  readonly displayName: string
  readonly joinedAt: number
  readonly updatedAt: number
  readonly sample: MovementSample
}
interface Layer {
  readonly layerId: LayerId
  readonly createdAt: number
  readonly emptySince: number | null
}
export interface AreaPresenceState {
  readonly area: AreaDefinition
  readonly layers: readonly Layer[]
  readonly members: readonly Membership[]
  readonly nextGeneration: number
  readonly updatedAt: number
}
export type PresenceFailure = 'AREA_FULL' | 'DUPLICATE_PRESENCE' | 'IDENTIFIER_CONFLICT' | 'INVALID_ENTRY_POINT'
  | 'STALE_CONNECTION' | 'INVALID_MOVEMENT' | 'STALE_SEQUENCE' | 'GENERATION_EXHAUSTED'
export type PresenceTransition = { readonly ok: true; readonly state: AreaPresenceState; readonly membership: Membership }
  | { readonly ok: false; readonly code: PresenceFailure; readonly state: AreaPresenceState }
export interface JoinPresence {
  readonly playerId: PlayerId
  readonly publicId?: string
  readonly displayName?: string
  readonly presenceId: PresenceId
  readonly newLayerId: LayerId
  readonly entryPointId: string
  readonly recentLayerId?: LayerId
}

/** Pure snapshots. No clock, randomness, authentication, I/O, or concurrency mechanism. */
export function createAreaPresenceState(area: AreaDefinition, now: number): AreaPresenceState {
  assertValidArea(area)
  if (!isSequence(now)) throw new Error('Invalid presence time.')
  const definition = { ...area, bounds: { ...area.bounds }, movement: { ...area.movement },
    entryPoints: Object.fromEntries(Object.entries(area.entryPoints).map(([id, point]) => [id, { ...point }])) }
  return { area: definition, layers: [], members: [], nextGeneration: 1, updatedAt: now }
}
function assertTime(state: AreaPresenceState, now: number): void {
  if (!isSequence(now) || now < state.updatedAt) throw new Error('Presence time must be monotonic.')
}
export function findMembership(state: AreaPresenceState, playerId: PlayerId): Membership | undefined {
  return state.members.find((member) => member.playerId === playerId)
}
export function layerPopulation(state: AreaPresenceState, layerId: LayerId): number {
  return state.members.filter((member) => member.layerId === layerId).length
}
export function areaPopulation(state: AreaPresenceState): number { return state.members.length }
export function getLayerPopulations(state: AreaPresenceState): readonly LayerPopulation[] {
  return state.layers.map((layer) => ({ ...layer, areaId: state.area.areaId, population: layerPopulation(state, layer.layerId) }))
}
function fail(state: AreaPresenceState, code: PresenceFailure): PresenceTransition { return { ok: false, state, code } }
function currentMember(state: AreaPresenceState, key: MembershipKey): Membership | undefined {
  if (key.areaId !== state.area.areaId) return undefined
  return state.members.find((member) => member.playerId === key.playerId && member.presenceId === key.presenceId
    && member.layerId === key.layerId && member.generation === key.generation)
}
function canAllocateGeneration(state: AreaPresenceState): boolean {
  return isSequence(state.nextGeneration) && state.nextGeneration > 0 && state.nextGeneration < Number.MAX_SAFE_INTEGER
}

/** Caller supplies fresh server-generated opaque IDs. Affinity has already been authorized. */
export function joinPresence(state: AreaPresenceState, input: JoinPresence, now: number): PresenceTransition {
  assertTime(state, now)
  if (findMembership(state, input.playerId)) return fail(state, 'DUPLICATE_PRESENCE')
  if (!isCanonicalUuid(input.playerId) || !isCanonicalUuid(input.presenceId) || !isCanonicalUuid(input.newLayerId)
    || state.members.some((member) => member.presenceId === input.presenceId)) return fail(state, 'IDENTIFIER_CONFLICT')
  if (!isEntryPoint(state.area, input.entryPointId)) return fail(state, 'INVALID_ENTRY_POINT')
  if (!canAllocateGeneration(state)) return fail(state, 'GENERATION_EXHAUSTED')
  const assignment = assignLayer(state.area, getLayerPopulations(state), now, input.recentLayerId)
  if (!assignment.ok) return fail(state, assignment.code)
  if (assignment.kind === 'create' && state.layers.some((layer) => layer.layerId === input.newLayerId)) return fail(state, 'IDENTIFIER_CONFLICT')
  const layerId = assignment.kind === 'existing' ? assignment.layerId : input.newLayerId
  const membership: Membership = {
    areaId: state.area.areaId, layerId, playerId: input.playerId, presenceId: input.presenceId,
    publicId: input.publicId ?? input.presenceId, displayName: input.displayName ?? 'Grower',
    generation: connectionGeneration(state.nextGeneration), joinedAt: now, updatedAt: now,
    sample: { sequence: 0, position: { ...state.area.entryPoints[input.entryPointId] }, facing: 'south', movement: 'stopped' },
  }
  const retained = retireEmptyLayers(state, now)
  const layers = assignment.kind === 'create'
    ? [...retained.layers, { layerId, createdAt: now, emptySince: null }]
    : retained.layers.map((layer) => layer.layerId === layerId ? { ...layer, emptySince: null } : layer)
  return { ok: true, membership, state: { ...retained, layers, members: [...state.members, membership], nextGeneration: state.nextGeneration + 1, updatedAt: now } }
}

/** Trusted server-only transition: the adapter MUST verify reconnect authorization first.
 * A client UUID, generation, or boolean does not authorize calling this function.
 */
export function replaceAuthorizedConnection(state: AreaPresenceState, previous: MembershipKey, now: number,
  social?: Pick<Membership, 'publicId' | 'displayName'>): PresenceTransition {
  assertTime(state, now)
  const member = currentMember(state, previous)
  if (!member) return fail(state, 'STALE_CONNECTION')
  if (!canAllocateGeneration(state)) return fail(state, 'GENERATION_EXHAUSTED')
  const membership = { ...member, ...social, generation: connectionGeneration(state.nextGeneration), updatedAt: now,
    sample: { ...member.sample, position: { ...member.sample.position }, sequence: 0, movement: 'stopped' as const } }
  return { ok: true, membership, state: { ...state, members: state.members.map((item) => item === member ? membership : item), nextGeneration: state.nextGeneration + 1, updatedAt: now } }
}

export function leavePresence(state: AreaPresenceState, key: MembershipKey, now: number): PresenceTransition {
  assertTime(state, now)
  const membership = currentMember(state, key)
  if (!membership) return fail(state, 'STALE_CONNECTION')
  const members = state.members.filter((member) => member !== membership)
  const empty = !members.some((member) => member.layerId === membership.layerId)
  const layers = state.layers.map((layer) => empty && layer.layerId === membership.layerId ? { ...layer, emptySince: now } : layer)
  return { ok: true, membership, state: { ...state, layers, members, updatedAt: now } }
}

/** Structural/order/bounds checks only. Rate and elapsed-speed enforcement belong to L2/L6. */
export function updatePresenceMovement(state: AreaPresenceState, key: MembershipKey, sample: MovementSample, now: number): PresenceTransition {
  assertTime(state, now)
  const member = currentMember(state, key)
  if (!member) return fail(state, 'STALE_CONNECTION')
  if (!isMovementSample(sample) || !isWithinArea(state.area, sample.position)) return fail(state, 'INVALID_MOVEMENT')
  if (sample.sequence <= member.sample.sequence) return fail(state, 'STALE_SEQUENCE')
  const membership = { ...member, updatedAt: now, sample: { ...sample, position: { ...sample.position } } }
  return { ok: true, membership, state: { ...state, members: state.members.map((item) => item === member ? membership : item), updatedAt: now } }
}

export function retireEmptyLayers(state: AreaPresenceState, now: number): AreaPresenceState {
  assertTime(state, now)
  const retired = new Set(getLayerPopulations(state).filter((layer) => isRetired(layer, state.area, now)).map((layer) => layer.layerId))
  return { ...state, layers: state.layers.filter((layer) => !retired.has(layer.layerId)), updatedAt: now }
}

/** Explicit whitelist: never spread a membership, account, or gameplay object onto the wire. */
export function toPublicPresence(member: Membership): PublicPresenceV1 {
  return {
    presenceId: member.presenceId, publicId: member.publicId ?? member.presenceId, generation: member.generation, label: member.displayName ?? 'Grower', appearance: 'placeholder',
    sequence: member.sample.sequence, position: { x: member.sample.position.x, y: member.sample.position.y },
    facing: member.sample.facing, movement: member.sample.movement,
  }
}
export function getLayerSnapshot(state: AreaPresenceState, layerId: LayerId): readonly PublicPresenceV1[] {
  return state.members.filter((member) => member.layerId === layerId).map(toPublicPresence)
}
