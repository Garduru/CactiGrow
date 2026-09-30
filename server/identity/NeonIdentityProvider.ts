import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'
import type { IdentityProvider, IdentityVerificationRequest, VerifiedExternalIdentity } from './IdentityProvider.ts'

export function isNeonAuthUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname.endsWith('.neon.tech')
      && url.hostname.includes('.neonauth.') && !url.username && !url.password
      && !url.port && !url.search && !url.hash && /^\/[^/]+\/auth$/.test(url.pathname)
  } catch { return false }
}

const keySets = new Map<string, JWTVerifyGetKey>()

/** Neon-managed JWT verification; no client identity or gameplay data is trusted. */
export class NeonIdentityProvider implements IdentityProvider {
  private readonly url: string
  private readonly keys: JWTVerifyGetKey

  constructor(url: string, keys?: JWTVerifyGetKey) {
    if (!isNeonAuthUrl(url)) throw new Error('Invalid Neon Auth configuration.')
    this.url = url
    if (!keys && !keySets.has(url)) {
      keySets.set(url, createRemoteJWKSet(new URL(`${url}/.well-known/jwks.json`), {
        timeoutDuration: 5000, cooldownDuration: 30000, cacheMaxAge: 600000,
      }))
    }
    this.keys = keys ?? keySets.get(url)!
  }

  async verify(request: IdentityVerificationRequest): Promise<VerifiedExternalIdentity | null> {
    const header = request.authorizationHeader
    if (!header || header.length > 16384) return null
    const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(header)
    if (!match) return null
    try {
      const origin = new URL(this.url).origin
      const { payload } = await jwtVerify(match[1], this.keys, {
        algorithms: ['EdDSA'], issuer: origin, audience: origin,
        requiredClaims: ['sub', 'iat', 'exp'], maxTokenAge: '15m',
      })
      if (!payload.sub || payload.sub.length > 256 || payload.role !== 'authenticated'
        || payload.banned === true || !Number.isSafeInteger(payload.exp)
        || !Number.isSafeInteger(payload.iat) || payload.iat! > Date.now() / 1000
        || payload.exp! <= payload.iat! || payload.exp! - payload.iat! > 900) return null
      return { provider: 'neon', subject: `${this.url}:${payload.sub}`,
        issuedAt: new Date(payload.iat! * 1000).toISOString(),
        expiresAt: new Date(payload.exp! * 1000).toISOString() }
    } catch {
      // Invalid credentials and key service failures both deny access, without logging tokens.
      return null
    }
  }
}
