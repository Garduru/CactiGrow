import type {
  IdentityProvider,
  IdentityVerificationRequest,
  VerifiedExternalIdentity,
} from './IdentityProvider.ts'

export const CLOUDFLARE_ACCESS_JWT_HEADER = 'cf-access-jwt-assertion'

export interface VerifiedCloudflareAccessToken {
  subject: string
  issuedAt?: string
  expiresAt?: string
}

export interface CloudflareAccessTokenVerifier {
  verify(token: string): Promise<VerifiedCloudflareAccessToken | null>
}

/**
 * Identity boundary for a future Access-protected staging environment.
 * A forwarded identity header is never sufficient: only a configured verifier
 * may turn the Access JWT into a provider-neutral external identity.
 */
export class CloudflareAccessIdentityProvider implements IdentityProvider {
  private readonly verifier?: CloudflareAccessTokenVerifier

  constructor(verifier?: CloudflareAccessTokenVerifier) {
    this.verifier = verifier
  }

  async verify(request: IdentityVerificationRequest): Promise<VerifiedExternalIdentity | null> {
    const token = request.getHeader(CLOUDFLARE_ACCESS_JWT_HEADER)
    if (!this.verifier || !token || token.includes(',')) return null

    const verified = await this.verifier.verify(token)
    if (!verified?.subject) return null

    return {
      provider: 'cloudflare-access',
      subject: verified.subject,
      issuedAt: verified.issuedAt,
      expiresAt: verified.expiresAt,
    }
  }
}
