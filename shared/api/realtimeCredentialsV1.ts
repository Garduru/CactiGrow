import { isRealtimeAdmissionRequestV1, isRealtimeAdmissionResponseV1, type RealtimeAdmissionRequestV1, type RealtimeAdmissionResponseV1 } from './realtimeAdmissionV1.ts'
import { hasExactKeys, isRecord } from '../realtime/protocolV1.ts'

export const REALTIME_SUBPROTOCOL = 'cactigrow.v1'
export const TICKET_PROTOCOL_PREFIX = 'cactigrow.ticket.'
export const isRealtimeCredential = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)

/** L3 extension of the L1 admission contract. Credentials must stay private to this client. */
export interface RealtimeCredentialsRequestV1 extends RealtimeAdmissionRequestV1 { readonly reconnectToken?: string; readonly worldFoundation?: true }
export interface RealtimeCredentialsResponseV1 extends RealtimeAdmissionResponseV1 {
  readonly reconnectToken: string
  readonly authorizationExpiresAt: string
}
export function isRealtimeCredentialsRequestV1(value: unknown): value is RealtimeCredentialsRequestV1 {
  if (!isRecord(value)) return false
  const { reconnectToken, worldFoundation, ...base } = value
  return isRealtimeAdmissionRequestV1(base) && (!Object.hasOwn(value, 'reconnectToken') || isRealtimeCredential(reconnectToken))
    && (!Object.hasOwn(value, 'worldFoundation') || worldFoundation === true)
}
export function isRealtimeCredentialsResponseV1(value: unknown): value is RealtimeCredentialsResponseV1 {
  if (!isRecord(value) || !hasExactKeys(value, ['v', 'areaId', 'socketPath', 'ticket', 'expiresAt', 'reconnectToken', 'authorizationExpiresAt'])) return false
  const { reconnectToken, authorizationExpiresAt, ...base } = value
  if (!isRealtimeAdmissionResponseV1(base) || !isRealtimeCredential(base.ticket) || !isRealtimeCredential(reconnectToken)
    || typeof authorizationExpiresAt !== 'string') return false
  const expiry = new Date(authorizationExpiresAt)
  return Number.isFinite(expiry.valueOf()) && expiry.toISOString() === authorizationExpiresAt && expiry.valueOf() >= Date.parse(base.expiresAt)
}
/** Use with the same-origin socketPath and the browser WebSocket constructor. Never put tickets in URLs. */
export function realtimeSocketProtocols(ticket: string): string[] {
  if (!isRealtimeCredential(ticket)) throw new Error('Invalid realtime ticket.')
  return [REALTIME_SUBPROTOCOL, TICKET_PROTOCOL_PREFIX + ticket]
}
