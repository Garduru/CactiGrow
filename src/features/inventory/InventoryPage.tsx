import { getSpeciesById } from '../../data/species'
import { useGameState } from '../../game/useGameState'

export function InventoryPage() {
  const { state } = useGameState()

  return (
    <section aria-labelledby="inventory-title">
      <h1 id="inventory-title">Inventory</h1>
      <p>Your current local prototype inventory.</p>
      <div className="inventory-list">
        {state.inventory.map((item) => {
          const seedSpecies = item.itemType === 'seed' ? getSpeciesById(item.itemKey) : undefined
          return (
            <article className="inventory-item" key={item.id}>
              <div>
                <strong>{seedSpecies ? `${seedSpecies.commonName} seeds` : item.itemKey}</strong>
                <span>{seedSpecies?.scientificName ?? item.itemType}</span>
              </div>
              <span className="inventory-item__quantity">× {item.quantity}</span>
            </article>
          )
        })}
        {state.bredSeeds.map((seed) => {
          const seedSpecies = getSpeciesById(seed.speciesId)
          return <article className="inventory-item inventory-item--bred" key={seed.id}><div><strong>{seedSpecies?.commonName ?? 'Bred offspring'} seed</strong><span>Unique {seed.isHybrid ? 'hybrid ' : ''}bred seed · {seed.id}</span><small>Parents: {seed.parentPlantIds.join(' + ')}</small></div><span className="inventory-item__quantity">{seed.isHybrid ? 'Hybrid' : 'Bred'}</span></article>
        })}
      </div>
    </section>
  )
}
