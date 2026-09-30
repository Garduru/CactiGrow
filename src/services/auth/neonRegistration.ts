type AuthResult = { data?: unknown; error?: unknown }
export interface RegistrationClient {
  signUp: { email(input: { name: string; email: string; password: string; callbackURL: string }): Promise<AuthResult> }
  signIn: { email(input: { email: string; password: string; rememberMe: boolean }): Promise<AuthResult> }
  emailOtp: {
    sendVerificationOtp(input: { email: string; type: 'email-verification' }): Promise<AuthResult>
    verifyEmail(input: { email: string; otp: string }): Promise<AuthResult>
  }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

export function requiresEmailVerification(error: unknown): boolean {
  return ['EMAIL_NOT_VERIFIED', 'email_not_confirmed'].includes(String(record(error).code))
}

export async function registerNeonPlayer(client: RegistrationClient, email: string, password: string, callbackURL: string) {
  const result = await client.signUp.email({ name: email.split('@')[0] || 'Grower', email, password, callbackURL })
  if (result.error) throw result.error
  const data = record(result.data)
  // A successful pending signup is not an authenticated session. Do not call
  // getSession here: code verification is required before the session exists.
  return record(data.user).emailVerified === true && typeof data.token === 'string' ? 'authenticated' : 'verify'
}

export async function resendNeonCode(client: RegistrationClient, email: string) {
  const result = await client.emailOtp.sendVerificationOtp({ email, type: 'email-verification' })
  if (result.error) throw result.error
}

export async function verifyNeonRegistration(client: RegistrationClient, email: string, otp: string, password: string) {
  const verified = await client.emailOtp.verifyEmail({ email, otp })
  if (verified.error) throw verified.error
  // Neon may not automatically sign in after verifying. Use the existing
  // password sign-in API; the password lives only in the current React form.
  if (!password) return { status: 'sign-in' as const }
  try {
    const signedIn = await client.signIn.email({ email, password, rememberMe: true })
    if (signedIn.error) throw signedIn.error
    return { status: 'authenticated' as const }
  } catch (error) {
    // Verification already consumed the code. Never ask the user to reuse it
    // just because the subsequent sign-in failed.
    return { status: 'sign-in' as const, error }
  }
}

const safeMessages: Record<string, string> = {
  EMAIL_NOT_VERIFIED: 'Verify your email with the code sent to your inbox.',
  email_not_confirmed: 'Verify your email with the code sent to your inbox.',
  INVALID_OTP: 'The verification code is incorrect. Check the code and try again.',
  OTP_EXPIRED: 'The verification code has expired. Request a new code.',
  otp_expired: 'The verification code is incorrect or expired. Request a new code.',
  TOO_MANY_ATTEMPTS: 'Too many code attempts. Request a new code and try again later.',
  over_request_rate_limit: 'Too many requests. Please wait before trying again.',
  over_email_send_rate_limit: 'Too many emails requested. Please wait before resending.',
  INVALID_EMAIL_OR_PASSWORD: 'The email or password is incorrect.',
  invalid_credentials: 'The email or password is incorrect.',
  USER_ALREADY_EXISTS: 'An account already exists for this email. Sign in or verify your email.',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'An account already exists for this email. Sign in or verify your email.',
  user_already_exists: 'An account already exists for this email. Sign in or verify your email.',
  PASSWORD_TOO_SHORT: 'The password is too short. Use at least 8 characters.',
  PASSWORD_TOO_LONG: 'The password is too long.',
  weak_password: 'Choose a stronger password.',
  email_address_invalid: 'Enter a valid email address.',
  SESSION_COOKIE_UNAVAILABLE: 'Your email is verified, but the browser did not retain the sign-in session. Allow cookies for the Neon Auth service and sign in again.',
}

/** Only safe public provider details; never stringify errors, bodies or credentials. */
export function authErrorMessage(error: unknown, development = false): string {
  const value = record(error)
  const code = typeof value.code === 'string' && /^[A-Za-z0-9_]{1,80}$/.test(value.code) ? value.code : ''
  const status = Number.isInteger(value.status) && Number(value.status) >= 400 && Number(value.status) <= 599 ? Number(value.status) : undefined
  let message = safeMessages[code] ?? (status === 429 ? 'Too many requests. Please wait and try again.' : 'Unable to complete authentication. Please try again.')
  // Development diagnostics retain a bounded public 4xx message only when it
  // contains no addresses, URLs, token-like strings or credential assignments.
  if (development && status && status < 500 && typeof value.message === 'string'
    && value.message.length <= 240 && !/[@<>\r\n]|https?:|[A-Za-z0-9_-]{32,}|(?:password|token|secret|cookie)\s*[:=]/i.test(value.message)) {
    message = value.message
  }
  return `${message}${code ? ` (${code})` : ''}${development && status ? ` [HTTP ${status}]` : ''}`
}
