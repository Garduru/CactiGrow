import type { CloudflareAccessTokenVerifier, VerifiedCloudflareAccessToken } from './CloudflareAccessIdentityProvider.ts'

interface AccessJwtHeader { alg?: unknown; kid?: unknown }
interface AccessJwtClaims {
  type?: unknown
  iss?: unknown
  aud?: unknown
  sub?: unknown
  email?: unknown
  exp?: unknown
  nbf?: unknown
  iat?: unknown
}
interface AccessJwk extends JsonWebKey { kid?: string; alg?: string; use?: string }

function decodeJsonPart(part: string): unknown {
  if (!/^[A-Za-z0-9_-]+$/.test(part)) throw new Error('Invalid JWT encoding.')
  const base64 = part.replace(/-/g, '+').replace(/_/g, '/')
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown
}

function decodeSignature(part: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(part)) throw new Error('Invalid JWT signature encoding.')
  const base64 = part.replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
}

/** Verifies Cloudflare Access application JWTs before they cross the identity boundary. */
export class CloudflareAccessJwtVerifier implements CloudflareAccessTokenVerifier {
  private readonly issuer: string
  private readonly audience: string
  private readonly fetchKeys: typeof fetch

  constructor(teamDomain: string, audience: string, fetchKeys: typeof fetch = fetch) {
    const url = new URL(teamDomain)
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.cloudflareaccess.com') || url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
      throw new Error('Invalid Cloudflare Access team domain configuration.')
    }
    if (!/^[a-f0-9]{64}$/i.test(audience)) throw new Error('Invalid Cloudflare Access audience configuration.')
    this.issuer = url.origin
    this.audience = audience
    this.fetchKeys = fetchKeys
  }

  async verify(token: string): Promise<VerifiedCloudflareAccessToken | null> {
    try {
      if (token.length > 16_384) return null
      const parts = token.split('.')
      if (parts.length !== 3) return null
      const [encodedHeader, encodedClaims, encodedSignature] = parts
      const header = decodeJsonPart(encodedHeader) as AccessJwtHeader
      const claims = decodeJsonPart(encodedClaims) as AccessJwtClaims
      if (header?.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid) return null
      if (claims?.type !== 'app' || claims.iss !== this.issuer || typeof claims.sub !== 'string' || !claims.sub || typeof claims.email !== 'string' || !claims.email) return null
      if (!(claims.aud === this.audience || (Array.isArray(claims.aud) && claims.aud.includes(this.audience)))) return null
      const now = Math.floor(Date.now() / 1000)
      if (typeof claims.exp !== 'number' || !Number.isSafeInteger(claims.exp) || claims.exp <= now) return null
      if (claims.nbf !== undefined && (typeof claims.nbf !== 'number' || !Number.isSafeInteger(claims.nbf) || claims.nbf > now)) return null
      if (claims.iat !== undefined && (typeof claims.iat !== 'number' || !Number.isSafeInteger(claims.iat) || claims.iat > now)) return null

      const response = await this.fetchKeys.call(globalThis, `${this.issuer}/cdn-cgi/access/certs`)
      if (!response.ok) return null
      const document = await response.json() as { keys?: AccessJwk[] }
      const jwk = document?.keys?.find((key) => key.kid === header.kid && key.kty === 'RSA' && (key.alg === undefined || key.alg === 'RS256') && (key.use === undefined || key.use === 'sig'))
      if (!jwk) return null
      const publicKey = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
      const signedBytes = new TextEncoder().encode(`${encodedHeader}.${encodedClaims}`)
      const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, decodeSignature(encodedSignature), signedBytes)
      if (!valid) return null
      return {
        subject: claims.sub,
        issuedAt: typeof claims.iat === 'number' ? new Date(claims.iat * 1000).toISOString() : undefined,
        expiresAt: new Date(claims.exp * 1000).toISOString(),
      }
    } catch {
      return null
    }
  }
}
