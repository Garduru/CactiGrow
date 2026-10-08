import { isPosition } from '../realtime/areas.ts'
import type { WorldPoint } from '../world/types.ts'

export interface MovementAuthorityV1 {
  v: 1; areaId: string; runtimeAreaId: string; worldRevision: number; revision: number
  position: WorldPoint; previousPosition: WorldPoint; acceptedAt: number; serverNow: number
  accepted: boolean; lastRejection: string | null; rejections: number; delta: number
}
export interface MovementCheckpointV1 {
  v: 1; expectedWorldRevision: number; runtimeAreaId: string; position: WorldPoint
}
export function isMovementCheckpointV1(value: unknown): value is MovementCheckpointV1 {
  const c = value as MovementCheckpointV1 | null
  return !!c && Object.keys(c).sort().join(',') === 'expectedWorldRevision,position,runtimeAreaId,v'
    && c.v === 1 && Number.isSafeInteger(c.expectedWorldRevision) && c.expectedWorldRevision >= 0
    && typeof c.runtimeAreaId === 'string' && c.runtimeAreaId.length <= 80 && isPosition(c.position)
}
export function isMovementAuthorityV1(value: unknown): value is MovementAuthorityV1 {
  const s = value as MovementAuthorityV1 | null
  return !!s && Object.keys(s).length === 13 && s.v === 1 && typeof s.areaId === 'string' && typeof s.runtimeAreaId === 'string'
    && [s.worldRevision, s.revision, s.acceptedAt, s.serverNow, s.rejections].every(n => Number.isSafeInteger(n) && n >= 0)
    && isPosition(s.position) && isPosition(s.previousPosition) && typeof s.accepted === 'boolean'
    && (s.lastRejection === null || typeof s.lastRejection === 'string') && Number.isFinite(s.delta) && s.delta >= 0
}
