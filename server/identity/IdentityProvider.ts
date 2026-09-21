export interface IdentityVerificationRequest {
  authorizationHeader?: string
  cookieHeader?: string
  getHeader(name: string): string | null
}

export interface VerifiedExternalIdentity {
  provider: string
  subject: string
  sessionId?: string
  issuedAt?: string
  expiresAt?: string
}

export interface IdentityProvider {
  verify(request: IdentityVerificationRequest): Promise<VerifiedExternalIdentity | null>
}
