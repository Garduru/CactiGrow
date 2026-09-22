import {
  PLAYER_BOOTSTRAP_PROJECTION_VERSION,
  type PlayerBootstrapV1,
} from '../../shared/api/playerBootstrapV1.ts'
import type { PlayerBootstrapRepository } from './PlayerBootstrapRepository.ts'
import type { PlayerBootstrapV2 } from '../../shared/api/playerBootstrapV2.ts'

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

  async getGrowerForPlayer(playerId: string): Promise<PlayerBootstrapV2> {
    const identity = await this.getForPlayer(playerId)
    const grower = await this.repository.findGrowerByPlayerId?.(playerId)
    if (!grower) throw new Error('The initialized Grower record is unavailable.')
    return {
      projectionVersion: 2,
      player: identity.player,
      grower: {
        profileId: grower.profileId,
        initializedAt: grower.initializedAt.toISOString(),
        starterGrantedAt: grower.starterGrantedAt?.toISOString() ?? null,
        tutorialStartedAt: grower.tutorialStartedAt?.toISOString() ?? null,
        tutorialCompletedAt: grower.tutorialCompletedAt?.toISOString() ?? null,
        skills: { cultivationXp: grower.cultivationXp, breedingXp: grower.breedingXp, geneticsXp: grower.geneticsXp },
        tokenBalance: grower.tokenBalance,
        version: grower.version,
      },
    }
  }
}
