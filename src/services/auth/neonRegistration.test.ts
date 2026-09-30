import assert from 'node:assert/strict'
import test from 'node:test'
import { createAuthClient } from '@neondatabase/auth'
import { BetterAuthReactAdapter } from '@neondatabase/auth/react/adapters'
import { authErrorMessage, registerNeonPlayer, resendNeonCode, requiresEmailVerification, verifyNeonRegistration, type RegistrationClient } from './neonRegistration.ts'

const endpoint = 'https://ep-test.neonauth.c-4.us-west-2.aws.neon.tech/cactigrow/auth'

test('actual Neon SDK sends signup, code resend, verification and password sign-in to the correct APIs', async t => {
  const previous = globalThis.fetch
  const calls: string[] = []
  const email = 'player@example.invalid'
  const password = 'fixture-password'
  globalThis.fetch = async (input, init) => {
    const path = String(input).slice(endpoint.length)
    assert.ok(String(input).startsWith(`${endpoint}/`))
    assert.equal(init?.method, 'POST')
    assert.equal(init?.credentials, 'include')
    const body = JSON.parse(String(init?.body))
    assert.equal(body.email, email)
    calls.push(path)
    if (path === '/sign-up/email') {
      assert.equal(body.password, password)
      assert.equal(body.callbackURL, 'https://cactigrow.com/play')
      // Real successful pending-user response shape: no session yet.
      return Response.json({ token: null, user: { id: 'external', email, emailVerified: false } })
    }
    if (path === '/email-otp/send-verification-otp') {
      assert.equal(body.type, 'email-verification')
      return Response.json({ success: true })
    }
    if (path === '/email-otp/verify-email') {
      assert.equal(body.otp, '123456')
      return Response.json({ status: true, user: { id: 'external', emailVerified: true } })
    }
    assert.equal(path, '/sign-in/email')
    assert.equal(body.password, password)
    assert.equal(body.rememberMe, true)
    return Response.json({ token: 'fixture-session', user: { id: 'external', emailVerified: true } })
  }
  t.after(() => { globalThis.fetch = previous })
  const client = createAuthClient(endpoint, { adapter: BetterAuthReactAdapter({ fetchOptions: { credentials: 'include' } }) })
  assert.equal(await registerNeonPlayer(client, email, password, 'https://cactigrow.com/play'), 'verify')
  assert.deepEqual(calls, ['/sign-up/email']) // No premature getSession request.
  await resendNeonCode(client, email)
  assert.deepEqual(await verifyNeonRegistration(client, email, '123456', password), { status: 'authenticated' })
  assert.deepEqual(calls, ['/sign-up/email', '/email-otp/send-verification-otp', '/email-otp/verify-email', '/sign-in/email'])
})

function fixture(verifyError?: unknown, loginError?: unknown) {
  let signIns = 0
  const client: RegistrationClient = {
    signUp: { email: async () => ({ data: { token: null, user: { emailVerified: false } } }) },
    signIn: { email: async () => { signIns++; return { error: loginError } } },
    emailOtp: { sendVerificationOtp: async () => ({ data: { success: true } }), verifyEmail: async () => ({ error: verifyError }) },
  }
  return { client, signIns: () => signIns }
}

test('invalid or expired code is preserved as an error and never starts sign-in', async () => {
  for (const code of ['INVALID_OTP', 'OTP_EXPIRED', 'TOO_MANY_ATTEMPTS']) {
    const error = { code, status: 400 }
    const { client, signIns } = fixture(error)
    await assert.rejects(verifyNeonRegistration(client, 'player@example.invalid', '000000', 'password'), e => e === error)
    assert.equal(signIns(), 0)
    assert.ok(authErrorMessage(error).includes(code))
  }
})

test('successful verification without password, or followed by failed login, never reuses a consumed code', async () => {
  const empty = fixture()
  assert.deepEqual(await verifyNeonRegistration(empty.client, 'player@example.invalid', '123456', ''), { status: 'sign-in' })
  assert.equal(empty.signIns(), 0)
  const error = { code: 'invalid_credentials', status: 401 }
  const failed = fixture(undefined, error)
  assert.deepEqual(await verifyNeonRegistration(failed.client, 'player@example.invalid', '123456', 'password'), { status: 'sign-in', error })
})

test('signup errors are retained and raw/SDK email-verification errors select the code flow', async () => {
  const error = { code: 'USER_ALREADY_EXISTS', status: 422 }
  const { client } = fixture()
  client.signUp.email = async () => ({ error })
  await assert.rejects(registerNeonPlayer(client, 'player@example.invalid', 'password', 'https://cactigrow.com/play'), e => e === error)
  for (const code of ['EMAIL_NOT_VERIFIED', 'email_not_confirmed']) assert.equal(requiresEmailVerification({ code }), true)
  assert.equal(requiresEmailVerification({ code: 'INVALID_EMAIL_OR_PASSWORD' }), false)
})

test('safe diagnostics include code/status but never raw credentials or server response details', () => {
  assert.equal(authErrorMessage({ code: 'VALIDATION_ERROR', status: 400, message: '[body.email] Invalid email address' }, true),
    '[body.email] Invalid email address (VALIDATION_ERROR) [HTTP 400]')
  for (const message of ['password=private-value', 'token: secret', 'player@example.invalid', 'https://private.invalid/', '<script>']) {
    assert.ok(!authErrorMessage({ status: 400, message }, true).includes(message))
  }
  assert.ok(!authErrorMessage({ code: 'INTERNAL_ERROR', status: 500, message: 'private database details' }, true).includes('database'))
})
