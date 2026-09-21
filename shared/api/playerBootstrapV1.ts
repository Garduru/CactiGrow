export const PLAYER_BOOTSTRAP_PROJECTION_VERSION = 1 as const

export interface PlayerBootstrapV1 {
  projectionVersion: typeof PLAYER_BOOTSTRAP_PROJECTION_VERSION
  player: {
    playerId: string
    createdAt: string
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isPlayerBootstrapV1(value: unknown): value is PlayerBootstrapV1 {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Record<string, unknown>
  if (Object.keys(candidate).length !== 2) return false
  if (candidate.projectionVersion !== PLAYER_BOOTSTRAP_PROJECTION_VERSION) return false
  if (!candidate.player || typeof candidate.player !== 'object') return false

  const player = candidate.player as Record<string, unknown>
  if (Object.keys(player).length !== 2) return false
  if (typeof player.playerId !== 'string' || !UUID_PATTERN.test(player.playerId)) return false
  if (typeof player.createdAt !== 'string') return false

  const createdAt = new Date(player.createdAt)
  return !Number.isNaN(createdAt.valueOf()) && createdAt.toISOString() === player.createdAt
}
