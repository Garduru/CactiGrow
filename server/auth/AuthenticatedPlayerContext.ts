export interface AuthenticatedPlayerContext {
  playerId: string
  requestId: string
  /** Expiry supplied by the verified identity provider, never decoded from unverified input. */
  authorizationExpiresAt?: string
  externalIdentity: {
    provider: string
    subject: string
  }
}
