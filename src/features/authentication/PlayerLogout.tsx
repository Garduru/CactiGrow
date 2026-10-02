import { useState } from 'react'
import { neonAuth } from '../../services/auth/neonAuthentication'

export function PlayerLogout({ onCancel }: { onCancel(): void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  if (!neonAuth) return <p>Sign out is unavailable in local preview.</p>
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
  return <section aria-label="Sign out confirmation">
    <p>Sign out of CactiGrow?</p>
    <button type="button" onClick={onCancel} disabled={busy}>Cancel</button>
    <button type="button" disabled={busy} onClick={logout}>{busy ? 'Signing out...' : 'Sign Out'}</button>
    {error && <p role="alert">Unable to sign out. Please try again.</p>}
  </section>
}
