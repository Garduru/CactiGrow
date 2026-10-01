import { useEffect, useRef, useState } from 'react'
import { browserApiClient } from '../../services/api/browserApiClient'
import type { PublicPlayerProfileV1, PublicPlayerSummaryV1, SocialCommandV1 } from '../../../shared/api/socialV1'
import { useSocialState } from './useSocialState'

export function PlayerProfilePanel({ publicId, onClose }: { publicId: string | null; onClose(): void }) {
  const social = useSocialState()
  const [loadedProfile, setLoadedProfile] = useState<{ publicId: string; profile?: PublicPlayerProfileV1; error?: string } | null>(null)
  const [nameDraft, setNameDraft] = useState<{ publicId: string | null; value: string } | null>(null)
  const [actionError, setActionError] = useState('')
  const [saving, setSaving] = useState(false)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const ownProfile = publicId === null && social.state.status === 'ready' ? social.state.overview.ownProfile : null
  const loadedForTarget = publicId !== null && loadedProfile?.publicId === publicId ? loadedProfile : null
  const isOwnProfile = publicId === null
  const loading = isOwnProfile ? social.state.status === 'loading' : loadedForTarget === null
  const profile = loadedForTarget?.profile ?? null
  const summary = isOwnProfile ? ownProfile : profile?.profile
  const displayName = nameDraft?.publicId === publicId ? nameDraft.value : summary?.displayName ?? ''
  const error = actionError || loadedForTarget?.error || (isOwnProfile && social.state.status === 'error' ? social.state.message : '')

  useEffect(() => {
    if (!publicId) return
    const controller = new AbortController()
    void browserApiClient.getPublicPlayerProfile(publicId, controller.signal).then((result) => {
      setLoadedProfile({ publicId, profile: result })
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) setLoadedProfile({ publicId, error: reason instanceof Error ? reason.message : 'Player profile is unavailable.' })
    })
    return () => controller.abort()
  }, [publicId])

  useEffect(() => { closeButtonRef.current?.focus() }, [])

  async function act(command: SocialCommandV1) {
    setActionError('')
    try {
      await social.mutate(command)
      if (publicId) setLoadedProfile({ publicId, profile: await browserApiClient.getPublicPlayerProfile(publicId) })
    } catch (reason) { setActionError(reason instanceof Error ? reason.message : 'That action could not be completed.') }
  }

  async function saveName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    await act({ type: 'set-display-name', displayName })
    setSaving(false)
  }

  return <section className="player-profile" aria-labelledby="player-profile-title">
    <header className="player-profile__header">
      <div><span className="player-profile__eyebrow">Player profile</span><h2 id="player-profile-title">{summary?.displayName ?? (loading ? 'Loading profile' : 'Profile unavailable')}</h2></div>
      <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Close player profile">Close</button>
    </header>
    {loading && <p role="status">Loading player profile…</p>}
    {!loading && summary && <>
      <dl className="player-profile__stats">
        {summary.cultivationLevel !== undefined && <div><dt>Cultivation</dt><dd>Level {summary.cultivationLevel}</dd></div>}
        {summary.cultivationXp !== undefined && <div><dt>Experience</dt><dd>{summary.cultivationXp.toLocaleString()} XP</dd></div>}
        <div><dt>Collection</dt><dd>{summary.collectionCount.toLocaleString()} specimens</dd></div>
        <div><dt>Seeds bred</dt><dd>{summary.breedingCount.toLocaleString()}</dd></div>
        <div><dt>Member since</dt><dd><time dateTime={summary.joinedAt}>{new Date(summary.joinedAt).toLocaleDateString()}</time></dd></div>
      </dl>
      {isOwnProfile ? <form className="player-profile__rename" onSubmit={(event) => { void saveName(event) }}>
        <label htmlFor="player-profile-name">Character name</label>
        <div><input id="player-profile-name" minLength={3} maxLength={20} required value={displayName} onChange={(event) => setNameDraft({ publicId: null, value: event.target.value })} /><button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Change name'}</button></div>
      </form> : profile && <ProfileActions profile={profile} act={act} />}
    </>}
    {error && <p className="player-profile__error" role="alert">{error}</p>}
  </section>
}

function ProfileActions({ profile, act }: { profile: PublicPlayerProfileV1; act(command: SocialCommandV1): Promise<void> }) {
  const { relationship } = profile
  const publicId = profile.profile.publicId
  return <div className="player-profile__actions">
    {relationship.blockedByMe ? <button type="button" onClick={() => { void act({ type: 'unblock-player', publicId }) }}>Unblock player</button>
      : <>
        {relationship.areFriends ? <button type="button" onClick={() => { void act({ type: 'remove-friend', publicId }) }}>Remove friend</button>
          : relationship.request === 'incoming' ? <><button type="button" onClick={() => { void act({ type: 'accept-friend', publicId }) }}>Accept request</button><button type="button" onClick={() => { void act({ type: 'decline-friend', publicId }) }}>Decline</button></>
            : relationship.request === 'outgoing' ? <button type="button" disabled>Request sent</button>
              : relationship.blocksMe ? <button type="button" disabled>Unavailable</button>
                : <button type="button" onClick={() => { void act({ type: 'add-friend', publicId }) }}>Add friend</button>}
        <button type="button" onClick={() => { void act({ type: 'block-player', publicId }) }}>Block player</button>
      </>}
  </div>
}

export function ProfileLink({ profile, onOpen }: { profile: PublicPlayerSummaryV1; onOpen(publicId: string): void }) {
  return <button type="button" className="social-player-link" onClick={() => onOpen(profile.publicId)}>{profile.displayName}</button>
}