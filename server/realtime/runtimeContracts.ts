import { getAreaDefinition, isEntryPoint, isWithinArea, type AreaDefinition } from '../../shared/realtime/areas.ts'
import { isCanonicalUuid, isGeneration, isSequence, type AreaId, type LayerId, type PlayerId } from '../../shared/realtime/identifiers.ts'
import { hasExactKeys, isMovementSample, isRecord } from '../../shared/realtime/protocolV1.ts'
import type { AreaPresenceState, Membership, MembershipKey } from './presenceState.ts'
import { assignLayer } from './layerAssignment.ts'

/** Server-only capability input. L3 must authenticate and authorize BEFORE calling. */
export interface TrustedAdmission {
  readonly areaId: AreaId
  readonly playerId: PlayerId
  readonly entryPointId: string
  readonly authorizationExpiresAt: number
  readonly recentLayerId?: LayerId
  readonly replace?: MembershipKey
}
export const STALE_AFTER_MS = 60_000
export const HEARTBEAT_MS = 20_000
export const MAX_MESSAGES_PER_SECOND = 30
export const MAX_INVALID_MESSAGES = 3
export const MAX_OUTPUT_BYTES_PER_SECOND = 64 * 1024
export const CHECKPOINT_KEY = 'area-presence-v1'

export function areaCoordinatorName(id: unknown): string {
  const area = getAreaDefinition(id)
  if (!area) throw new Error('Unknown realtime Area.')
  return `area:v1:${area.areaId}`
}
export function isMembershipKey(value: unknown): value is MembershipKey {
  return isRecord(value) && hasExactKeys(value, ['areaId', 'layerId', 'playerId', 'presenceId', 'generation'])
    && typeof value.areaId === 'string' && isCanonicalUuid(value.layerId) && isCanonicalUuid(value.playerId)
    && isCanonicalUuid(value.presenceId) && isGeneration(value.generation)
}
export function membershipKey(member: MembershipKey): MembershipKey {
  return { areaId: member.areaId, layerId: member.layerId, playerId: member.playerId, presenceId: member.presenceId, generation: member.generation }
}
export function sameOwner(a: MembershipKey, b: MembershipKey): boolean {
  return a.areaId === b.areaId && a.layerId === b.layerId && a.playerId === b.playerId
    && a.presenceId === b.presenceId && a.generation === b.generation
}
export function isTrustedAdmission(value: unknown, area: AreaDefinition, now: number): value is TrustedAdmission {
  if (!isRecord(value)) return false
  const keys = ['areaId', 'playerId', 'entryPointId', 'authorizationExpiresAt']
  if (Object.hasOwn(value, 'recentLayerId')) keys.push('recentLayerId')
  if (Object.hasOwn(value, 'replace')) keys.push('replace')
  return hasExactKeys(value, keys) && value.areaId === area.areaId && isCanonicalUuid(value.playerId)
    && isEntryPoint(area, value.entryPointId) && isSequence(value.authorizationExpiresAt) && value.authorizationExpiresAt > now
    && (!Object.hasOwn(value, 'recentLayerId') || isCanonicalUuid(value.recentLayerId))
    && (!Object.hasOwn(value, 'replace') || (isMembershipKey(value.replace)
      && value.replace.areaId === area.areaId && value.replace.playerId === value.playerId))
}

/** No tickets, credentials, or external identity. Kept below the attachment's 2 KiB limit. */
export interface SocketAttachment {
  v: 1
  coordinateVersion: number
  member: Membership
  authorizationExpiresAt: number
  lastSeen: number
  eventSequence: number
  windowStart: number
  messages: number
  movements: number
  outputBytes: number
  invalidMessages: number
}
export interface Checkpoint {
  v: 1
  areaId: AreaId
  coordinateVersion: number
  nextGeneration: number
  updatedAt: number
  layers: AreaPresenceState['layers']
  owners: readonly MembershipKey[]
}
export function isCheckpoint(value: unknown, area: AreaDefinition): value is Checkpoint {
  if (!isRecord(value) || !hasExactKeys(value, ['v', 'areaId', 'coordinateVersion', 'nextGeneration', 'updatedAt', 'layers', 'owners'])
    || value.v !== 1 || value.areaId !== area.areaId || value.coordinateVersion !== area.coordinateVersion
    || !isGeneration(value.nextGeneration) || !isSequence(value.updatedAt)
    || !Array.isArray(value.layers) || value.layers.length > area.populationLimit * 2
    || !Array.isArray(value.owners) || value.owners.length > area.populationLimit) return false
  const owners = value.owners
  if (!owners.every(isMembershipKey) || owners.some((owner) => owner.areaId !== area.areaId || owner.generation >= (value.nextGeneration as number))
    || new Set(owners.map((owner) => owner.playerId)).size !== owners.length
    || new Set(owners.map((owner) => owner.presenceId)).size !== owners.length
    || new Set(owners.map((owner) => owner.generation)).size !== owners.length) return false
  if (!value.layers.every((layer) => isRecord(layer) && hasExactKeys(layer, ['layerId', 'createdAt', 'emptySince']) && isCanonicalUuid(layer.layerId))) return false
  const layers = value.layers
  if (owners.some((owner) => !layers.some((layer: { layerId: string }) => layer.layerId === owner.layerId))) return false
  try {
    assignLayer(area, value.layers.map((layer) => ({ ...layer, areaId: area.areaId,
      population: owners.filter((owner) => owner.layerId === layer.layerId).length })), value.updatedAt)
    return true
  } catch { return false }
}
export function isSocketAttachment(value: unknown, area: AreaDefinition, now: number): value is SocketAttachment {
  if (!isRecord(value) || !hasExactKeys(value, ['v', 'coordinateVersion', 'member', 'authorizationExpiresAt', 'lastSeen', 'eventSequence',
    'windowStart', 'messages', 'movements', 'outputBytes', 'invalidMessages']) || value.v !== 1 || value.coordinateVersion !== area.coordinateVersion) return false
  const member = value.member
  if (!isRecord(member) || !hasExactKeys(member, ['areaId', 'layerId', 'playerId', 'presenceId', 'generation', 'joinedAt', 'updatedAt', 'sample'])
    || !isMembershipKey({ areaId: member.areaId, layerId: member.layerId, playerId: member.playerId, presenceId: member.presenceId, generation: member.generation })
    || member.areaId !== area.areaId || !isSequence(member.joinedAt) || !isSequence(member.updatedAt)
    || member.joinedAt > member.updatedAt || member.updatedAt > now || !isMovementSample(member.sample) || !isWithinArea(area, member.sample.position)) return false
  return [value.authorizationExpiresAt, value.lastSeen, value.eventSequence, value.windowStart, value.messages, value.movements, value.outputBytes, value.invalidMessages].every(isSequence)
    && (value.authorizationExpiresAt as number) > now && (value.lastSeen as number) <= now
    && (value.lastSeen as number) >= member.updatedAt && now - (value.lastSeen as number) < STALE_AFTER_MS
    && (value.windowStart as number) <= now && (value.messages as number) <= MAX_MESSAGES_PER_SECOND
    && (value.movements as number) <= area.movement.maxUpdatesPerSecond
    && (value.outputBytes as number) <= MAX_OUTPUT_BYTES_PER_SECOND && (value.invalidMessages as number) < MAX_INVALID_MESSAGES
}
