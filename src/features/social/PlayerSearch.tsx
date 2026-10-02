import { useEffect, useRef, useState, type FormEvent } from 'react'
import { browserApiClient } from '../../services/api/browserApiClient'
import type { PublicPlayerProfileV1 } from '../../../shared/api/socialV1'
import { useSocialState } from './useSocialState'
import { ProfileLink } from './PlayerProfilePanel'

export function PlayerSearch() {
  const social = useSocialState()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<readonly PublicPlayerProfileV1[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<string | null>(null)
  const controller = useRef<AbortController | null>(null)
  const lastQuery = useRef('')
  useEffect(() => () => controller.current?.abort(), [])
  async function search(event?: FormEvent) {
    event?.preventDefault()
    controller.current?.abort()
    const request = new AbortController()
    controller.current = request
    const submitted = event ? query.trim() : lastQuery.current
    lastQuery.current = submitted
    setBusy(true); setError('')
    try {
      const response = await browserApiClient.searchPlayers(submitted, request.signal)
      if (!request.signal.aborted) setResults(response.results)
    } catch (reason) { if (!request.signal.aborted) setError(reason instanceof Error ? reason.message : 'Search unavailable.') }
    finally { if (!request.signal.aborted) setBusy(false) }
  }
  async function add(publicId: string) {
    setPending(publicId); setError('')
    try { await social.mutate({ type: 'add-friend', publicId }); await search() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to send request.') }
    finally { setPending(null) }
  }
  const overview = social.state.status === 'ready' ? social.state.overview : null
  return <section className="player-search" aria-labelledby="find-player-title">
    <h3 id="find-player-title">Find Player</h3>
    <form onSubmit={(event) => { void search(event) }}>
      <label className="sr-only" htmlFor="player-search-name">Search character name</label>
      <input id="player-search-name" placeholder="Search character name..." minLength={2} maxLength={20} required value={query} onChange={(event) => setQuery(event.target.value)} />
      <button type="submit" disabled={busy}>{busy ? 'Searching...' : 'Search'}</button>
    </form>
    {error && <p role="alert">{error}</p>}
    {results?.length === 0 && <p role="status">No players found.</p>}
    {results && <ul className="social-player-list">{results.map((result) => {
      const { profile, relationship } = result
      const has = (list: readonly { publicId: string }[] | undefined) => list?.some((item) => item.publicId === profile.publicId)
      const label = relationship.isSelf ? 'You' : has(overview?.blockedPlayers) || (!overview && relationship.blockedByMe) || relationship.blocksMe ? 'Blocked'
        : has(overview?.friends) ? 'Friends' : has(overview?.incomingRequests) ? 'Incoming request' : has(overview?.outgoingRequests) ? 'Pending'
          : !overview && relationship.areFriends ? 'Friends' : !overview && relationship.request ? 'Pending' : null
      return <li key={profile.publicId}><ProfileLink profile={profile} onOpen={social.openProfile} />
        <button type="button" disabled={!!label || pending !== null} onClick={() => { void add(profile.publicId) }}>{label ?? (pending === profile.publicId ? 'Sending...' : 'Add Friend')}</button></li>
    })}</ul>}
  </section>
}
