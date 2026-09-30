import { useState, type FormEvent } from 'react'
import { neonAuth } from '../../services/auth/neonAuthentication'
import './authentication.css'

type Mode = 'login' | 'register' | 'recover' | 'reset' | 'verify'

export function PlayerLogin() {
  const resetToken = new URLSearchParams(window.location.search).get('token')
  const [mode, setMode] = useState<Mode>(window.location.pathname === '/auth/reset-password' ? 'reset' : 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const titles = { login: 'Sign in to play', register: 'Create your account', recover: 'Recover your password', reset: 'Set a new password', verify: 'Verify your email' }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!neonAuth || busy) return
    setBusy(true)
    setMessage('')
    try {
      const callbackURL = new URL('/play', window.location.origin).href
      const result = mode === 'register'
        ? await neonAuth.signUp.email({ name: email.split('@')[0] || 'Grower', email, password, callbackURL })
        : mode === 'recover'
          ? await neonAuth.requestPasswordReset({ email, redirectTo: new URL('/auth/reset-password', window.location.origin).href })
          : mode === 'reset'
            ? await neonAuth.resetPassword({ newPassword: password, token: resetToken ?? '' })
            : mode === 'verify'
              ? await neonAuth.sendVerificationEmail({ email, callbackURL })
              : await neonAuth.signIn.email({ email, password, callbackURL, rememberMe: true })
      if (result.error) throw new Error('Authentication failed')
      setPassword('')
      if (mode === 'login' || mode === 'register') {
        const session = await neonAuth.getSession()
        if (session.error) throw new Error('Session check failed')
        if (session.data?.user) { window.location.assign('/play'); return }
        setMode('verify')
        setMessage('Check your email to verify your account, then sign in.')
      } else if (mode === 'reset') {
        // Discard the recovery token and all cached player state.
        window.location.replace('/play')
      } else {
        setMessage('If the account is eligible, check your email for the next step.')
      }
    } catch {
      setMessage('Unable to complete authentication. Check your details and email verification, or try again later.')
    } finally { setBusy(false) }
  }

  return <main className="deployment-access-state player-login">
    <a href="/">CactiGrow home</a>
    <h1>{titles[mode]}</h1>
    {!neonAuth ? <p role="alert">Player authentication is not configured.</p> : <>
      <form onSubmit={submit}>
        {mode !== 'reset' && <label>Email<input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} disabled={busy} /></label>}
        {['login', 'register', 'reset'].includes(mode) && <label>Password<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'login' ? undefined : 8} required value={password} onChange={event => setPassword(event.target.value)} disabled={busy} /></label>}
        <button className="cg-button cg-button--primary" disabled={busy || (mode === 'reset' && !resetToken)} type="submit">{busy ? 'Please wait...' : mode === 'login' ? 'Sign in' : mode === 'register' ? 'Register' : mode === 'reset' ? 'Save password' : 'Send email'}</button>
      </form>
      {mode === 'reset' ? <a href="/play">Back to sign in</a> : <>
        <button className="cg-button" type="button" disabled={busy} onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setPassword(''); setMessage('') }}>{mode === 'login' ? 'Create an account' : 'Back to sign in'}</button>
        {mode === 'login' && <>
          <button className="cg-button" type="button" disabled={busy} onClick={() => { setMode('recover'); setPassword(''); setMessage('') }}>Forgot password?</button>
          <button className="cg-button" type="button" disabled={busy} onClick={() => { setMode('verify'); setPassword(''); setMessage('') }}>Resend verification email</button>
        </>}
      </>}
      <p role="status">{message}</p>
    </>}
  </main>
}
