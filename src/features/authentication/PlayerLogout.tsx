import { useState } from 'react'
import { neonAuth } from '../../services/auth/neonAuthentication'

export function PlayerLogout() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  if (!neonAuth) return null
  async function logout() {
    if (!neonAuth || busy) return
    setBusy(true)
    setError(false)
    try {
      const result = await neonAuth.signOut()
      if (result.error) throw new Error('Sign out failed')
      // A full navigation closes presence and clears all in-memory gameplay projections.
      window.location.replace('/')
    } catch { setError(true); setBusy(false) }
  }
  return <>
    <button className="utility-menu__standalone" type="button" disabled={busy} onClick={logout}>{busy ? 'Signing out...' : 'Sign out'}</button>
    {error && <p role="alert">Unable to sign out. Please try again.</p>}
  </>
}
