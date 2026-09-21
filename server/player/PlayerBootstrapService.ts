import {
  PLAYER_BOOTSTRAP_PROJECTION_VERSION,
  type PlayerBootstrapV1,
} from '../../shared/api/playerBootstrapV1.ts'
import type { PlayerBootstrapRepository } from './PlayerBootstrapRepository.ts'

export class PlayerBootstrapService {
  private readonly repository: PlayerBootstrapRepository

  constructor(repository: PlayerBootstrapRepository) {
    this.repository = repository
  }

  async getForPlayer(playerId: string): Promise<PlayerBootstrapV1> {
    const player = await this.repository.findByPlayerId(playerId)
    if (!player) throw new Error('The authenticated player record is unavailable.')

    return {
      projectionVersion: PLAYER_BOOTSTRAP_PROJECTION_VERSION,
      player: {
        playerId: player.playerId,
        createdAt: player.createdAt.toISOString(),
      },
    }
  }
}
