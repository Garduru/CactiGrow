import { and, eq } from 'drizzle-orm'
import type { VerifiedExternalIdentity } from '../../identity/IdentityProvider.ts'
import type { ResolvedPlayerIdentity } from '../../identity/PlayerIdentityResolver.ts'
import type { CactiGrowDatabase } from '../client/database.ts'
import { playerExternalIdentities, players } from '../schema/index.ts'
import type { PlayerIdentityRepository } from './PlayerIdentityRepository.ts'

const PROVIDER_SUBJECT_UNIQUE = 'player_external_identities_provider_subject_unique'

interface PostgreSqlErrorMetadata {
  code?: unknown
  constraint?: unknown
  cause?: unknown
}

function isProviderSubjectConflict(error: unknown): boolean {
  let current = error

  for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth += 1) {
    const metadata = current as PostgreSqlErrorMetadata
    if (metadata.code === '23505' && metadata.constraint === PROVIDER_SUBJECT_UNIQUE) {
      return true
    }
    current = metadata.cause
  }

  return false
}

export class PostgresPlayerIdentityRepository implements PlayerIdentityRepository {
  private readonly database: CactiGrowDatabase

  constructor(database: CactiGrowDatabase) {
    this.database = database
  }

  private async find(identity: VerifiedExternalIdentity): Promise<ResolvedPlayerIdentity | null> {
    const [mapping] = await this.database
      .select({ playerId: playerExternalIdentities.playerId })
      .from(playerExternalIdentities)
      .where(and(
        eq(playerExternalIdentities.provider, identity.provider),
        eq(playerExternalIdentities.subject, identity.subject),
      ))
      .limit(1)

    return mapping ?? null
  }

  async resolveOrCreate(
    identity: VerifiedExternalIdentity,
  ): Promise<ResolvedPlayerIdentity> {
    const existing = await this.find(identity)
    if (existing) return existing

    try {
      return await this.database.transaction(async (transaction) => {
        const [mapping] = await transaction
          .select({ playerId: playerExternalIdentities.playerId })
          .from(playerExternalIdentities)
          .where(and(
            eq(playerExternalIdentities.provider, identity.provider),
            eq(playerExternalIdentities.subject, identity.subject),
          ))
          .limit(1)

        if (mapping) return mapping

        const [player] = await transaction
          .insert(players)
          .values({})
          .returning({ playerId: players.id })

        if (!player) throw new Error('PostgreSQL did not return a newly created player ID.')

        const [created] = await transaction
          .insert(playerExternalIdentities)
          .values({
            playerId: player.playerId,
            provider: identity.provider,
            subject: identity.subject,
          })
          .returning({ playerId: playerExternalIdentities.playerId })

        if (!created) throw new Error('PostgreSQL did not return a new identity mapping.')
        return created
      })
    } catch (error) {
      if (!isProviderSubjectConflict(error)) throw error

      const winner = await this.find(identity)
      if (!winner) throw error
      return winner
    }
  }
}
