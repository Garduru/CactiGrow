import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { browserApiClient } from '../../services/api/browserApiClient'
import type { PublicPlayerSummaryV1 } from '../../../shared/api/socialV1'

export function RecipientSearch({ onSelect }: { onSelect(profile: PublicPlayerSummaryV1): void }) {
  const id = useId()
  const [query, setQuery] = useState(''), [error, setError] = useState('')
  const [results, setResults] = useState<PublicPlayerSummaryV1[]>([]), [busy, setBusy] = useState(false)
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])
  async function search(event: FormEvent) {
    event.preventDefault(); request.current?.abort()
    const controller = new AbortController(); request.current = controller
    setBusy(true); setError('')
    try {
      const found = await browserApiClient.searchPlayers(query.trim(), controller.signal)
      if (!controller.signal.aborted) {
        const allowed = found.results.filter(r => !r.relationship.isSelf && !r.relationship.blocksMe && !r.relationship.blockedByMe).map(r => r.profile)
        setResults(allowed); if (!allowed.length) setError('No available players found.')
      }
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Search unavailable.') }
    finally { if (!controller.signal.aborted) setBusy(false) }
  }
  return <div className="recipient-search">
    <form onSubmit={event => { void search(event) }}><label className="sr-only" htmlFor={id}>Find recipient by character name</label>
      <input id={id} minLength={2} maxLength={20} required placeholder="Character name" value={query} onChange={e => setQuery(e.target.value)} />
      <button disabled={busy} type="submit">{busy ? 'Searching…' : 'Find'}</button></form>
    {error && <p role="status">{error}</p>}
    <div className="recipient-search__results">{results.map(p => <button type="button" key={p.publicId} onClick={() => { onSelect(p); setResults([]) }}>{p.displayName}</button>)}</div>
  </div>
}
