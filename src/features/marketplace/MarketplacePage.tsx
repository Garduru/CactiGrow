import { useCallback, useEffect, useRef, useState } from 'react'
import type { MarketplaceV1 } from '../../../shared/api/commerceV1'
import { browserApiClient } from '../../services/api/browserApiClient'
import { getSpeciesById } from '../../data/species'
import { PlantVisual } from '../../components/ui/PlantVisual'
import { GeneticKnowledgeView } from '../research/GeneticKnowledgeView'
import { OwnedSpecimenCommerce } from './OwnedSpecimenCommerce'
import { useCommerceActions } from './useCommerceActions'
import { GARDEN_AUTHORITY_CHANGED_EVENT, PLANT_AUTHORITY_CHANGED_EVENT } from '../../app/authorityEvents'

function refreshInventory() {
  window.dispatchEvent(new Event(PLANT_AUTHORITY_CHANGED_EVENT))
  window.dispatchEvent(new Event(GARDEN_AUTHORITY_CHANGED_EVENT))
}

export function MarketplacePage() {
  const [tab, setTab] = useState<'browse' | 'own' | 'sell'>('browse')
  const [market, setMarket] = useState<MarketplaceV1 | null>(null)
  const [error, setError] = useState('')
  const [offset, setOffset] = useState(0)
  const [inspect, setInspect] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)
  const [species, setSpecies] = useState('all')
  const [sort, setSort] = useState('newest')
  const generation = useRef(0)
  const action = useCommerceActions()
  const { refreshBalance } = action
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const current = ++generation.current
    await browserApiClient.getMarketplace(tab === 'own', offset, signal).then((next) => {
      if (!signal?.aborted && current === generation.current) { setMarket(next); setError('') }
    }, (e: unknown) => { if (!signal?.aborted && current === generation.current) setError(e instanceof Error ? e.message : 'Unable to load listings.') })
  }, [tab, offset])
  useEffect(() => { const abort = new AbortController(); void refresh(abort.signal); void refreshBalance(); return () => abort.abort() }, [refresh, refreshBalance])
  useEffect(() => { refreshInventory() }, [])
  useEffect(() => {
    const focus = () => { void refresh(); void refreshBalance(); refreshInventory() }
    window.addEventListener('focus', focus)
    return () => window.removeEventListener('focus', focus)
  }, [refresh, refreshBalance])
  const listings = (market?.listings ?? []).filter((l) => species === 'all' || l.speciesId === species).sort((a, b) => sort === 'low' ? a.price - b.price : sort === 'high' ? b.price - a.price : 0)
  return <section className="commerce" aria-labelledby="market-title">
    <h2 id="market-title">Marketplace</h2><p>Your balance: <strong>${action.balance?.toLocaleString() ?? '?'}</strong></p>
    <nav className="commerce-tabs" aria-label="Marketplace categories">{(['browse', 'own', 'sell'] as const).map((value) => <button key={value} aria-pressed={tab === value} onClick={() => { setTab(value); setOffset(0); setMarket(null); setConfirm(null) }}>{value === 'browse' ? 'Browse plants' : value === 'own' ? 'My listings' : 'List a plant'}</button>)}</nav>
    <p>Individual mature specimens only. Seed trading is coming soon. Sellers receive the full listing price.</p>
    {action.message && <p role="status">{action.message}</p>}
    {tab === 'sell' ? <OwnedSpecimenCommerce mode="listing" onChanged={() => { setTab('own'); setOffset(0) }} /> : <>
      <div className="commerce-filters"><label>Species<select value={species} onChange={(e) => setSpecies(e.target.value)}><option value="all">All species</option><option value="echinopsis-pachanoi">San Pedro</option><option value="lophophora-williamsii">Peyote</option></select></label><label>Sort this page<select value={sort} onChange={(e) => setSort(e.target.value)}><option value="newest">Newest</option><option value="low">Price: low first</option><option value="high">Price: high first</option></select></label><button onClick={() => { void refresh(); void refreshBalance(); refreshInventory() }}>Refresh</button></div>
      {error && <p role="alert">{error}</p>}{!market && !error && <p>Loading listings...</p>}{market && !listings.length && <p>No matching listings on this page.</p>}
      <div className="commerce-grid">{listings.map((listing) => <article className="commerce-card" key={listing.id}>
        <PlantVisual visual={listing.visual} /><h3>{getSpeciesById(listing.speciesId)?.commonName ?? listing.speciesId}</h3><p>Mature ? {listing.status}</p>
        <p>Seller: {listing.seller.displayName}{listing.own ? ' (You)' : ''}</p><strong>${listing.price.toLocaleString()}</strong><small>Specimen {listing.specimenId}</small>
        <button onClick={() => setInspect(inspect === listing.id ? null : listing.id)}>Inspect</button>
        {inspect === listing.id && <GeneticKnowledgeView knowledge={listing.knowledge} />}
        {listing.status === 'active' && (listing.own ? <button disabled={action.busy || !action.ready} onClick={async () => { await action.transact({ type: 'cancel-listing', listingId: listing.id }); await refresh() }}>Cancel listing</button> : <button disabled={action.busy || !action.ready || (action.balance ?? 0) < listing.price} onClick={() => setConfirm(listing.id)}>{(action.balance ?? 0) < listing.price ? 'Not enough currency' : 'Buy'}</button>)}
        {confirm === listing.id && listing.status === 'active' && <div className="commerce-confirm" aria-label="Confirm Marketplace purchase"><p>Buy this {getSpeciesById(listing.speciesId)?.commonName} specimen for ${listing.price.toLocaleString()}?</p><button disabled={action.busy} onClick={() => setConfirm(null)}>Cancel</button><button disabled={action.busy} onClick={async () => { await action.transact({ type: 'buy-marketplace-listing', listingId: listing.id }); setConfirm(null); await refresh() }}>{action.busy ? 'Working...' : 'Confirm purchase'}</button></div>}
      </article>)}</div>
      <div className="commerce-tabs"><button disabled={offset === 0} onClick={() => { setOffset(Math.max(0, offset - 50)); setMarket(null) }}>Previous</button><button disabled={!market?.hasMore || offset >= 10000} onClick={() => { setOffset(offset + 50); setMarket(null) }}>Next</button></div>
    </>}
  </section>
}
