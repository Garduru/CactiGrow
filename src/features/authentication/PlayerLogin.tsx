import { useState, type FormEvent } from 'react'
import { neonAuth, getPlayerCredentials } from '../../services/auth/neonAuthentication'
import { authErrorMessage, registerNeonPlayer, requiresEmailVerification, resendNeonCode, verifyNeonRegistration } from '../../services/auth/neonRegistration'
import './authentication.css'

type Mode = 'login' | 'register' | 'recover' | 'reset' | 'verify'

export function PlayerLogin() {
  const resetToken = new URLSearchParams(window.location.search).get('token')
  const [mode, setMode] = useState<Mode>(window.location.pathname === '/auth/reset-password' ? 'reset' : 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const titles = { login: 'Sign in to play', register: 'Create your account', recover: 'Recover your password', reset: 'Set a new password', verify: 'Verify your email' }

  async function enterGame() {
    if (!await getPlayerCredentials()) throw { code: 'SESSION_COOKIE_UNAVAILABLE' }
    setPassword('')
    setCode('')
    window.location.assign('/play')
  }

  async function resend() {
    if (!neonAuth || busy || !email.trim()) return
    setBusy(true)
    setMessage('')
    try {
      await resendNeonCode(neonAuth, email.trim())
      setCode('')
      setMessage('A new verification code was requested. Check your inbox and spam folder.')
    } catch (error) { setMessage(authErrorMessage(error, import.meta.env.DEV)) }
    finally { setBusy(false) }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!neonAuth || busy) return
    setBusy(true)
    setMessage('')
    const address = email.trim()
    try {
      if (mode === 'register') {
        const next = await registerNeonPlayer(neonAuth, address, password, new URL('/play', window.location.origin).href)
        if (next === 'authenticated') { await enterGame(); return }
        setMode('verify')
        setCode('')
        setMessage('Account created. Enter the verification code sent to your email.')
      } else if (mode === 'verify') {
        const next = await verifyNeonRegistration(neonAuth, address, code.trim(), password)
        setCode('')
        // Verification succeeded even when the following sign-in needs retrying.
        setMode('login')
        if (next.status === 'authenticated') { await enterGame(); return }
        setPassword('')
        setMessage('Email verified. ' + (next.error ? authErrorMessage(next.error, import.meta.env.DEV) : 'Sign in to play.'))
      } else if (mode === 'login') {
        const result = await neonAuth.signIn.email({ email: address, password, rememberMe: true })
        if (result.error) throw result.error
        await enterGame()
      } else {
        const result = mode === 'recover'
          ? await neonAuth.requestPasswordReset({ email: address, redirectTo: new URL('/auth/reset-password', window.location.origin).href })
          : await neonAuth.resetPassword({ newPassword: password, token: resetToken ?? '' })
        if (result.error) throw result.error
        setPassword('')
        if (mode === 'reset') window.location.replace('/play')
        else setMessage('If the account is eligible, check your email for the next step.')
      }
    } catch (error) {
      if (requiresEmailVerification(error)) {
        setMode('verify')
        setCode('')
      }
      setMessage(authErrorMessage(error, import.meta.env.DEV))
    } finally { setBusy(false) }
  }

  return <main className="deployment-access-state player-login">
    <a href="/">CactiGrow home</a>
    <h1>{titles[mode]}</h1>
    {!neonAuth ? <p role="alert">Player authentication is not configured.</p> : <>
      <form onSubmit={submit}>
        {mode !== 'reset' && <label>Email<input type="email" autoComplete="email" required value={email} onChange={event => { setEmail(event.target.value); if (mode === 'verify') { setCode(''); setPassword('') } }} disabled={busy} /></label>}
        {mode === 'verify' && <label>Verification code<input type="text" inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={event => setCode(event.target.value)} disabled={busy} /></label>}
        {['login', 'register', 'reset'].includes(mode) && <label>Password<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'login' ? undefined : 8} required value={password} onChange={event => setPassword(event.target.value)} disabled={busy} /></label>}
        <button className="cg-button cg-button--primary" disabled={busy || (mode === 'reset' && !resetToken)} type="submit">{busy ? 'Please wait...' : mode === 'login' ? 'Sign in' : mode === 'register' ? 'Register' : mode === 'reset' ? 'Save password' : mode === 'verify' ? 'Verify and play' : 'Send email'}</button>
      </form>
      {mode === 'verify' && <button className="cg-button" type="button" disabled={busy || !email.trim()} onClick={resend}>Resend verification code</button>}
      {mode === 'reset' ? <a href="/play">Back to sign in</a> : <>
        <button className="cg-button" type="button" disabled={busy} onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setPassword(''); setCode(''); setMessage('') }}>{mode === 'login' ? 'Create an account' : 'Back to sign in'}</button>
        {mode === 'login' && <>
          <button className="cg-button" type="button" disabled={busy} onClick={() => { setMode('recover'); setPassword(''); setMessage('') }}>Forgot password?</button>
          <button className="cg-button" type="button" disabled={busy} onClick={() => { setMode('verify'); setPassword(''); setMessage('') }}>Enter verification code</button>
        </>}
      </>}
      <p role="status">{message}</p>
    </>}
  </main>
}
