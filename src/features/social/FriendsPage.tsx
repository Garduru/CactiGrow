import { useState } from 'react'
import { EmptyState } from '../../components/ui/EmptyState'
import { LocationHeader } from '../../components/ui/LocationHeader'
import { useSocialState } from './useSocialState'
import { ProfileLink } from './PlayerProfilePanel'

type FriendCategory = 'friends' | 'requests' | 'blocked'

const categories: readonly { id: FriendCategory; label: string }[] = [
  { id: 'friends', label: 'Friends' },
  { id: 'requests', label: 'Requests' },
  { id: 'blocked', label: 'Blocked' },
]

export function FriendsPage() {
  const [category, setCategory] = useState<FriendCategory>('friends')
  const social = useSocialState()
  const [error, setError] = useState('')
  const overview = social.state.status === 'ready' ? social.state.overview : null

  async function act(command: Parameters<typeof social.mutate>[0]) {
    setError('')
    try { await social.mutate(command) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'That relationship could not be changed.') }
  }

  const friends = overview?.friends ?? []
  const incoming = overview?.incomingRequests ?? []
  const outgoing = overview?.outgoingRequests ?? []
  const blocked = overview?.blockedPlayers ?? []

  return <section className="social-page" aria-labelledby="friends-title">
    <LocationHeader
      eyebrow="Social"
      title="Friends"
      titleId="friends-title"
      subtitle="Manage friend requests, relationships, and blocked players."
    />
    <nav className="social-switcher" aria-label="Friend categories">
      {categories.map((item) => <button key={item.id} type="button" aria-current={category === item.id ? 'page' : undefined} className={category === item.id ? 'social-switcher__item social-switcher__item--active' : 'social-switcher__item'} onClick={() => setCategory(item.id)}>{item.label}</button>)}
    </nav>
    <section className="friends-list" aria-labelledby="friends-category-title">
      <h2 id="friends-category-title">{categories.find((item) => item.id === category)!.label}</h2>
      {social.state.status === 'loading' && <p role="status">Loading social relationships…</p>}
      {social.state.status === 'error' && <p role="alert">{social.state.message} <button type="button" onClick={social.refresh}>Retry</button></p>}
      {category === 'friends' && (friends.length ? <ul className="social-player-list">{friends.map((profile) => <li key={profile.publicId}><ProfileLink profile={profile} onOpen={social.openProfile} /><button type="button" onClick={() => { void act({ type: 'remove-friend', publicId: profile.publicId }) }}>Remove</button></li>)}</ul> : <EmptyState title="No friends yet">Open a Town player's profile to send a friend request.</EmptyState>)}
      {category === 'requests' && <>
        <h3>Incoming</h3>
        {incoming.length ? <ul className="social-player-list">{incoming.map((profile) => <li key={profile.publicId}><ProfileLink profile={profile} onOpen={social.openProfile} /><span><button type="button" onClick={() => { void act({ type: 'accept-friend', publicId: profile.publicId }) }}>Accept</button><button type="button" onClick={() => { void act({ type: 'decline-friend', publicId: profile.publicId }) }}>Decline</button></span></li>)}</ul> : <EmptyState compact title="No incoming requests">New requests will appear here.</EmptyState>}
        <h3>Outgoing</h3>
        {outgoing.length ? <ul className="social-player-list">{outgoing.map((profile) => <li key={profile.publicId}><ProfileLink profile={profile} onOpen={social.openProfile} /><span>Request sent</span></li>)}</ul> : <EmptyState compact title="No outgoing requests">Requests you send will appear here.</EmptyState>}
      </>}
      {category === 'blocked' && (blocked.length ? <ul className="social-player-list">{blocked.map((profile) => <li key={profile.publicId}><ProfileLink profile={profile} onOpen={social.openProfile} /><button type="button" onClick={() => { void act({ type: 'unblock-player', publicId: profile.publicId }) }}>Unblock</button></li>)}</ul> : <EmptyState title="No blocked players">Players you block will appear here.</EmptyState>)}
      {error && <p role="alert">{error}</p>}
    </section>
  </section>
}
