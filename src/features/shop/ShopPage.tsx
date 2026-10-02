import { useEffect, useState } from 'react'
import type { ShopCatalogV1 } from '../../../shared/api/commerceV1'
import { browserApiClient } from '../../services/api/browserApiClient'
import { useCommerceActions } from '../marketplace/useCommerceActions'
import { OwnedSpecimenCommerce } from '../marketplace/OwnedSpecimenCommerce'

export function ShopPage() {
  const [catalog, setCatalog] = useState<ShopCatalogV1 | null>(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'buy' | 'sell'>('buy')
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const action = useCommerceActions()
  useEffect(() => {
    const abort = new AbortController()
    void browserApiClient.getShopCatalog(abort.signal).then(setCatalog, (e: Error) => { if (!abort.signal.aborted) setError(e.message) })
    return () => abort.abort()
  }, [])
  return <section className="commerce" aria-labelledby="shop-title">
    <h2 id="shop-title">Shop</h2><p>Your balance: <strong>${action.balance?.toLocaleString() ?? '?'}</strong></p>
    {!action.ready && <p>Connect to your authenticated game to trade.</p>}
    <nav className="commerce-tabs" aria-label="Shop categories"><button aria-pressed={tab === 'buy'} onClick={() => setTab('buy')}>Buy seeds</button><button aria-pressed={tab === 'sell'} onClick={() => setTab('sell')}>Sell specimens</button></nav>
    {error && <p role="alert">{error}</p>}{action.message && <p role="status">{action.message}</p>}
    {tab === 'sell' ? <OwnedSpecimenCommerce mode="npc" /> : <>
      {!catalog && !error && <p>Loading stock...</p>}
      <div className="commerce-grid">{catalog?.items.map((item) => {
        const quantity = quantities[item.id] ?? 1
        const cost = item.price * quantity
        return <article className="commerce-card" key={item.id}>
          <span className="commerce-seed" aria-hidden="true">&#127793;</span><h3>{item.name}</h3><p>{item.description}</p><strong>${item.price.toLocaleString()} each</strong>
          <div className="commerce-quantity"><button aria-label={`Fewer ${item.name}`} disabled={quantity <= 1 || action.busy} onClick={() => setQuantities({ ...quantities, [item.id]: quantity - 1 })}>&minus;</button>
            <label>Quantity<input aria-label={`${item.name} quantity`} type="number" min="1" max={catalog.maxQuantity} value={quantity} disabled={action.busy} onChange={(e) => setQuantities({ ...quantities, [item.id]: Number(e.target.value) })} /></label>
            <button aria-label={`More ${item.name}`} disabled={quantity >= catalog.maxQuantity || action.busy} onClick={() => setQuantities({ ...quantities, [item.id]: quantity + 1 })}>+</button></div>
          <button disabled={!action.ready || action.busy || !Number.isInteger(quantity) || quantity < 1 || quantity > catalog.maxQuantity || cost > (action.balance ?? 0)} onClick={() => void action.transact({ type: 'buy-shop-seeds', itemId: item.id, quantity })}>{action.busy ? 'Working...' : `Buy for $${cost.toLocaleString()}`}</button>
          {cost > (action.balance ?? 0) && <small>Not enough currency.</small>}
        </article>
      })}</div>
    </>}
  </section>
}
