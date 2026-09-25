import { isRealtimeCredential } from '../../shared/api/realtimeCredentialsV1.ts'
import { isMembershipKey, isTrustedAdmission, type TrustedAdmission } from './runtimeContracts.ts'
import type { MembershipKey } from './presenceState.ts'
import { getAreaDefinition } from '../../shared/realtime/areas.ts'
import { hasExactKeys, isRecord } from '../../shared/realtime/protocolV1.ts'
import { isSequence } from '../../shared/realtime/identifiers.ts'

export const TICKET_TTL_MS = 30_000
export const CONNECTION_TTL_MS = 15 * 60_000
export const TICKETS_KEY = 'area-tickets-v1'
// Storage admission bounds, independent of a configured Area's player capacity.
export const MAX_CREDENTIAL_RECORDS = 128
export interface PendingTicket { hash: string; scope: TrustedAdmission; expiresAt: number; reconnectHash: string }
export interface ReconnectGrant { hash: string; owner: MembershipKey; expiresAt: number }
export interface TicketState { v: 1; pending: PendingTicket[]; reconnect: ReconnectGrant[] }
export function isTicketState(value: unknown): value is TicketState {
  if (!isRecord(value) || !hasExactKeys(value, ['v', 'pending', 'reconnect']) || value.v !== 1
    || !Array.isArray(value.pending) || !Array.isArray(value.reconnect) || value.pending.length > MAX_CREDENTIAL_RECORDS || value.reconnect.length > MAX_CREDENTIAL_RECORDS) return false
  if (!value.pending.every((ticket) => {
    if (!isRecord(ticket) || !hasExactKeys(ticket, ['hash', 'scope', 'expiresAt', 'reconnectHash']) || !isRecord(ticket.scope)) return false
    const area = getAreaDefinition(ticket.scope.areaId)
    return !!area && isTrustedAdmission(ticket.scope, area, 0) && isRealtimeCredential(ticket.hash) && isRealtimeCredential(ticket.reconnectHash)
      && isSequence(ticket.expiresAt) && ticket.expiresAt <= ticket.scope.authorizationExpiresAt
  }) || !value.reconnect.every((grant) => isRecord(grant) && hasExactKeys(grant, ['hash', 'owner', 'expiresAt'])
    && isRealtimeCredential(grant.hash) && isMembershipKey(grant.owner) && isSequence(grant.expiresAt))) return false
  return new Set(value.pending.map((ticket) => ticket.scope.playerId)).size === value.pending.length
    && new Set(value.reconnect.map((grant) => grant.owner.playerId)).size === value.reconnect.length
}
export function newCredential(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
export async function credentialHash(value: string): Promise<string> {
  if (!isRealtimeCredential(value)) throw new Error('Invalid credential shape.')
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
export function pruneTickets(state: TicketState, now: number): TicketState {
  return { v: 1, pending: state.pending.filter((ticket) => ticket.expiresAt > now), reconnect: state.reconnect.filter((grant) => grant.expiresAt > now) }
}
