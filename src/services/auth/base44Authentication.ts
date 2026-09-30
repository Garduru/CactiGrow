import { createClient } from '@base44/sdk'

// All provider-specific browser token handling stays behind this adapter.
const appId = import.meta.env?.VITE_CACTIGROW_BASE44_APP_ID
const tokenKey = `cactigrow.base44.${appId}.token`
export const base44AuthenticationConfigured = import.meta.env.MODE === 'production'
  && typeof appId === 'string' && /^[a-f0-9]{24}$/i.test(appId)

export function getPlayerCredentials(): HeadersInit | undefined {
  if (!base44AuthenticationConfigured) return undefined
  try {
    const token = window.localStorage.getItem(tokenKey)
    return token && token.length <= 16377 && /^[A-Za-z0-9._~+/-]+=*$/.test(token)
      ? { Authorization: `Bearer ${token}` } : undefined
  } catch { return undefined }
}

function client() {
  if (!base44AuthenticationConfigured) throw new Error('Authentication is not configured.')
  const headers = new Headers(getPlayerCredentials())
  // Explicit token prevents SDK auto-import of unsolicited URL tokens (login CSRF).
  return createClient({ appId, token: headers.get('Authorization')?.slice(7) ?? 'unauthenticated',
    analytics: { enabled: false } })
}

export async function loginPlayer(email: string, password: string) {
  const sdk = client()
  try {
    const result = await sdk.auth.loginViaEmailPassword(email, password)
    if (typeof result.access_token !== 'string' || !result.access_token) throw new Error('Missing login credential.')
    window.localStorage.setItem(tokenKey, result.access_token)
  }
  finally { sdk.cleanup() }
}

export async function registerPlayer(email: string, password: string) {
  const sdk = client()
  try { await sdk.auth.register({ email, password }) }
  finally { sdk.cleanup() }
}

export async function verifyPlayerEmail(email: string, otpCode: string) {
  const sdk = client()
  try { await sdk.auth.verifyOtp({ email, otpCode }) }
  finally { sdk.cleanup() }
}
