import { eq } from 'drizzle-orm'
import type { CactiGrowDatabase } from '../client/database.ts'
import { players } from '../schema/index.ts'
import type {
  PlayerBootstrapRecord,
  PlayerBootstrapRepository,
} from '../../player/PlayerBootstrapRepository.ts'

export class PostgresPlayerBootstrapRepository implements PlayerBootstrapRepository {
  private readonly database: CactiGrowDatabase

  constructor(database: CactiGrowDatabase) {
    this.database = database
  }

  async findByPlayerId(playerId: string): Promise<PlayerBootstrapRecord | null> {
    const [player] = await this.database
      .select({ playerId: players.id, createdAt: players.createdAt })
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1)

    return player ?? null
  }
}
