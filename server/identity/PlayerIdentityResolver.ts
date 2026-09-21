import type { VerifiedExternalIdentity } from './IdentityProvider.ts'

export interface ResolvedPlayerIdentity {
  playerId: string
}

export interface PlayerIdentityResolver {
  resolve(identity: VerifiedExternalIdentity): Promise<ResolvedPlayerIdentity | null>
}
