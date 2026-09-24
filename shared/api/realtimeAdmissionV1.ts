import { getAreaDefinition, isEntryPoint } from '../realtime/areas.ts'
import type { AreaId } from '../realtime/identifiers.ts'
import { hasExactKeys, isBoundedText, isRecord } from '../realtime/protocolV1.ts'

export interface RealtimeAdmissionRequestV1 {
  readonly v: 1
  readonly areaId: AreaId
  readonly entryPointId: string
}
/** Success data inside the existing API envelope. No ticket issuance in L1. */
export interface RealtimeAdmissionResponseV1 {
  readonly v: 1
  readonly areaId: AreaId
  readonly socketPath: string
  readonly ticket: string
  readonly expiresAt: string
}
export function isRealtimeAdmissionRequestV1(value: unknown): value is RealtimeAdmissionRequestV1 {
  if (!isRecord(value) || !hasExactKeys(value, ['v', 'areaId', 'entryPointId']) || value.v !== 1) return false
  const area = getAreaDefinition(value.areaId)
  return !!area && isEntryPoint(area, value.entryPointId)
}
export function isRealtimeAdmissionResponseV1(value: unknown): value is RealtimeAdmissionResponseV1 {
  if (!isRecord(value) || !hasExactKeys(value, ['v', 'areaId', 'socketPath', 'ticket', 'expiresAt'])
    || value.v !== 1 || !getAreaDefinition(value.areaId) || !isBoundedText(value.ticket, 256)
    || value.socketPath !== `/api/v1/realtime/areas/${value.areaId}` || typeof value.expiresAt !== 'string') return false
  const expiry = new Date(value.expiresAt)
  return Number.isFinite(expiry.valueOf()) && expiry.toISOString() === value.expiresAt
}
