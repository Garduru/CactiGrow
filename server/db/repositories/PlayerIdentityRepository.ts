import type { VerifiedExternalIdentity } from '../../identity/IdentityProvider.ts'
import type { ResolvedPlayerIdentity } from '../../identity/PlayerIdentityResolver.ts'

export interface PlayerIdentityRepository {
  resolveOrCreate(identity: VerifiedExternalIdentity): Promise<ResolvedPlayerIdentity>
}
