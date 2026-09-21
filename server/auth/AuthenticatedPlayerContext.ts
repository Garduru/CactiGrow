export interface AuthenticatedPlayerContext {
  playerId: string
  requestId: string
  externalIdentity: {
    provider: string
    subject: string
  }
}
