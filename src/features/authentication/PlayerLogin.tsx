import { useState, type FormEvent } from 'react'
import { base44AuthenticationConfigured, loginPlayer, registerPlayer, verifyPlayerEmail } from '../../services/auth/base44Authentication'
import './authentication.css'

export function PlayerLogin() {
  const [mode, setMode] = useState<'login' | 'register' | 'verify'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setMessage('')
    try {
      if (mode === 'register') {
        await registerPlayer(email, password)
        setPassword('')
        setMode('verify')
        setMessage('Check your email for a verification code.')
      } else if (mode === 'verify') {
        await verifyPlayerEmail(email, code)
        setCode('')
        setMode('login')
        setMessage('Email verified. Sign in to play.')
      } else {
        await loginPlayer(email, password)
        // Full navigation discards all prior player projections and reruns server bootstrap.
        window.location.assign('/play')
      }
    } catch {
      setMessage('Unable to complete authentication. Check your details and email verification, or try again later.')
    } finally { setBusy(false) }
  }

  return <main className="deployment-access-state player-login">
    <a href="/">CactiGrow home</a>
    <h1>{mode === 'register' ? 'Create your account' : mode === 'verify' ? 'Verify your email' : 'Sign in to play'}</h1>
    {!base44AuthenticationConfigured ? <p role="alert">Player authentication is not configured yet.</p> : <>
      <form onSubmit={submit}>
        <label>Email<input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} disabled={busy} /></label>
        {mode === 'verify'
          ? <label>Verification code<input autoComplete="one-time-code" required value={code} onChange={event => setCode(event.target.value)} disabled={busy} /></label>
          : <label>Password<input type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} required value={password} onChange={event => setPassword(event.target.value)} disabled={busy} /></label>}
        <button className="cg-button cg-button--primary" disabled={busy} type="submit">{busy ? 'Please wait…' : mode === 'register' ? 'Register' : mode === 'verify' ? 'Verify email' : 'Sign in'}</button>
      </form>
      <button className="cg-button" type="button" disabled={busy} onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setPassword(''); setMessage('') }}>{mode === 'login' ? 'Create an account' : 'Back to sign in'}</button>
      {mode === 'login' && <button className="cg-button" type="button" disabled={busy} onClick={() => { setMode('verify'); setPassword(''); setMessage('') }}>Enter verification code</button>}
      <p role="status">{message}</p>
    </>}
  </main>
}
