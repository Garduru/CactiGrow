import { createAuthClient } from '@neondatabase/auth'
import { BetterAuthReactAdapter } from '@neondatabase/auth/react/adapters'

const authUrl = import.meta.env.VITE_NEON_AUTH_URL
export const neonAuthenticationConfigured = import.meta.env.MODE === 'production'
  && typeof authUrl === 'string' && /^https:\/\/[^/]+\.neonauth\.[^/]+\.neon\.tech\/[^/]+\/auth$/.test(authUrl)

// Neon owns the HttpOnly session cookie. No credentials are stored in localStorage.
export const neonAuth = neonAuthenticationConfigured ? createAuthClient(authUrl, {
  adapter: BetterAuthReactAdapter({ fetchOptions: { credentials: 'include' } }),
}) : null

export async function getPlayerCredentials(): Promise<HeadersInit | undefined> {
  if (!neonAuth) return undefined
  // SDK 0.5.0-beta token() can return cached getSession data. Use Neon's official
  // JWT endpoint directly, keeping its session cookie HttpOnly and provider-managed.
  const response = await fetch(`${authUrl}/token`, {
    credentials: 'include', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000),
  })
  if (response.status === 401) return undefined
  if (!response.ok) throw new Error('Unable to verify your authentication session. Please reload to retry.')
  const result: unknown = await response.json()
  const token = result && typeof result === 'object' && 'token' in result ? result.token : null
  if (typeof token !== 'string' || token.length > 16377 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) {
    throw new Error('Authentication did not provide a valid API credential. Please sign in again.')
  }
  return { Authorization: `Bearer ${token}` }
}
