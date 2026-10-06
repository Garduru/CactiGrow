import { getAreaDefinition, isPosition, isWithinArea, type Position } from './areas.ts'
import { isCanonicalUuid, isGeneration, isSequence, type AreaId, type ConnectionGeneration, type LayerId, type PresenceId } from './identifiers.ts'
import { isCharacterAppearance, type CharacterAppearance } from '../api/startingExperienceV1.ts'

export const REALTIME_PROTOCOL_VERSION = 1 as const
export const MAX_CLIENT_FRAME_BYTES = 1024
export const MAX_SERVER_FRAME_BYTES = 32 * 1024
export type Facing = 'north' | 'south' | 'east' | 'west'
export type MovementState = 'moving' | 'stopped'
export interface MovementSample {
  readonly sequence: number
  readonly position: Position
  readonly facing: Facing
  readonly movement: MovementState
}
export interface PublicPresenceV1 extends MovementSample {
  readonly presenceId: PresenceId
  readonly publicId: string
  readonly generation: ConnectionGeneration
  readonly label: string
  readonly appearance: 'placeholder' | CharacterAppearance
}
export interface PublicChatMessageV1 {
  readonly id: string
  readonly channel: 'local' | 'town' | 'world' | 'direct'
  readonly senderPublicId: string
  readonly senderDisplayName: string
  readonly recipientPublicId?: string
  readonly text: string
  readonly sentAt: number
}
export interface ConnectionLimitsV1 {
  readonly maxClientFrameBytes: number
  readonly maxMovementUpdatesPerSecond: number
  readonly heartbeatIntervalMs: number
  readonly staleAfterMs: number
}
export type ClientMessageV1 =
  | { readonly v: 1; readonly type: 'hello'; readonly ticket: string }
  | ({ readonly v: 1; readonly type: 'move' } & MovementSample)
  | { readonly v: 1; readonly type: 'chat'; readonly channel: 'local' | 'town' | 'world' | 'direct'; readonly recipientPublicId?: string; readonly text: string }
  | { readonly v: 1; readonly type: 'ping'; readonly sequence: number }
  | { readonly v: 1; readonly type: 'leave' }

interface ServerEnvelope { readonly v: 1; readonly eventSequence: number }
export type ServerMessageV1 = ServerEnvelope & (
  | { readonly type: 'welcome'; readonly areaId: AreaId; readonly layerId: LayerId; readonly coordinateVersion: number; readonly selfPresenceId: PresenceId; readonly players: readonly PublicPresenceV1[]; readonly limits: ConnectionLimitsV1 }
  | { readonly type: 'joined'; readonly player: PublicPresenceV1 }
  | { readonly type: 'moved'; readonly presenceId: PresenceId; readonly generation: ConnectionGeneration; readonly sample: MovementSample; readonly acceptedAt: number }
  | { readonly type: 'chat'; readonly message: PublicChatMessageV1 }
  | { readonly type: 'left'; readonly presenceId: PresenceId; readonly generation: ConnectionGeneration; readonly reason: 'leave' | 'disconnect' | 'replaced' | 'expired' }
  | { readonly type: 'pong'; readonly sequence: number; readonly serverTime: number }
  | { readonly type: 'error'; readonly code: 'INVALID_MESSAGE' | 'UNSUPPORTED_VERSION' | 'UNAUTHENTICATED' | 'AREA_FULL' | 'DUPLICATE_PRESENCE' | 'UNAVAILABLE' | 'CHAT_UNAVAILABLE'; readonly retryable: boolean }
)

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
export function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
}
export function isBoundedText(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max
    && !Array.from(value).some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
}
export function isMovementSample(value: unknown): value is MovementSample {
  if (!isRecord(value) || !hasExactKeys(value, ['sequence', 'position', 'facing', 'movement'])) return false
  return validMovementFields(value)
}
function validMovementFields(value: Record<string, unknown>): boolean {
  return isSequence(value.sequence) && isPosition(value.position)
    && ['north', 'south', 'east', 'west'].includes(value.facing as string)
    && ['moving', 'stopped'].includes(value.movement as string)
}
export function isPublicPresenceV1(value: unknown): value is PublicPresenceV1 {
  return isRecord(value) && hasExactKeys(value, ['presenceId', 'publicId', 'generation', 'label', 'appearance', 'sequence', 'position', 'facing', 'movement'])
    && isCanonicalUuid(value.presenceId) && isCanonicalUuid(value.publicId) && isGeneration(value.generation) && isBoundedText(value.label, 20)
    && (value.appearance === 'placeholder' || isCharacterAppearance(value.appearance)) && validMovementFields(value)
}
export function isClientMessageV1(value: unknown): value is ClientMessageV1 {
  if (!isRecord(value) || value.v !== REALTIME_PROTOCOL_VERSION) return false
  switch (value.type) {
    case 'hello': return hasExactKeys(value, ['v', 'type', 'ticket']) && isBoundedText(value.ticket, 256)
    case 'move': return hasExactKeys(value, ['v', 'type', 'sequence', 'position', 'facing', 'movement']) && validMovementFields(value)
    case 'chat': return (['local', 'town', 'world'].includes(value.channel as string) && hasExactKeys(value, ['v', 'type', 'channel', 'text'])
      || value.channel === 'direct' && hasExactKeys(value, ['v', 'type', 'channel', 'recipientPublicId', 'text'])
        && isCanonicalUuid(value.recipientPublicId)) && isBoundedText(value.text, 500)
    case 'ping': return hasExactKeys(value, ['v', 'type', 'sequence']) && isSequence(value.sequence)
    case 'leave': return hasExactKeys(value, ['v', 'type'])
    default: return false
  }
}
function isLimits(value: unknown): value is ConnectionLimitsV1 {
  return isRecord(value) && hasExactKeys(value, ['maxClientFrameBytes', 'maxMovementUpdatesPerSecond', 'heartbeatIntervalMs', 'staleAfterMs'])
    && Object.values(value).every((item) => isSequence(item) && item > 0)
    && (value.maxClientFrameBytes as number) <= MAX_CLIENT_FRAME_BYTES
    && (value.staleAfterMs as number) > (value.heartbeatIntervalMs as number)
}
function isPublicChatMessage(value: unknown): value is PublicChatMessageV1 {
  if (!isRecord(value) || !['local', 'town', 'world', 'direct'].includes(value.channel as string)) return false
  const keys = value.channel !== 'direct'
    ? ['id', 'channel', 'senderPublicId', 'senderDisplayName', 'text', 'sentAt']
    : ['id', 'channel', 'senderPublicId', 'senderDisplayName', 'recipientPublicId', 'text', 'sentAt']
  return hasExactKeys(value, keys) && isCanonicalUuid(value.id) && isCanonicalUuid(value.senderPublicId)
    && (value.channel !== 'direct' || isCanonicalUuid(value.recipientPublicId))
    && isBoundedText(value.senderDisplayName, 20) && isBoundedText(value.text, 500)
    && isSequence(value.sentAt)
}
export function isServerMessageV1(value: unknown): value is ServerMessageV1 {
  if (!isRecord(value) || value.v !== 1 || !isSequence(value.eventSequence)) return false
  const keys = (fields: string[]) => hasExactKeys(value, ['v', 'type', 'eventSequence', ...fields])
  switch (value.type) {
    case 'welcome': {
      const area = getAreaDefinition(value.areaId)
      if (!keys(['areaId', 'layerId', 'coordinateVersion', 'selfPresenceId', 'players', 'limits'])
        || !area || value.coordinateVersion !== area.coordinateVersion || !isCanonicalUuid(value.layerId) || !isCanonicalUuid(value.selfPresenceId)
        || !Array.isArray(value.players) || value.players.length === 0 || value.players.length > area.layerCapacity
        || !value.players.every(isPublicPresenceV1) || !isLimits(value.limits)) return false
      return value.players.every((player) => isWithinArea(area, player.position))
        && new Set(value.players.map((player) => player.presenceId)).size === value.players.length
        && value.players.some((player) => player.presenceId === value.selfPresenceId)
    }
    case 'joined': return keys(['player']) && isPublicPresenceV1(value.player)
    case 'moved': return keys(['presenceId', 'generation', 'sample', 'acceptedAt']) && isCanonicalUuid(value.presenceId)
      && isGeneration(value.generation) && isMovementSample(value.sample) && isSequence(value.acceptedAt)
    case 'chat': return keys(['message']) && isPublicChatMessage(value.message)
    case 'left': return keys(['presenceId', 'generation', 'reason']) && isCanonicalUuid(value.presenceId) && isGeneration(value.generation)
      && ['leave', 'disconnect', 'replaced', 'expired'].includes(value.reason as string)
    case 'pong': return keys(['sequence', 'serverTime']) && isSequence(value.sequence) && isSequence(value.serverTime)
    case 'error': return keys(['code', 'retryable']) && typeof value.retryable === 'boolean'
      && ['INVALID_MESSAGE', 'UNSUPPORTED_VERSION', 'UNAUTHENTICATED', 'AREA_FULL', 'DUPLICATE_PRESENCE', 'UNAVAILABLE', 'CHAT_UNAVAILABLE'].includes(value.code as string)
    default: return false
  }
}

export type ProtocolParseResult<T> = { readonly ok: true; readonly message: T }
  | { readonly ok: false; readonly code: 'FRAME_TOO_LARGE' | 'MALFORMED_JSON' | 'UNSUPPORTED_VERSION' | 'INVALID_MESSAGE' }

function parseText<T>(text: string, maxBytes: number, validate: (value: unknown) => value is T): ProtocolParseResult<T> {
  if (!isSequence(maxBytes) || maxBytes === 0) throw new Error('Invalid frame limit.')
  if (text.length > maxBytes || new TextEncoder().encode(text).byteLength > maxBytes) return { ok: false, code: 'FRAME_TOO_LARGE' }
  let value: unknown
  try { value = JSON.parse(text) } catch { return { ok: false, code: 'MALFORMED_JSON' } }
  if (isRecord(value) && Object.hasOwn(value, 'v') && value.v !== 1) return { ok: false, code: 'UNSUPPORTED_VERSION' }
  return validate(value) ? { ok: true, message: value } : { ok: false, code: 'INVALID_MESSAGE' }
}
// Text only: the future transport must reject binary frames BEFORE calling these.
export function parseClientMessageText(text: string, maxBytes = MAX_CLIENT_FRAME_BYTES): ProtocolParseResult<ClientMessageV1> {
  return parseText(text, maxBytes, isClientMessageV1)
}
export function parseServerMessageText(text: string, maxBytes = MAX_SERVER_FRAME_BYTES): ProtocolParseResult<ServerMessageV1> {
  return parseText(text, maxBytes, isServerMessageV1)
}
