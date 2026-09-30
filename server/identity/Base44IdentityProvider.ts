import { createClient } from '@base44/sdk'
import type { IdentityProvider, IdentityVerificationRequest, VerifiedExternalIdentity } from './IdentityProvider.ts'

type UserClient = { auth: { me(): Promise<unknown> }; cleanup(): void }
type ClientFactory = (appId: string, token: string) => UserClient

export function isBase44AppId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value)
}

/** Remote verification through the supported user-mode SDK; never decode/trust JWT claims. */
export class Base44IdentityProvider implements IdentityProvider {
  private readonly appId: string
  private readonly createUserClient: ClientFactory

  constructor(appId: string, createUserClient: ClientFactory = (id, token) => createClient({
    appId: id, token, analytics: { enabled: false },
  })) {
    if (!isBase44AppId(appId)) throw new Error('Invalid Base44 application configuration.')
    this.appId = appId
    this.createUserClient = createUserClient
  }

  async verify(request: IdentityVerificationRequest): Promise<VerifiedExternalIdentity | null> {
    const header = request.authorizationHeader
    if (!header || header.length > 16384) return null
    const match = /^Bearer ([A-Za-z0-9._~+/-]+=*)$/i.exec(header)
    if (!match) return null
    let client: UserClient | undefined
    try {
      // One client per request prevents token or in-flight user reuse across players.
      client = this.createUserClient(this.appId, match[1])
      const user = await client.auth.me()
      if (!user || typeof user !== 'object') return null
      const value = user as Record<string, unknown>
      if (typeof value.id !== 'string' || !value.id || value.id.length > 256
        || value.app_id !== this.appId || value.is_service !== false
        || (value.disabled !== false && value.disabled !== null) || value.is_verified !== true) return null
      return { provider: 'base44', subject: `${this.appId}:${value.id}` }
    } catch {
      // Invalid/expired credentials and upstream failures both fail closed, without logging tokens.
      return null
    } finally {
      client?.cleanup()
    }
  }
}
