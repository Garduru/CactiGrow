import type { PlayerIdentityRepository } from '../db/repositories/PlayerIdentityRepository.ts'
import type { VerifiedExternalIdentity } from './IdentityProvider.ts'
import type { PlayerIdentityResolver, ResolvedPlayerIdentity } from './PlayerIdentityResolver.ts'

export class PostgresPlayerIdentityResolver implements PlayerIdentityResolver {
  private readonly repository: PlayerIdentityRepository

  constructor(repository: PlayerIdentityRepository) {
    this.repository = repository
  }

  resolve(identity: VerifiedExternalIdentity): Promise<ResolvedPlayerIdentity> {
    return this.repository.resolveOrCreate(identity)
  }
}
