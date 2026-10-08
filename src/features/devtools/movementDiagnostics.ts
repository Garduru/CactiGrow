import type { WorldMovementClient } from '../../game-world/WorldMovementClient.ts'
let current: WorldMovementClient | null = null
export const getMovementDiagnostics = () => current
export function setMovementDiagnostics(movement: WorldMovementClient) {
  current = movement
  return () => { if (current === movement) current = null }
}
