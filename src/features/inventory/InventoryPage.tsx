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
      </div>
    </section>
  )
}
