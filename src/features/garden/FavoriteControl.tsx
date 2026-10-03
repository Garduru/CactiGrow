import { useRef, useState } from 'react'

export function FavoriteControl({ favorite, listed, name, onChange }: { favorite: boolean; listed: boolean; name: string; onChange: (favorite: boolean) => boolean | void | Promise<boolean | void> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  return <div className="collection-favorite">
    <button type="button" className="collection-favorite__button" aria-pressed={favorite} aria-label={`${favorite ? 'Unfavorite' : 'Favorite'} ${name}`} disabled={busy || listed && !favorite} title={listed ? 'Cancel the Marketplace listing before favoriting this plant.' : 'Favorites protect plants from sale and transfer.'} onClick={async () => {
      if (pending.current) return
      pending.current = true; setBusy(true); setError('')
      try {
        if (await onChange(!favorite) === false) setError('Favorite could not be saved. Check the listing status and try again.')
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'Favorite could not be saved.') }
      finally { pending.current = false; setBusy(false) }
    }}>{favorite ? '★' : '☆'}<span>{busy ? 'Saving…' : 'Favorite'}</span></button>
    {listed && !favorite && <small>Cancel listing to favorite</small>}
    {error && <small role="alert">{error}</small>}
  </div>
}
