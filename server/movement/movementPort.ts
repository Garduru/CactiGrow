import { isMovementAuthorityV1, type MovementAuthorityV1, type MovementCheckpointV1 } from '../../shared/api/movementV1.ts'
import type { WorldLocation } from '../../shared/world/types.ts'
import { movementOwnerName } from './MovementOwner.ts'
import { ApiError } from '../api/errors.ts'
import type { WorkerEnv } from '../env.ts'

export interface MovementPort {
  read(playerId: string, location: WorldLocation): Promise<MovementAuthorityV1>
  checkpoint(playerId: string, command: MovementCheckpointV1): Promise<MovementAuthorityV1>
}
export function createMovementPort(env: WorkerEnv): MovementPort {
  async function call(playerId: string, command: unknown): Promise<MovementAuthorityV1> {
    if (!['staging', 'production', 'test'].includes(env.CACTIGROW_ENVIRONMENT) || !env.AREA_PRESENCE) throw ApiError.conflict('Movement authority is temporarily unavailable.')
    const stub = env.AREA_PRESENCE.get(env.AREA_PRESENCE.idFromName(movementOwnerName(playerId)))
    const response = await stub.fetch(new Request('https://movement.internal/movement', { method: 'POST', body: JSON.stringify({ playerId, command }) }))
    const result: unknown = response.ok ? await response.json() : null
    if (!isMovementAuthorityV1(result)) throw ApiError.conflict('Movement authority is temporarily unavailable.')
    return result
  }
  return { read: (playerId, location) => call(playerId, { type: 'seed', location }),
    checkpoint: (playerId, command) => call(playerId, { type: 'move', runtimeAreaId: command.runtimeAreaId, position: command.position, expectedWorldRevision: command.expectedWorldRevision }) }
}
