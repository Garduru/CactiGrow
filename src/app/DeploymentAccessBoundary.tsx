import type { ReactNode } from 'react'
import { getDeploymentMode } from '../config/deploymentMode'
import { usePlayerBootstrap } from './usePlayerBootstrap'
import { PlayerLogin } from '../features/authentication/PlayerLogin'
import { useSocialState } from '../features/social/useSocialState'
import { useState } from 'react'
import { useStartingExperience } from '../features/starting/StartingContext'
import { AppearanceSetup } from '../features/starting/AppearanceSetup'

export function DeploymentAccessBoundary({ children }: { children: ReactNode }) {
  const bootstrap = usePlayerBootstrap()
  const social = useSocialState()
  const tutorial = useStartingExperience()
  if (getDeploymentMode() === 'development' && bootstrap.status !== 'authenticated') return children

  if (bootstrap.status === 'loading') {
    return <main className="deployment-access-state" aria-live="polite"><h1>CactiGrow</h1><p>Establishing your secure session…</p></main>
  }
  if (bootstrap.status === 'unauthenticated') {
    if (getDeploymentMode() === 'production') return <PlayerLogin />
    return <main className="deployment-access-state"><h1>Access required</h1><p>Please authenticate through the protected CactiGrow access page.</p></main>
  }
  if (bootstrap.status === 'error') {
    return <main className="deployment-access-state" role="alert"><h1>CactiGrow unavailable</h1><p>{bootstrap.message}</p></main>
  }
  if (social.state.status === 'loading') return <main className="deployment-access-state" aria-live="polite"><h1>CactiGrow</h1><p>Loading your player profile…</p></main>
  if (social.state.status === 'error') return <main className="deployment-access-state" role="alert"><h1>Profile unavailable</h1><p>{social.state.message}</p><button type="button" onClick={social.refresh}>Retry</button></main>
  if (!social.state.overview.ownProfile) return <CharacterNameOnboarding />
  if (tutorial.active && !tutorial.state) return <main className="deployment-access-state" role="status"><p>{tutorial.error || 'Preparing your adventure…'}</p>{tutorial.error && <button onClick={() => { void tutorial.refresh() }}>Retry</button>}</main>
  if (tutorial.active && tutorial.state && !tutorial.state.appearanceComplete) return <AppearanceSetup />
  return children
}

function CharacterNameOnboarding() {
  const social = useSocialState()
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try { await social.mutate({ type: 'set-display-name', displayName }) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save that name.') }
    finally { setSaving(false) }
  }
  return <main className="deployment-access-state character-name-onboarding">
    <h1>Choose your character name</h1>
    <form onSubmit={(event) => { void submit(event) }}>
      <label htmlFor="character-name-onboarding">Character name</label>
      <input id="character-name-onboarding" autoComplete="nickname" minLength={3} maxLength={20} required value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
      <p>3–20 characters. Letters, numbers, spaces, underscores, and hyphens.</p>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Continue'}</button>
    </form>
  </main>
}
